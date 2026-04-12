"""
YUMMY Backend - Scan Service
Background task to index a codebase from GitHub into the knowledge base.
"""

import os
import time
from config import DB, ALLOWED_EXTENSIONS
from services.ai_service import call_ai
from services.github_service import get_repo_info, get_repo_tree, github_raw


async def run_scan():
    """
    Background task: scan a GitHub repo, generate AI insights and a project wiki.

    Flow:
        1. Fetch repo metadata (default branch)
        2. Fetch file tree, filter by extension and exclude node_modules
        3. Read each file, group into ~35KB chunks
        4. Each chunk -> INDEXER agent summarizes
        5. All insights -> ARCHITECT agent writes Project Wiki

    Poll status via GET /kb/scan/status.
    """
    DB["scan_status"] = {"running": True, "text": "Connecting to GitHub API...", "progress": 0}
    DB["knowledge_base"] = {"tree": [], "insights": [], "project_summary": ""}

    try:
        ri = DB["repo_info"]
        max_limit = DB.get("max_scan_limit", 10000)

        # --- Step 1: Fetch repo metadata ---
        DB["scan_status"]["text"] = "Reading repo info..."
        repo_data = await get_repo_info(ri["owner"], ri["repo"])
        branch = repo_data["default_branch"]
        DB["repo_info"]["branch"] = branch

        # --- Step 2: Fetch file tree ---
        DB["scan_status"]["text"] = "Fetching file list..."
        all_files = await get_repo_tree(ri["owner"], ri["repo"], branch)

        valid_files = [
            f for f in all_files
            if f["type"] == "blob"
            and "node_modules" not in f["path"]
            and ".git" not in f["path"]
            and os.path.splitext(f["path"])[1].lower() in ALLOWED_EXTENSIONS
        ][:max_limit]

        if not valid_files:
            DB["scan_status"] = {
                "running": False,
                "text": "No matching files found in the repo.",
                "progress": 0,
                "error": True
            }
            return

        # Initialize tree with "pending" status
        DB["knowledge_base"]["tree"] = [
            {
                "path": f["path"],
                "name": f["path"].split("/")[-1],
                "status": "pending"
            }
            for f in valid_files
        ]

        # --- Steps 3 & 4: Read files in chunks, AI summarizes ---
        current_chunk = ""
        files_in_chunk = []
        insights = []
        total = len(valid_files)

        for i, file in enumerate(valid_files):
            progress = round((i / total) * 80)
            DB["scan_status"] = {
                "running": True,
                "text": f"Indexing [{file['path']}] ({i + 1}/{total})",
                "progress": progress
            }

            _update_tree_status(file["path"], "processing")

            try:
                content = await github_raw(ri["owner"], ri["repo"], branch, file["path"])
                current_chunk += f"\n--- FILE: {file['path']} ---\n{content}\n"
                files_in_chunk.append(file["path"])
            except Exception:
                # Skip files that cannot be read (binary, too large, etc.)
                pass

            _update_tree_status(file["path"], "done")

            # Flush chunk if large enough or last file
            chunk_ready = len(current_chunk) >= 35_000 or i == total - 1
            if chunk_ready and current_chunk.strip() and files_in_chunk:
                DB["scan_status"]["text"] = (
                    f"AI indexing chunk of {len(files_in_chunk)} files... "
                    f"({len(insights) + 1} insights so far)"
                )

                summary = await call_ai(
                    "INDEXER",
                    f"Summarize the code logic:\n{current_chunk}",
                    (
                        "You are a code indexer. Briefly summarize the functionality, "
                        "patterns and dependencies of these files. "
                        "Do NOT wrap the entire output in a Markdown code block."
                    )
                )

                insight = {
                    "id": int(time.time() * 1000) + i,
                    "files": list(files_in_chunk),
                    "summary": summary
                }
                insights.append(insight)
                DB["knowledge_base"]["insights"] = list(insights)

                current_chunk = ""
                files_in_chunk = []

        # --- Step 5: Project Wiki ---
        DB["scan_status"] = {
            "running": True,
            "text": "Writing Project Wiki (Project Summary)...",
            "progress": 90
        }

        all_insights_str = "\n\n".join(ins["summary"] for ins in insights)
        project_summary = await call_ai(
            "ARCHITECT",
            f"Based on these technical summaries:\n{all_insights_str}",
            (
                f"You are the Chief Architect of the '{ri['repo']}' project. "
                "Write a PROJECT SUMMARY in GitBook style with the following sections:\n"
                "# Introduction\n"
                "## Core Components\n"
                "## Key Functions & APIs\n"
                "## Data Models\n"
                "## Security Considerations\n"
                "## Deployment & Infrastructure\n"
                "Use clean Markdown formatting. "
                "Do NOT wrap the entire output in a ```markdown block. "
                "Do NOT fabricate any information."
            )
        )

        DB["knowledge_base"]["project_summary"] = project_summary
        DB["scan_status"] = {
            "running": False,
            "text": f"Scan complete. Indexed {total} files, generated {len(insights)} insights.",
            "progress": 100
        }

    except Exception as e:
        DB["scan_status"] = {
            "running": False,
            "text": f"Scan error: {str(e)}",
            "progress": 0,
            "error": True
        }


def _update_tree_status(file_path: str, status: str):
    """Helper: update the status of a file in knowledge_base.tree."""
    for f in DB["knowledge_base"]["tree"]:
        if f["path"] == file_path:
            f["status"] = status
            break
