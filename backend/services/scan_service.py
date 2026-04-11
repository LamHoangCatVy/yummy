"""
YUMMY Backend - Scan Service
Background task để index codebase từ GitHub vào knowledge base.
"""

import os
import time
from config import DB, ALLOWED_EXTENSIONS
from services.ai_service import call_ai
from services.github_service import get_repo_info, get_repo_tree, github_raw


async def run_scan():
    """
    Background task: quét GitHub repo, tạo AI insights và project wiki.
    
    Flow:
        1. Lấy repo metadata (default branch)
        2. Lấy file tree, filter extensions + node_modules
        3. Đọc từng file, gộp thành chunks ~35KB
        4. Mỗi chunk → INDEXER agent tóm tắt
        5. Tất cả insights → ARCHITECT agent viết Project Wiki
    
    Poll status qua GET /kb/scan/status.
    """
    DB["scan_status"] = {"running": True, "text": "Kết nối GitHub API...", "progress": 0}
    DB["knowledge_base"] = {"tree": [], "insights": [], "project_summary": ""}

    try:
        ri = DB["repo_info"]
        max_limit = DB.get("max_scan_limit", 10000)

        # --- Step 1: Lấy repo metadata ---
        DB["scan_status"]["text"] = "Đọc thông tin repo..."
        repo_data = await get_repo_info(ri["owner"], ri["repo"])
        branch = repo_data["default_branch"]
        DB["repo_info"]["branch"] = branch  # cache branch để dùng sau

        # --- Step 2: Lấy file tree ---
        DB["scan_status"]["text"] = "Lấy danh sách files..."
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
                "text": "⚠️ Không tìm thấy file nào phù hợp trong repo.",
                "progress": 0,
                "error": True
            }
            return

        # Khởi tạo tree với status "pending"
        DB["knowledge_base"]["tree"] = [
            {
                "path": f["path"],
                "name": f["path"].split("/")[-1],
                "status": "pending"
            }
            for f in valid_files
        ]

        # --- Step 3 & 4: Đọc file theo chunks, AI tóm tắt ---
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

            # Update tree status → processing
            _update_tree_status(file["path"], "processing")

            try:
                content = await github_raw(ri["owner"], ri["repo"], branch, file["path"])
                current_chunk += f"\n--- FILE: {file['path']} ---\n{content}\n"
                files_in_chunk.append(file["path"])
            except Exception:
                # Skip file không đọc được (binary, quá lớn, v.v.)
                pass

            # Update tree status → done
            _update_tree_status(file["path"], "done")

            # Flush chunk nếu đủ lớn hoặc là file cuối
            chunk_ready = len(current_chunk) >= 35_000 or i == total - 1
            if chunk_ready and current_chunk.strip() and files_in_chunk:
                DB["scan_status"]["text"] = (
                    f"AI đang vector hóa cụm {len(files_in_chunk)} file... "
                    f"({len(insights) + 1} insight)"
                )

                summary = await call_ai(
                    "INDEXER",
                    f"Tóm tắt logic code:\n{current_chunk}",
                    (
                        "Bạn là code indexer. Tóm tắt ngắn gọn chức năng, "
                        "patterns và dependencies của các file này. "
                        "KHÔNG bọc toàn bộ trong thẻ Markdown Code Block."
                    )
                )

                insight = {
                    "id": int(time.time() * 1000) + i,
                    "files": list(files_in_chunk),
                    "summary": summary
                }
                insights.append(insight)
                DB["knowledge_base"]["insights"] = list(insights)

                # Reset chunk
                current_chunk = ""
                files_in_chunk = []

        # --- Step 5: Project Wiki ---
        DB["scan_status"] = {
            "running": True,
            "text": "Đang viết Corporate Wiki (Project Summary)...",
            "progress": 90
        }

        all_insights_str = "\n\n".join(ins["summary"] for ins in insights)
        project_summary = await call_ai(
            "ARCHITECT",
            f"Dựa vào các mảnh ghép kỹ thuật này:\n{all_insights_str}",
            (
                f"Bạn là Chief Architect của dự án '{ri['repo']}'. "
                "Viết PROJECT SUMMARY chuẩn GitBook bao gồm các mục:\n"
                "# 📖 Introduction\n"
                "## 🧩 Core Components\n"
                "## ⚙️ Key Functions & APIs\n"
                "## 🗄️ Data Models\n"
                "## 🔐 Security Considerations\n"
                "## 🚀 Deployment & Infrastructure\n"
                "Trình bày Markdown sắc nét. "
                "BẮT BUỘC KHÔNG bọc toàn bộ kết quả trong thẻ ```markdown. "
                "TUYỆT ĐỐI KHÔNG bịa đặt thông tin."
            )
        )

        DB["knowledge_base"]["project_summary"] = project_summary
        DB["scan_status"] = {
            "running": False,
            "text": f"✅ Quét hoàn tất. Đã index {total} files, tạo {len(insights)} insights.",
            "progress": 100
        }

    except Exception as e:
        DB["scan_status"] = {
            "running": False,
            "text": f"❌ Lỗi Scan: {str(e)}",
            "progress": 0,
            "error": True
        }


def _update_tree_status(file_path: str, status: str):
    """Helper: cập nhật status của file trong knowledge_base.tree."""
    for f in DB["knowledge_base"]["tree"]:
        if f["path"] == file_path:
            f["status"] = status
            break
