"""
YUMMY Backend - Shared Dependencies & Helper Functions
"""

import time
from datetime import datetime
from fastapi import HTTPException
from config import DB


# ============================================================
# SESSION HELPERS
# ============================================================

def make_session(session_id: str, name: str) -> dict:
    """Create a new session structure."""
    return {
        "id": session_id,
        "name": name,
        "created_at": datetime.now().isoformat(),
        "logs": [
            {
                "role": "system",
                "text": f"⚡ YUMMY\nWorkspace: {name}\nType /help to see available commands."
            }
        ],
        "chat_history": [],
        "agent_outputs": {},
        "jira_backlog": [],
        "metrics": {"tokens": 0},
        "workflow_state": "idle"
    }


def get_session(session_id: str) -> dict:
    """
    FastAPI dependency: return session or raise 404.

    Usage in router:
        session = get_session(req.session_id)
    """
    if session_id not in DB["sessions"]:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found. Create one via POST /sessions."
        )
    return DB["sessions"][session_id]


def require_repo():
    """Raise 400 if GitHub repo is not configured."""
    if not DB.get("repo_info"):
        raise HTTPException(
            status_code=400,
            detail="GitHub repo not configured. Call POST /config/setup first."
        )
    return DB["repo_info"]


def require_knowledge_base():
    """Raise 400 if knowledge base is empty."""
    kb = DB["knowledge_base"]
    if not kb["insights"]:
        raise HTTPException(
            status_code=400,
            detail="Knowledge base is empty. Call POST /kb/scan and wait for it to complete."
        )
    return kb


def require_workflow_state(session: dict, expected_state: str):
    """Raise 400 if workflow state does not match expected."""
    current = session["workflow_state"]
    if current != expected_state:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Current workflow state is '{current}', "
                f"but '{expected_state}' is required to perform this step."
            )
        )


def new_session_id() -> str:
    """Generate a unique session ID from timestamp."""
    return str(int(time.time() * 1000))
