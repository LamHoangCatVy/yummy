"""
YUMMY Backend — FastAPI Entry Point
AI-powered multi-agent SDLC platform for banking/enterprise

Run:
    uvicorn main:app --reload --port 8000

Docs:
    http://localhost:8000/docs     (Swagger UI)
    http://localhost:8000/redoc    (ReDoc)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers
from routers.config_router import router as config_router
from routers.sessions_router import router as sessions_router
from routers.kb_router import router as kb_router
from routers.ask_router import router as ask_router
from routers.sdlc_router import router as sdlc_router
from routers.metrics_router import router as metrics_router
from routers.utils_router import router as utils_router

# ============================================================
# APP INIT
# ============================================================

app = FastAPI(
    title="YUMMY API",
    description=(
        "## ⚡ YUMMY — AI-powered Multi-Agent SDLC Platform\n\n"
        "**Agent Pipeline:** BA → SA → Dev Lead → DEV → Security → QA → SRE\n\n"
        "**Providers:** Gemini 2.5 Flash (cloud) | Ollama (local)\n\n"
        "Xem `/help` để biết workflow đầy đủ."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================
# CORS MIDDLEWARE
# Note: Trong production, thay allow_origins=["*"] bằng domain cụ thể
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO: thay bằng ["http://localhost:3000", "https://yourdomain.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# REGISTER ROUTERS
# ============================================================

app.include_router(utils_router)
app.include_router(config_router)
app.include_router(sessions_router)
app.include_router(kb_router)
app.include_router(ask_router)
app.include_router(sdlc_router)
app.include_router(metrics_router)
