"""
YUMMY Backend - Utilities Router
Endpoints: /, /help, /health, /health/model
"""

import time
import httpx
from fastapi import APIRouter
from google import genai
from google.genai import types
from config import DB, API_CONFIG, GEMINI_MODEL

router = APIRouter(tags=["Utilities"])


@router.get("/")
def root():
    return {
        "message": "⚡ YUMMY Backend API — AI-powered SDLC Platform",
        "docs": "/docs",
        "redoc": "/redoc",
        "help": "/help",
        "health": "/health"
    }


@router.get("/health")
def health_check():
    """Health check endpoint cho Docker/K8s liveness probe."""
    return {"status": "ok"}


@router.get("/health/model")
async def health_model():
    """
    Ping the configured AI provider with a minimal prompt.
    Returns: status ok/error, provider, model, latency_ms.
    """
    provider = API_CONFIG.get("provider", "gemini")
    start = time.time()

    if provider == "gemini":
        key = API_CONFIG.get("gemini_key", "")
        model = API_CONFIG.get("gemini_model", GEMINI_MODEL)
        if not key:
            return {"status": "error", "provider": "gemini", "model": model, "error": "GEMINI_API_KEY not configured."}
        try:
            sdk_client = genai.Client(api_key=key)
            await sdk_client.aio.models.generate_content(
                model=model,
                contents="ping",
                config=types.GenerateContentConfig(
                    system_instruction="Reply with the single word: pong",
                    max_output_tokens=5,
                ),
            )
            latency = round((time.time() - start) * 1000)
            return {"status": "ok", "provider": "gemini", "model": model, "latency_ms": latency}
        except Exception as e:
            latency = round((time.time() - start) * 1000)
            return {"status": "error", "provider": "gemini", "model": model, "latency_ms": latency, "error": str(e)}

    elif provider == "copilot":
        import os, asyncio
        token = API_CONFIG.get("copilot_token", "")
        model = API_CONFIG.get("copilot_model", "gpt-4o")
        if not token:
            return {"status": "error", "provider": "copilot", "model": model, "error": "Copilot token not configured."}
        try:
            from copilot import CopilotClient
            from copilot.session import PermissionHandler
            os.environ["COPILOT_GITHUB_TOKEN"] = token
            result_parts: list[str] = []
            done = asyncio.Event()
            async with CopilotClient() as client:
                async with await client.create_session(
                    on_permission_request=PermissionHandler.approve_all,
                    model=model,
                ) as session:
                    def on_event(event):
                        ev = event.type.value if hasattr(event.type, "value") else str(event.type)
                        if ev in ("assistant.message", "session.idle"):
                            done.set()
                    session.on(on_event)
                    await session.send("ping")
                    await asyncio.wait_for(done.wait(), timeout=15)
            latency = round((time.time() - start) * 1000)
            return {"status": "ok", "provider": "copilot", "model": model, "latency_ms": latency}
        except asyncio.TimeoutError:
            return {"status": "error", "provider": "copilot", "model": model, "error": "Timeout — check token/network."}
        except Exception as e:
            latency = round((time.time() - start) * 1000)
            return {"status": "error", "provider": "copilot", "model": model, "latency_ms": latency, "error": str(e)}

    else:  # ollama
        base_url = API_CONFIG.get("ollama_base_url", "http://localhost:11434")
        model = API_CONFIG.get("ollama_model", "llama3")
        url = f"{base_url}/api/chat"
        payload = {"model": model, "stream": False, "messages": [{"role": "user", "content": "ping"}]}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=payload)
            latency = round((time.time() - start) * 1000)
            if resp.status_code != 200:
                return {"status": "error", "provider": "ollama", "model": model, "latency_ms": latency, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
            return {"status": "ok", "provider": "ollama", "model": model, "latency_ms": latency}
        except Exception as e:
            return {"status": "error", "provider": "ollama", "model": model, "error": str(e)}


@router.get("/help")
def help_commands():
    """
    Danh sách tất cả lệnh và workflow guide.
    """
    return {
        "commands": {
            # Config
            "POST /config/api-key":   "Set Gemini API key (từ Google AI Studio)",
            "POST /config/ollama":    "Cấu hình Ollama local server",
            "POST /config/provider":  "Switch provider: gemini | ollama",
            "POST /config/setup":     "Setup GitHub repo (github_url, token, max_scan_limit)",
            "GET  /config/status":    "Xem trạng thái toàn hệ thống",
            # Sessions
            "POST /sessions":               "Tạo session/workspace mới",
            "GET  /sessions":               "Liệt kê tất cả sessions",
            "GET  /sessions/{id}":          "Chi tiết session",
            "DELETE /sessions/{id}":        "Xóa session",
            "POST /sessions/{id}/reset":    "Reset workflow state về idle",
            # Knowledge Base
            "POST /kb/scan":          "Quét và index codebase từ GitHub (background)",
            "GET  /kb/scan/status":   "Poll tiến trình scan (0-100%)",
            "GET  /kb":               "Xem knowledge base (tree, insights, summary)",
            "GET  /kb/file?path=...": "Xem nội dung file (IDE Simulator)",
            "DELETE /kb":             "Xóa knowledge base",
            # RAG
            "POST /ask":              "RAG Chat: hỏi về codebase",
            # SDLC
            "POST /sdlc/start":              "Bắt đầu SDLC với CR (BA viết BRD)",
            "POST /sdlc/approve-ba":         "Approve BA → chạy SA + JIRA",
            "POST /sdlc/approve-sa":         "Approve SA → Dev Lead review",
            "POST /sdlc/approve-dev-lead":   "Approve Dev Lead → DEV + SECURITY + QA + SRE",
            "GET  /sdlc/{id}/state":         "Xem trạng thái SDLC và outputs",
            "GET  /sdlc/{id}/history":       "Xem chat history",
            # Metrics
            "GET  /metrics":          "Request logs + chi phí AI",
            "DELETE /metrics":        "Xóa metrics logs",
        },
        "agent_pipeline": [
            "BA  → Business Requirements Document (BRD)",
            "SA  → System Architecture Document (SAD)",
            "PM  → JIRA Backlog (JSON, chạy song song với SA)",
            "DEV LEAD → SA Review + Implementation Plan",
            "DEV → Pseudocode / Code Structure",
            "SECURITY → OWASP + Threat Model + Security Action Items",
            "QA  → Test Plan + Test Cases",
            "SRE → Deployment Plan + Rollback",
        ],
        "workflow": [
            "1. POST /config/api-key      → set Gemini key (hoặc /config/ollama + /config/provider)",
            "2. POST /config/setup        → set GitHub repo URL",
            "3. POST /sessions            → tạo session, lấy session_id",
            "4. POST /kb/scan             → index codebase",
            "   GET  /kb/scan/status      → poll đến khi progress=100",
            "5. POST /ask                 → hỏi về code (tùy chọn)",
            "6. POST /sdlc/start          → gửi CR requirement",
            "7. POST /sdlc/approve-ba     → approve BRD",
            "8. POST /sdlc/approve-sa     → approve SA Design",
            "9. POST /sdlc/approve-dev-lead → approve Dev Plan → done!",
        ],
        "local_dev": {
            "start": "uvicorn main:app --reload --port 8000",
            "docs": "http://localhost:8000/docs",
            "ollama_setup": [
                "1. Cài: https://ollama.ai/download",
                "2. Chạy: ollama serve",
                "3. Pull: ollama pull codellama (hoặc llama3, deepseek-coder)",
                "4. Config: POST /config/ollama + POST /config/provider"
            ]
        }
    }
