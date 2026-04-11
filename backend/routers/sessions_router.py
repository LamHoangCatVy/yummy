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
    Tạo workspace/session mới.
    session_id trả về dùng cho tất cả các request liên quan đến session này.
    """
    sid = new_session_id()
    name = req.name or f"Session {len(DB['sessions']) + 1}"
    DB["sessions"][sid] = make_session(sid, name)
    return DB["sessions"][sid]


@router.get("")
def list_sessions():
    """Liệt kê tất cả sessions (tên, id, created_at, workflow_state)."""
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
    """Xem chi tiết đầy đủ của một session (logs, chat_history, agent_outputs, ...)."""
    return get_session(session_id)


@router.delete("/{session_id}")
def delete_session(session_id: str):
    """Xóa session."""
    get_session(session_id)  # Raises 404 nếu không tồn tại
    del DB["sessions"][session_id]
    return {"status": "deleted", "session_id": session_id}


@router.post("/{session_id}/reset")
def reset_session_workflow(session_id: str):
    """
    Reset workflow state về 'idle' (không xóa chat history).
    Dùng khi muốn bắt đầu CR mới trong cùng session.
    """
    session = get_session(session_id)
    session["workflow_state"] = "idle"
    session["agent_outputs"] = {}
    session["jira_backlog"] = []
    return {"status": "ok", "message": "Workflow reset về idle."}
