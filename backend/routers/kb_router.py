"""
YUMMY Backend - Knowledge Base Router
Endpoints: /kb/*
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from config import DB
from dependencies import require_repo
from services.scan_service import run_scan
from services.github_service import github_fetch, github_raw

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


@router.get("")
def get_knowledge_base():
    """
    Xem knowledge base hiện tại.
    Trả về tree, insights và project summary.
    """
    kb = DB["knowledge_base"]
    return {
        "file_count": len(kb["tree"]),
        "insight_count": len(kb["insights"]),
        "has_summary": bool(kb["project_summary"]),
        "tree": kb["tree"],
        "insights": kb["insights"],
        "project_summary": kb["project_summary"]
    }


@router.post("/scan")
async def start_scan(background_tasks: BackgroundTasks):
    """
    Bắt đầu quét và index codebase từ GitHub.
    
    - Chạy background (non-blocking)
    - Poll GET /kb/scan/status để theo dõi tiến trình
    - Kết quả lưu vào GET /kb
    
    Cần chạy POST /config/setup trước.
    """
    require_repo()

    if DB.get("scan_status") and DB["scan_status"].get("running"):
        raise HTTPException(
            409,
            "Scan đang chạy. Poll GET /kb/scan/status để theo dõi, hoặc đợi hoàn tất."
        )

    background_tasks.add_task(run_scan)
    return {
        "status": "started",
        "message": "Scan đang chạy background. Poll GET /kb/scan/status để theo dõi."
    }


@router.get("/scan/status")
def get_scan_status():
    """
    Kiểm tra tiến trình scan hiện tại.
    
    Response:
    - running: bool
    - text: mô tả bước đang làm
    - progress: 0-100
    - error: true nếu có lỗi
    """
    return DB.get("scan_status") or {
        "running": False,
        "text": "Chưa có scan nào được khởi động.",
        "progress": 0
    }


@router.get("/file")
async def get_file_content(path: str):
    """
    Xem nội dung của một file trong repo (IDE Simulator).
    
    Query param:
        path: Đường dẫn file, ví dụ: src/main.py
    """
    ri = require_repo()

    # Lấy default branch
    repo_resp = await github_fetch(f"/repos/{ri['owner']}/{ri['repo']}")
    if repo_resp.status_code != 200:
        raise HTTPException(502, "Không thể kết nối GitHub API.")
    branch = repo_resp.json().get("default_branch", "main")

    content = await github_raw(ri["owner"], ri["repo"], branch, path)
    return {
        "path": path,
        "content": content,
        "branch": branch,
        "repo": f"{ri['owner']}/{ri['repo']}"
    }


@router.delete("")
def clear_knowledge_base():
    """
    Xóa toàn bộ knowledge base (tree, insights, summary).
    Dùng trước khi scan lại từ đầu.
    """
    DB["knowledge_base"] = {"tree": [], "insights": [], "project_summary": ""}
    DB["scan_status"] = None
    return {"status": "ok", "message": "Knowledge base đã được xóa."}
