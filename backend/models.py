"""
YUMMY Backend - Pydantic Request/Response Models
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================
# CONFIG MODELS
# ============================================================

class SetupRequest(BaseModel):
    github_url: str = Field(..., example="https://github.com/owner/repo")
    token: Optional[str] = Field("", description="GitHub Personal Access Token (optional, để access private repo)")
    max_scan_limit: Optional[int] = Field(10000, description="Giới hạn số file tối đa khi scan")


class GeminiConfig(BaseModel):
    api_key: str = Field(..., description="Gemini API Key từ Google AI Studio")


class OllamaConfig(BaseModel):
    base_url: str = Field("http://localhost:11434", description="URL Ollama server local")
    model: str = Field("llama3", description="Tên model Ollama (llama3, codellama, mistral, ...)")


class ProviderSwitch(BaseModel):
    provider: str = Field(..., description="'gemini' hoặc 'ollama'")


# ============================================================
# SESSION MODELS
# ============================================================

class NewSessionRequest(BaseModel):
    name: Optional[str] = Field(None, description="Tên workspace/session")


# ============================================================
# RAG MODELS
# ============================================================

class AskRequest(BaseModel):
    session_id: str
    question: str
    ide_file: Optional[str] = Field("", description="Đường dẫn file đang mở trên IDE Simulator")
    ide_content: Optional[str] = Field("", description="Nội dung file đang mở trên IDE Simulator")


# ============================================================
# SDLC WORKFLOW MODELS
# ============================================================

class CRRequest(BaseModel):
    session_id: str
    requirement: str = Field(..., description="Change Request / yêu cầu tính năng")


class ApproveRequest(BaseModel):
    session_id: str
    edited_content: Optional[str] = Field(
        None,
        description="Nếu user muốn chỉnh sửa output của agent trước khi approve, truyền vào đây"
    )


# ============================================================
# RESPONSE MODELS (dùng cho docs/type hints)
# ============================================================

class AgentOutput(BaseModel):
    agent: str
    content: str
    timestamp: Optional[str] = None


class SDLCStateResponse(BaseModel):
    workflow_state: str
    agent_outputs: Dict[str, Any]
    jira_backlog: List[Any]


class ScanStatusResponse(BaseModel):
    running: bool
    text: str
    progress: Optional[int] = 0
    error: Optional[bool] = False


class MetricsResponse(BaseModel):
    total_requests: int
    total_cost_usd: float
    logs: List[Dict[str, Any]]
