"""
YUMMY Backend - AI Service
Hỗ trợ 2 provider:
  - Gemini 2.5 Flash (cloud, cần API key)
  - Ollama (local, không cần API key)

Chọn provider qua:
  - ENV: AI_PROVIDER=gemini | ollama
  - Runtime: POST /config/provider
"""

import time
import httpx
from datetime import datetime
from fastapi import HTTPException

from config import DB, API_CONFIG, GEMINI_MODEL, GEMINI_BASE_URL, GEMINI_INPUT_PRICE, GEMINI_OUTPUT_PRICE


# ============================================================
# TOKEN ESTIMATION
# ============================================================

def estimate_tokens(text: str) -> int:
    """Ước tính số token dựa vào số ký tự (heuristic: 1 token ≈ 4 chars)."""
    return max(1, len(text) // 4)


# ============================================================
# REQUEST TRACKER
# ============================================================

def _track_request(agent_role: str, prompt: str, instruction: str, result_text: str, latency: float):
    """Lưu metadata của mỗi AI call vào DB request_logs."""
    in_tokens = estimate_tokens(prompt + instruction)
    out_tokens = estimate_tokens(result_text)
    
    # Chi phí chỉ tính cho Gemini. Ollama local = 0 cost.
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
# GEMINI CALL
# ============================================================

async def _call_gemini(agent_role: str, prompt: str, instruction: str) -> str:
    """Gọi Gemini 2.5 Flash API."""
    key = API_CONFIG.get("gemini_key", "")
    if not key:
        raise HTTPException(
            status_code=400,
            detail=(
                "Chưa cấu hình GEMINI_API_KEY. "
                "Dùng POST /config/api-key hoặc set env GEMINI_API_KEY."
            )
        )

    url = f"{GEMINI_BASE_URL}/{GEMINI_MODEL}:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": instruction}]}
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=payload)
        # Fix: dùng status_code != 200 thay vì resp.ok (không tồn tại trong httpx)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Gemini API Error {resp.status_code}: {resp.text[:300]}"
            )
        data = resp.json()

    result_text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    latency = time.time() - start
    _track_request(agent_role, prompt, instruction, result_text, latency)
    return result_text


# ============================================================
# OLLAMA CALL (local)
# ============================================================

async def _call_ollama(agent_role: str, prompt: str, instruction: str) -> str:
    """
    Gọi Ollama local API.
    
    Ollama endpoint: POST /api/chat
    Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
    
    Config:
        OLLAMA_BASE_URL=http://localhost:11434
        OLLAMA_MODEL=llama3  (hoặc codellama, mistral, deepseek-coder, ...)
    """
    base_url = API_CONFIG.get("ollama_base_url", "http://localhost:11434")
    model = API_CONFIG.get("ollama_model", "llama3")
    url = f"{base_url}/api/chat"

    # Ollama dùng messages format tương tự OpenAI
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt}
        ]
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=300) as client:  # timeout dài hơn vì local model chậm hơn
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
# PUBLIC API: call_ai()
# ============================================================

async def call_ai(agent_role: str, prompt: str, instruction: str) -> str:
    """
    Unified AI call — tự động chọn provider từ API_CONFIG["provider"].
    
    Args:
        agent_role: Tên agent để track trong logs (BA, SA, DEV, SEC, SRE, ...)
        prompt:     Nội dung user message (context + question)
        instruction: System instruction cho agent

    Returns:
        Chuỗi text response từ AI.
    """
    provider = API_CONFIG.get("provider", "gemini")
    
    if provider == "ollama":
        return await _call_ollama(agent_role, prompt, instruction)
    else:
        return await _call_gemini(agent_role, prompt, instruction)
