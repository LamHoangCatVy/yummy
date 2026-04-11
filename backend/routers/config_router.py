"""
YUMMY Backend - Config Router
Endpoints: /config/*
"""

import re
from fastapi import APIRouter, HTTPException
from config import DB, API_CONFIG
from models import SetupRequest, GeminiConfig, OllamaConfig, ProviderSwitch

router = APIRouter(prefix="/config", tags=["Config"])


@router.post("/api-key")
def set_api_key(cfg: GeminiConfig):
    """
    Set Gemini API key tại runtime.
    Thay thế cho việc phải restart server khi đổi key.
    
    Lấy key tại: https://aistudio.google.com/app/apikey
    """
    API_CONFIG["gemini_key"] = cfg.api_key
    return {"status": "ok", "message": "Gemini API key đã được cấu hình."}


@router.post("/ollama")
def set_ollama_config(cfg: OllamaConfig):
    """
    Cấu hình Ollama local server.
    
    Để dùng Ollama:
    1. Cài Ollama: https://ollama.ai/download
    2. Chạy: ollama serve
    3. Pull model: ollama pull llama3  (hoặc codellama, mistral, deepseek-coder)
    4. Gọi endpoint này với base_url và model
    5. Gọi POST /config/provider với {"provider": "ollama"}
    """
    API_CONFIG["ollama_base_url"] = cfg.base_url
    API_CONFIG["ollama_model"] = cfg.model
    return {
        "status": "ok",
        "message": f"Ollama config đã set: {cfg.base_url} / model={cfg.model}",
        "note": "Gọi POST /config/provider với {'provider': 'ollama'} để switch sang Ollama."
    }


@router.post("/provider")
def switch_provider(req: ProviderSwitch):
    """
    Switch AI provider giữa 'gemini' và 'ollama'.
    
    - gemini: dùng Gemini 2.5 Flash (cloud, cần API key, có cost)
    - ollama: dùng model local (miễn phí, chậm hơn, cần ollama serve)
    """
    if req.provider not in ("gemini", "ollama"):
        raise HTTPException(400, "Provider phải là 'gemini' hoặc 'ollama'.")
    API_CONFIG["provider"] = req.provider
    return {"status": "ok", "provider": req.provider}


@router.post("/setup")
async def setup_repo(req: SetupRequest):
    """
    Parse GitHub URL và lưu repo info + token.
    
    Ví dụ URL hợp lệ:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - https://github.com/owner/repo/tree/main
    """
    match = re.search(
        r"github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/|$)",
        req.github_url
    )
    if not match:
        raise HTTPException(
            400,
            "URL GitHub không hợp lệ. Ví dụ: https://github.com/owner/repo"
        )

    owner, repo = match.group(1), match.group(2)
    DB["repo_info"] = {"owner": owner, "repo": repo}

    if req.token:
        DB["github_token"] = req.token

    DB["max_scan_limit"] = req.max_scan_limit

    return {
        "status": "ok",
        "owner": owner,
        "repo": repo,
        "max_scan_limit": req.max_scan_limit,
        "note": "Tiếp theo: POST /kb/scan để index codebase."
    }


@router.get("/status")
def get_status():
    """
    Xem toàn bộ trạng thái hệ thống.
    Dùng để kiểm tra trước khi bắt đầu workflow.
    """
    return {
        "repo": DB.get("repo_info"),
        "ai_provider": API_CONFIG.get("provider", "gemini"),
        "has_gemini_key": bool(API_CONFIG.get("gemini_key")),
        "has_github_token": bool(DB.get("github_token")),
        "ollama_url": API_CONFIG.get("ollama_base_url") or None,
        "ollama_model": API_CONFIG.get("ollama_model"),
        "kb_files": len(DB["knowledge_base"]["tree"]),
        "kb_insights": len(DB["knowledge_base"]["insights"]),
        "kb_has_summary": bool(DB["knowledge_base"]["project_summary"]),
        "total_sessions": len(DB["sessions"]),
        "scan_status": DB.get("scan_status"),
        "total_requests": len(DB["request_logs"]),
        "total_cost_usd": round(sum(l["cost"] for l in DB["request_logs"]), 5)
    }
