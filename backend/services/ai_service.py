"""
YUMMY Backend - AI Service
Hỗ trợ 2 provider:
  - Gemini (cloud, dùng Google GenAI SDK)
  - Ollama (local, không cần API key)

Chọn provider qua:
  - ENV: AI_PROVIDER=gemini | ollama
  - Runtime: POST /config/provider
"""

import os
import time
import asyncio
import httpx
from datetime import datetime
from fastapi import HTTPException
from google import genai
from google.genai import types

from config import DB, API_CONFIG, GEMINI_MODEL, GEMINI_INPUT_PRICE, GEMINI_OUTPUT_PRICE


# ============================================================
# TOKEN ESTIMATION (fallback nếu SDK không trả usage_metadata)
# ============================================================

def estimate_tokens(text: str) -> int:
    """Ước tính số token dựa vào số ký tự (heuristic: 1 token ≈ 4 chars)."""
    return max(1, len(text) // 4)


# ============================================================
# REQUEST TRACKER
# ============================================================

def _track_request(
    agent_role: str,
    prompt: str,
    instruction: str,
    result_text: str,
    latency: float,
    in_tokens: int | None = None,
    out_tokens: int | None = None,
):
    """Lưu metadata của mỗi AI call vào DB request_logs.

    in_tokens / out_tokens: real counts từ SDK usage_metadata (ưu tiên).
    Nếu None, fallback về heuristic estimation.
    """
    if in_tokens is None:
        in_tokens = estimate_tokens(prompt + instruction)
    if out_tokens is None:
        out_tokens = estimate_tokens(result_text)

    provider = API_CONFIG.get("provider", "gemini")
    cost = 0.0
    if provider == "gemini":
        cost = (in_tokens / 1_000_000 * GEMINI_INPUT_PRICE) + (out_tokens / 1_000_000 * GEMINI_OUTPUT_PRICE)

    DB["request_logs"].insert(0, {
        "id": int(time.time() * 1000),
        "time": datetime.now().strftime("%H:%M:%S"),
        "agent": agent_role,
        "provider": provider,
        "in_tokens": in_tokens,
        "out_tokens": out_tokens,
        "latency": round(latency, 2),
        "cost": round(cost, 6)
    })


# ============================================================
# GEMINI CALL (Google GenAI SDK)
# ============================================================

async def _call_gemini(agent_role: str, prompt: str, instruction: str) -> str:
    """Gọi Gemini API qua Google GenAI SDK."""
    key = API_CONFIG.get("gemini_key", "")
    if not key:
        raise HTTPException(
            status_code=400,
            detail=(
                "Chưa cấu hình GEMINI_API_KEY. "
                "Dùng POST /config/api-key hoặc set env GEMINI_API_KEY."
            )
        )

    model = API_CONFIG.get("gemini_model", GEMINI_MODEL)
    client = genai.Client(api_key=key)

    start = time.time()
    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=instruction,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini SDK Error: {e}")

    latency = time.time() - start
    result_text = response.text or ""

    # Use real token counts from SDK when available
    usage = response.usage_metadata
    in_tokens = getattr(usage, "prompt_token_count", None)
    out_tokens = getattr(usage, "candidates_token_count", None)

    _track_request(agent_role, prompt, instruction, result_text, latency, in_tokens, out_tokens)
    return result_text


# ============================================================
# OLLAMA CALL (local)
# ============================================================

async def _call_ollama(agent_role: str, prompt: str, instruction: str) -> str:
    """
    Gọi Ollama local API.

    Config:
        OLLAMA_BASE_URL=http://localhost:11434
        OLLAMA_MODEL=llama3  (hoặc codellama, mistral, deepseek-coder, ...)
    """
    base_url = API_CONFIG.get("ollama_base_url", "http://localhost:11434")
    model = API_CONFIG.get("ollama_model", "llama3")
    url = f"{base_url}/api/chat"

    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt}
        ]
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Ollama Error {resp.status_code}: {resp.text[:300]}\n"
                    f"Đảm bảo Ollama đang chạy: `ollama serve` và model đã pull: `ollama pull {model}`"
                )
            )
        data = resp.json()

    result_text = data.get("message", {}).get("content", "")
    latency = time.time() - start
    _track_request(agent_role, prompt, instruction, result_text, latency)
    return result_text


# ============================================================
# COPILOT CALL (GitHub Copilot SDK)
# ============================================================

async def _call_copilot(agent_role: str, prompt: str, instruction: str) -> str:
    """Gọi GitHub Copilot qua github-copilot-sdk (event-driven async)."""
    token = API_CONFIG.get("copilot_token", "")
    if not token:
        raise HTTPException(
            status_code=400,
            detail=(
                "GitHub Copilot token chưa được cấu hình. "
                "Dùng POST /config/copilot hoặc set env COPILOT_GITHUB_TOKEN."
            )
        )

    model = API_CONFIG.get("copilot_model", "gpt-4o")

    try:
        from copilot import CopilotClient
        from copilot.session import PermissionHandler
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="github-copilot-sdk chưa được cài. Chạy: pip install github-copilot-sdk",
        )

    # SDK picks up the token from this env var
    os.environ["COPILOT_GITHUB_TOKEN"] = token

    result_parts: list[str] = []
    done = asyncio.Event()

    start = time.time()
    try:
        async with CopilotClient() as client:
            async with await client.create_session(
                on_permission_request=PermissionHandler.approve_all,
                model=model,
                system_message={"role": "system", "content": instruction},
            ) as session:

                def on_event(event):
                    ev_type = event.type.value if hasattr(event.type, "value") else str(event.type)
                    if ev_type == "assistant.message":
                        result_parts.append(event.data.content or "")
                    elif ev_type == "session.idle":
                        done.set()

                session.on(on_event)
                await session.send(prompt)
                await asyncio.wait_for(done.wait(), timeout=120)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Copilot session timed out after 120s.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Copilot SDK Error: {e}")

    latency = time.time() - start
    result_text = "".join(result_parts)
    _track_request(agent_role, prompt, instruction, result_text, latency)
    return result_text


# ============================================================
# PUBLIC API: call_ai()
# ============================================================

async def call_ai(agent_role: str, prompt: str, instruction: str) -> str:
    """
    Unified AI call — tự động chọn provider từ API_CONFIG["provider"].

    Args:
        agent_role:  Tên agent để track trong logs (BA, SA, DEV, SEC, SRE, ...)
        prompt:      Nội dung user message (context + question)
        instruction: System instruction cho agent

    Returns:
        Chuỗi text response từ AI.
    """
    provider = API_CONFIG.get("provider", "gemini")

    if provider == "ollama":
        return await _call_ollama(agent_role, prompt, instruction)
    elif provider == "copilot":
        return await _call_copilot(agent_role, prompt, instruction)
    else:
        return await _call_gemini(agent_role, prompt, instruction)
