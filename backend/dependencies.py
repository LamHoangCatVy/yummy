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
    """Tạo cấu trúc session mới."""
    return {
        "id": session_id,
        "name": name,
        "created_at": datetime.now().isoformat(),
        "logs": [
            {
                "role": "system",
                "text": f"⚡ YUMMY.better than your ex\nWorkspace: {name}\nGõ /help để xem lệnh."
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
    FastAPI dependency: trả về session hoặc raise 404.
    
    Usage trong router:
        session = get_session(req.session_id)
    """
    if session_id not in DB["sessions"]:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' không tồn tại. Tạo mới qua POST /sessions."
        )
    return DB["sessions"][session_id]



def require_repo():
    """Raise 400 nếu chưa setup GitHub repo."""
    if not DB.get("repo_info"):
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình GitHub repo. Gọi POST /config/setup trước."
        )
    return DB["repo_info"]


def require_knowledge_base():
    """Raise 400 nếu chưa có knowledge base."""
    kb = DB["knowledge_base"]
    if not kb["insights"]:
        raise HTTPException(
            status_code=400,
            detail="Knowledge base trống. Gọi POST /kb/scan và đợi hoàn tất trước."
        )
    return kb


def require_workflow_state(session: dict, expected_state: str):
    """Raise 400 nếu workflow state không đúng."""
    current = session["workflow_state"]
    if current != expected_state:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Workflow state hiện tại là '{current}', "
                f"cần '{expected_state}' để thực hiện bước này."
            )
        )


def new_session_id() -> str:
    """Generate unique session ID từ timestamp."""
    return str(int(time.time() * 1000))

