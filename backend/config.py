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
GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Pricing per 1M tokens (USD)
GEMINI_INPUT_PRICE = 0.075
GEMINI_OUTPUT_PRICE = 0.30

# ============================================================
# IN-MEMORY DATABASE (replaces localStorage from React SPA)
# ============================================================
# NOTE: Trong production nên dùng Redis hoặc PostgreSQL.
# Đây là in-memory store cho development/demo.
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
    "scan_status": None,   # None | { text, progress, running }
    "max_scan_limit": 10000,
}

# ============================================================
# GEMINI API KEY (runtime-configurable qua /config/api-key)
# ============================================================
# Dùng dict để có thể mutate từ router (tránh dùng global keyword)
API_CONFIG: Dict[str, str] = {
    "gemini_key": os.getenv("GEMINI_API_KEY", ""),
    # Nếu muốn dùng Ollama local, set OLLAMA_BASE_URL
    # ví dụ: "http://localhost:11434"
    "ollama_base_url": os.getenv("OLLAMA_BASE_URL", ""),
    "ollama_model": os.getenv("OLLAMA_MODEL", "llama3"),
    "provider": os.getenv("AI_PROVIDER", "gemini"),  # "gemini" | "ollama"
}
