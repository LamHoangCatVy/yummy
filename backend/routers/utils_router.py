"""
YUMMY Backend - Utilities Router
Endpoints: /, /help, /health, /health/model
"""

import time
import httpx
from fastapi import APIRouter
from google import genai
from google.genai import types
from config import DB, API_CONFIG

router = APIRouter(tags=["Utilities"])


@router.get("/")
def root():
    return {
        "message": "YUMMY Backend API - AI-powered SDLC Platform",
        "docs": "/docs",
        "redoc": "/redoc",
        "help": "/help",
        "health": "/health"
    }


@router.get("/health")
def health_check():
    """Health check endpoint for Docker/K8s liveness probe."""
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
        model = API_CONFIG.get("gemini_model", "gemini-2.5-flash")
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
            return {"status": "error", "provider": "copilot", "model": model, "error": "Timeout - check token/network."}
        except Exception as e:
            latency = round((time.time() - start) * 1000)
            return {"status": "error", "provider": "copilot", "model": model, "latency_ms": latency, "error": str(e)}

    elif provider == "openai":
        import httpx as _httpx
        key = API_CONFIG.get("openai_key", "")
        model = API_CONFIG.get("openai_model", "gpt-4o")
        if not key:
            return {"status": "error", "provider": "openai", "model": model, "error": "OPENAI_API_KEY not configured."}
        try:
            async with _httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5},
                )
            latency = round((time.time() - start) * 1000)
            if resp.status_code != 200:
                return {"status": "error", "provider": "openai", "model": model, "latency_ms": latency, "error": resp.text[:200]}
            return {"status": "ok", "provider": "openai", "model": model, "latency_ms": latency}
        except Exception as e:
            return {"status": "error", "provider": "openai", "model": model, "error": str(e)}

    elif provider == "bedrock":
        import asyncio as _asyncio
        access_key = API_CONFIG.get("bedrock_access_key", "")
        secret_key = API_CONFIG.get("bedrock_secret_key", "")
        region = API_CONFIG.get("bedrock_region", "us-east-1")
        model = API_CONFIG.get("bedrock_model", "anthropic.claude-3-5-sonnet-20241022-v2:0")
        if not access_key or not secret_key:
            return {"status": "error", "provider": "bedrock", "model": model, "error": "AWS credentials not configured."}
        try:
            import boto3
            def _ping():
                c = boto3.client("bedrock-runtime", region_name=region, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
                return c.converse(modelId=model, messages=[{"role": "user", "content": [{"text": "ping"}]}])
            await _asyncio.get_event_loop().run_in_executor(None, _ping)
            latency = round((time.time() - start) * 1000)
            return {"status": "ok", "provider": "bedrock", "model": model, "latency_ms": latency}
        except Exception as e:
            latency = round((time.time() - start) * 1000)
            return {"status": "error", "provider": "bedrock", "model": model, "latency_ms": latency, "error": str(e)}

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
    """List all commands and workflow guide."""
    return {
        "commands": {
            # Config
            "POST /config/api-key":   "Set Gemini API key (from Google AI Studio)",
            "POST /config/ollama":    "Configure local Ollama server",
            "POST /config/provider":  "Switch provider: gemini | ollama",
            "POST /config/setup":     "Setup GitHub repo (github_url, token, max_scan_limit)",
            "GET  /config/status":    "View full system status",
            # Sessions
            "POST /sessions":               "Create a new session/workspace",
            "GET  /sessions":               "List all sessions",
            "GET  /sessions/{id}":          "Get session details",
            "DELETE /sessions/{id}":        "Delete a session",
            "POST /sessions/{id}/reset":    "Reset workflow state to idle",
            # Knowledge Base
            "POST /kb/scan":          "Scan and index codebase from GitHub (background)",
            "GET  /kb/scan/status":   "Poll scan progress (0-100%)",
            "GET  /kb":               "View knowledge base (tree, insights, summary)",
            "GET  /kb/file?path=...": "View file content (IDE Simulator)",
            "DELETE /kb":             "Clear knowledge base",
            # RAG
            "POST /ask":              "RAG Chat: ask questions about the codebase",
            # SDLC
            "POST /sdlc/start":              "Start SDLC with a Change Request (BA writes BRD)",
            "POST /sdlc/approve-ba":         "Approve BA output -> run SA + JIRA",
            "POST /sdlc/approve-sa":         "Approve SA output -> Dev Lead review",
            "POST /sdlc/approve-dev-lead":   "Approve Dev Lead -> DEV + SECURITY + QA + SRE",
            "GET  /sdlc/{id}/state":         "View SDLC state and outputs",
            "GET  /sdlc/{id}/history":       "View chat history",
            # Metrics
            "GET  /metrics":          "Request logs + AI costs",
            "DELETE /metrics":        "Clear metrics logs",
        },
        "agent_pipeline": [
            "BA       -> Business Requirements Document (BRD)",
            "SA       -> System Architecture Document (SAD)",
            "PM       -> JIRA Backlog (JSON, runs in parallel with SA)",
            "DEV LEAD -> SA Review + Implementation Plan",
            "DEV      -> Pseudocode / Code Structure",
            "SECURITY -> OWASP + Threat Model + Security Action Items",
            "QA       -> Test Plan + Test Cases",
            "SRE      -> Deployment Plan + Rollback",
        ],
        "workflow": [
            "1. POST /config/api-key      -> set Gemini key (or /config/ollama + /config/provider)",
            "2. POST /config/setup        -> set GitHub repo URL",
            "3. POST /kb/scan             -> scan codebase",
            "4. GET  /kb/scan/status      -> poll until progress=100",
            "5. POST /sessions            -> create workspace",
            "6. POST /sdlc/start          -> submit Change Request",
            "7. POST /sdlc/approve-ba     -> approve BRD",
            "8. POST /sdlc/approve-sa     -> approve Architecture",
            "9. POST /sdlc/approve-dev-lead -> approve Implementation Plan",
            "10. GET /sdlc/{id}/state     -> view all outputs",
        ]
    }
