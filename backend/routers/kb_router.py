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
    View the current knowledge base.
    Returns tree, insights and project summary.
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
    Start scanning and indexing the codebase from GitHub.

    - Runs in the background (non-blocking)
    - Poll GET /kb/scan/status to track progress
    - Results are stored and accessible via GET /kb

    Requires POST /config/setup to be called first.
    """
    require_repo()

    if DB.get("scan_status") and DB["scan_status"].get("running"):
        raise HTTPException(
            409,
            "Scan is already running. Poll GET /kb/scan/status to track progress."
        )

    background_tasks.add_task(run_scan)
    return {
        "status": "started",
        "message": "Scan started in background. Poll GET /kb/scan/status to track progress."
    }


@router.get("/scan/status")
def get_scan_status():
    """
    Check the current scan progress.

    Response:
    - running: bool
    - text: description of the current step
    - progress: 0-100
    - error: true if an error occurred
    """
    return DB.get("scan_status") or {
        "running": False,
        "text": "No scan has been started yet.",
        "progress": 0
    }


@router.get("/file")
async def get_file_content(path: str):
    """
    View the content of a file in the repo (IDE Simulator).

    Query param:
        path: File path, e.g. src/main.py
    """
    ri = require_repo()

    repo_resp = await github_fetch(f"/repos/{ri['owner']}/{ri['repo']}")
    if repo_resp.status_code != 200:
        raise HTTPException(502, "Unable to connect to GitHub API.")
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
    Clear the entire knowledge base (tree, insights, summary).
    Use this before re-scanning from scratch.
    """
    DB["knowledge_base"] = {"tree": [], "insights": [], "project_summary": ""}
    DB["scan_status"] = None
    return {"status": "ok", "message": "Knowledge base cleared."}
