"""
YUMMY Backend - Global Configuration & In-Memory Store
"""

import os
from typing import Any, Dict

# ============================================================
# ALLOWED FILE EXTENSIONS (for repo scanning)
# ============================================================
ALLOWED_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go',
    '.rb', '.php', '.cs', '.html', '.css', '.json', '.md'
}

# ============================================================
# AI MODEL CONFIG
# ============================================================
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Pricing per 1M tokens (USD)
GEMINI_INPUT_PRICE = 0.075
GEMINI_OUTPUT_PRICE = 0.30

# ============================================================
# IN-MEMORY DATABASE
# NOTE: In production, use Redis or PostgreSQL instead.
# This is an in-memory store for development/demo purposes.
# ============================================================
DB: Dict[str, Any] = {
    "sessions": {},
    "knowledge_base": {
        "tree": [],
        "insights": [],
        "project_summary": ""
    },
    "repo_info": None,
    "github_token": "",
    "request_logs": [],
    "scan_status": None,
    "max_scan_limit": 100,          # demo limit — 100 files
    "total_cost_usd": 0.0,          # running cost tracker
    "cost_limit_usd": 300.0,        # hard cap — stop when exceeded
}

# ============================================================
# API CONFIG (runtime-configurable via /config/api-key)
# Using a dict to allow mutation from routers without global keyword
# ============================================================
API_CONFIG: Dict[str, str] = {
    "gemini_key": os.getenv("GEMINI_API_KEY", ""),
    "gemini_model": os.getenv("GEMINI_MODEL", GEMINI_MODEL),
    "ollama_base_url": os.getenv("OLLAMA_BASE_URL", ""),
    "ollama_model": os.getenv("OLLAMA_MODEL", "llama3"),
    "copilot_token": os.getenv("COPILOT_GITHUB_TOKEN", os.getenv("GH_TOKEN", os.getenv("GITHUB_TOKEN", ""))),
    "copilot_model": os.getenv("COPILOT_MODEL", "gpt-4o"),
    "openai_key": os.getenv("OPENAI_API_KEY", ""),
    "openai_model": os.getenv("OPENAI_MODEL", "gpt-5-nano"),
    # AWS Bedrock — default provider for demo (cheapest: Nova Micro $0.035/1M)
    "bedrock_access_key": os.getenv("AWS_ACCESS_KEY_ID", ""),
    "bedrock_secret_key": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
    "bedrock_region": os.getenv("AWS_REGION", "us-east-1"),
    "bedrock_model": os.getenv("BEDROCK_MODEL", "amazon.nova-micro-v1:0"),
    "provider": os.getenv("AI_PROVIDER", "bedrock"),
}
