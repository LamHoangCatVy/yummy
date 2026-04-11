"""
YUMMY Backend - Utilities Router
Endpoints: /, /help, /health
"""

from fastapi import APIRouter

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
