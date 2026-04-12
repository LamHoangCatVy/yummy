"""
YUMMY Backend - Config Router
Endpoints: /config/*
"""

import re
import os
from fastapi import APIRouter, HTTPException
from config import DB, API_CONFIG
from models import SetupRequest, GeminiConfig, OllamaConfig, CopilotConfig, ProviderSwitch, OpenAIConfig, BedrockConfig

router = APIRouter(prefix="/config", tags=["Config"])


@router.post("/api-key")
def set_api_key(cfg: GeminiConfig):
    if cfg.api_key:
        API_CONFIG["gemini_key"] = cfg.api_key
    if cfg.model:
        API_CONFIG["gemini_model"] = cfg.model
    return {"status": "ok", "model": API_CONFIG["gemini_model"]}


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
    Switch AI provider.
    
    - gemini:  Google Gemini (cloud, needs API key)
    - ollama:  Local Ollama (free, needs ollama serve)
    - copilot: GitHub Copilot (needs GH token)
    - openai:  OpenAI (cloud, needs API key)
    - bedrock: AWS Bedrock (cloud, needs AWS credentials)
    """
    if req.provider not in ("gemini", "ollama", "copilot", "openai", "bedrock"):
        raise HTTPException(400, "Provider must be one of: gemini, ollama, copilot, openai, bedrock.")
    API_CONFIG["provider"] = req.provider
    return {"status": "ok", "provider": req.provider}


@router.post("/openai")
def set_openai_config(cfg: OpenAIConfig):
    if cfg.api_key:
        API_CONFIG["openai_key"] = cfg.api_key
    if cfg.model:
        API_CONFIG["openai_model"] = cfg.model
    return {"status": "ok", "model": API_CONFIG["openai_model"]}


@router.post("/bedrock")
def set_bedrock_config(cfg: BedrockConfig):
    if cfg.access_key:
        API_CONFIG["bedrock_access_key"] = cfg.access_key
    if cfg.secret_key:
        API_CONFIG["bedrock_secret_key"] = cfg.secret_key
    if cfg.region:
        API_CONFIG["bedrock_region"] = cfg.region
    if cfg.model:
        API_CONFIG["bedrock_model"] = cfg.model
    return {"status": "ok", "region": API_CONFIG["bedrock_region"], "model": API_CONFIG["bedrock_model"]}


@router.post("/copilot")
def set_copilot_config(cfg: CopilotConfig):
    if cfg.token:
        API_CONFIG["copilot_token"] = cfg.token
    if cfg.model:
        API_CONFIG["copilot_model"] = cfg.model
    return {"status": "ok", "model": API_CONFIG["copilot_model"]}


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
    View full system status.
    Keys are NEVER returned — only boolean flags indicating whether they are set,
    and the source (env = loaded from environment variable, ui = set via API).
    """
    def _key_source(env_var: str, config_key: str) -> str:
        """Return 'env' if the value came from an env var, 'ui' if set at runtime, 'none' if missing."""
        if not API_CONFIG.get(config_key):
            return "none"
        if os.getenv(env_var):
            # Value matches what env would provide — likely from env
            return "env" if API_CONFIG[config_key] == os.getenv(env_var) else "ui"
        return "ui"

    return {
        "repo": DB.get("repo_info"),
        "ai_provider": API_CONFIG.get("provider", "gemini"),
        # Gemini
        "has_gemini_key": bool(API_CONFIG.get("gemini_key")),
        "gemini_key_source": _key_source("GEMINI_API_KEY", "gemini_key"),
        "gemini_model": API_CONFIG.get("gemini_model"),
        # GitHub
        "has_github_token": bool(DB.get("github_token")),
        # Ollama
        "ollama_url": API_CONFIG.get("ollama_base_url") or None,
        "ollama_model": API_CONFIG.get("ollama_model"),
        # Copilot
        "has_copilot_token": bool(API_CONFIG.get("copilot_token")),
        "copilot_key_source": _key_source("COPILOT_GITHUB_TOKEN", "copilot_token"),
        "copilot_model": API_CONFIG.get("copilot_model"),
        # OpenAI
        "has_openai_key": bool(API_CONFIG.get("openai_key")),
        "openai_key_source": _key_source("OPENAI_API_KEY", "openai_key"),
        "openai_model": API_CONFIG.get("openai_model"),
        # Bedrock
        "has_bedrock_key": bool(API_CONFIG.get("bedrock_access_key")),
        "bedrock_key_source": _key_source("AWS_ACCESS_KEY_ID", "bedrock_access_key"),
        "bedrock_region": API_CONFIG.get("bedrock_region"),
        "bedrock_model": API_CONFIG.get("bedrock_model"),
        # KB
        "kb_files": len(DB["knowledge_base"]["tree"]),
        "kb_insights": len(DB["knowledge_base"]["insights"]),
        "kb_has_summary": bool(DB["knowledge_base"]["project_summary"]),
        "total_sessions": len(DB["sessions"]),
        "scan_status": DB.get("scan_status"),
        "total_requests": len(DB["request_logs"]),
        "total_cost_usd": round(sum(l["cost"] for l in DB["request_logs"]), 5)
    }
