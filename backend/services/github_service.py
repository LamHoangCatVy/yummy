"""
YUMMY Backend - GitHub Service
Wrapper cho GitHub REST API và raw content fetching.
"""

import httpx
from fastapi import HTTPException
from config import DB


# ============================================================
# INTERNAL HELPERS
# ============================================================

def _get_headers() -> dict:
    """Trả về auth header nếu có GitHub token."""
    token = DB.get("github_token", "")
    if token:
        return {"Authorization": f"token {token}"}
    return {}


# ============================================================
# PUBLIC API
# ============================================================

async def github_fetch(path: str) -> httpx.Response:
    """
    Gọi GitHub REST API.
    
    Args:
        path: Đường dẫn API, ví dụ "/repos/owner/repo"
    
    Returns:
        httpx.Response object (caller tự xử lý .json())
    """
    headers = _get_headers()
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.get(f"https://api.github.com{path}", headers=headers)


async def github_raw(owner: str, repo: str, branch: str, file_path: str) -> str:
    """
    Lấy nội dung raw của một file từ GitHub.
    
    Args:
        owner:     GitHub username hoặc org name
        repo:      Tên repo
        branch:    Branch name (main, master, develop, ...)
        file_path: Đường dẫn file trong repo (ví dụ: "src/index.ts")
    
    Returns:
        Nội dung file dưới dạng string.
    
    Raises:
        HTTPException 404 nếu file không tồn tại hoặc không thể đọc.
    """
    headers = _get_headers()
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            raise HTTPException(
                status_code=404,
                detail=f"Không thể đọc file '{file_path}' từ GitHub (status: {r.status_code})."
            )
        return r.text


async def get_repo_info(owner: str, repo: str) -> dict:
    """
    Lấy metadata của repo (default_branch, description, v.v.).
    
    Returns:
        dict repo data từ GitHub API.
    
    Raises:
        Exception nếu repo không tồn tại hoặc không có quyền truy cập.
    """
    resp = await github_fetch(f"/repos/{owner}/{repo}")
    if resp.status_code != 200:
        error_msg = resp.json().get("message", "Lỗi không xác định")
        raise Exception(f"GitHub API: {error_msg} (status: {resp.status_code})")
    return resp.json()


async def get_repo_tree(owner: str, repo: str, branch: str) -> list:
    """
    Lấy toàn bộ file tree của repo (recursive).
    
    Returns:
        List các file objects: [{"path": "...", "type": "blob|tree", "size": int}, ...]
    """
    resp = await github_fetch(
        f"/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    )
    if resp.status_code != 200:
        raise Exception(f"Không thể lấy file tree: {resp.status_code}")
    return resp.json().get("tree", [])
