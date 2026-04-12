"""
YUMMY Backend - Sessions Router
Endpoints: /sessions/*
"""

from fastapi import APIRouter
from config import DB
from models import NewSessionRequest
from dependencies import make_session, get_session, new_session_id

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("")
def create_session(req: NewSessionRequest):
    """
    Create a new workspace/session.
    The returned session_id is used for all subsequent requests related to this session.
    """
    sid = new_session_id()
    name = req.name or f"Session {len(DB['sessions']) + 1}"
    DB["sessions"][sid] = make_session(sid, name)
    return DB["sessions"][sid]


@router.get("")
def list_sessions():
    """List all sessions (name, id, created_at, workflow_state)."""
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "created_at": s["created_at"],
            "workflow_state": s["workflow_state"],
        }
        for s in DB["sessions"].values()
    ]


@router.get("/{session_id}")
def get_session_detail(session_id: str):
    """Get full details of a session (logs, chat_history, agent_outputs, ...)."""
    return get_session(session_id)


@router.delete("/{session_id}")
def delete_session(session_id: str):
    """Delete a session."""
    get_session(session_id)  # Raises 404 if not found
    del DB["sessions"][session_id]
    return {"status": "deleted", "session_id": session_id}


@router.post("/{session_id}/reset")
def reset_session_workflow(session_id: str):
    """
    Reset workflow state to 'idle' (does not clear chat history).
    Use this to start a new CR within the same session.
    """
    session = get_session(session_id)
    session["workflow_state"] = "idle"
    return {"status": "ok", "workflow_state": "idle"}
