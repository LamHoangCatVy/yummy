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
    token: Optional[str] = Field("", description="GitHub Personal Access Token (optional, for private repo access)")
    max_scan_limit: Optional[int] = Field(10000, description="Maximum number of files to scan")


class GeminiConfig(BaseModel):
    api_key: Optional[str] = Field("", description="Gemini API Key from Google AI Studio")
    model: Optional[str] = Field(None, description="Gemini model ID (optional, keeps current if not provided)")


class OllamaConfig(BaseModel):
    base_url: str = Field("http://localhost:11434", description="Ollama local server URL")
    model: str = Field("llama3", description="Ollama model name (llama3, codellama, mistral, ...)")


class CopilotConfig(BaseModel):
    token: str = Field(..., description="GitHub token with Copilot access (COPILOT_GITHUB_TOKEN / GH_TOKEN)")
    model: Optional[str] = Field("gpt-4o", description="Copilot model ID (gpt-4o, gpt-4o-mini, claude-sonnet-4-5, o3-mini, ...)")


class ProviderSwitch(BaseModel):
    provider: str = Field(..., description="'gemini' | 'ollama' | 'copilot' | 'openai' | 'bedrock'")


class OpenAIConfig(BaseModel):
    api_key: Optional[str] = Field("", description="OpenAI API key (sk-...)")
    model: Optional[str] = Field("gpt-4o", description="OpenAI model ID (gpt-4o, gpt-4o-mini, o3, ...)")


class BedrockConfig(BaseModel):
    access_key: Optional[str] = Field("", description="AWS Access Key ID")
    secret_key: Optional[str] = Field("", description="AWS Secret Access Key")
    region: Optional[str] = Field("us-east-1", description="AWS region (us-east-1, us-west-2, ...)")
    model: Optional[str] = Field(
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
        description="Bedrock model ID (anthropic.claude-*, amazon.titan-*, meta.llama3-*, ...)"
    )


# ============================================================
# SESSION MODELS
# ============================================================

class NewSessionRequest(BaseModel):
    name: Optional[str] = Field(None, description="Workspace/session name")


# ============================================================
# RAG MODELS
# ============================================================

class AskRequest(BaseModel):
    session_id: str
    question: str
    ide_file: Optional[str] = Field("", description="Path of the file currently open in the IDE Simulator")
    ide_content: Optional[str] = Field("", description="Content of the file currently open in the IDE Simulator")


# ============================================================
# SDLC WORKFLOW MODELS
# ============================================================

class CRRequest(BaseModel):
    session_id: str
    requirement: str = Field(..., description="Change Request / feature requirement")


class ApproveRequest(BaseModel):
    session_id: str
    edited_content: Optional[str] = Field(
        None,
        description="If the user wants to edit the agent output before approving, pass the edited content here"
    )


# ============================================================
# RESPONSE MODELS (used for docs/type hints)
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
