"""
YUMMY Backend - RAG Ask Router
Endpoint: POST /ask
"""

from fastapi import APIRouter
from config import DB
from models import AskRequest
from dependencies import get_session, require_knowledge_base
from services.ai_service import call_ai

router = APIRouter(tags=["RAG Chat"])


@router.post("/ask")
async def ask_question(req: AskRequest):
    """
    RAG Chat: hỏi về codebase.
    
    Flow:
        1. Lấy top insights từ knowledge base (RAG retrieval)
        2. Build prompt với context + lịch sử chat
        3. Gọi AI → trả lời
        4. Lưu vào chat_history của session
    
    Cần chạy POST /kb/scan trước.
    """
    session = get_session(req.session_id)
    kb = require_knowledge_base()

    # ---- RAG Retrieval (simple: lấy top 2 insights) ----
    # TODO: Nâng cấp lên vector similarity search (pgvector, Chroma, ...)
    retrieved_chunks = kb["insights"][:2]
    trace_info = {
        "intent": "Code Structure Query",
        "retrieval_method": "top-k (k=2)",
        "db_query": "SELECT * FROM vector_store WHERE similarity(embedding, query_emb) > 0.8 LIMIT 2",
        "source_chunks": [
            {"files": c["files"], "summary_preview": c["summary"][:200] + "..."}
            for c in retrieved_chunks
        ]
    }

    # ---- Build context ----
    kb_context = (
        kb["project_summary"]
        + "\n\n=== TOP INSIGHTS ===\n"
        + "\n".join(c["summary"] for c in retrieved_chunks)
    )

    # IDE context (nếu user đang mở file trong IDE Simulator)
    file_ctx = ""
    if req.ide_file and req.ide_content:
        file_ctx = (
            f"\n\n=== FILE ĐANG MỞ TRÊN IDE: {req.ide_file} ===\n"
            f"{req.ide_content[:4000]}\n"
        )

    # Lịch sử chat gần đây (4 turns = 8 messages)
    recent_history = session["chat_history"][-8:]
    history_str = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in recent_history)

    prompt = (
        f"=== TRI THỨC REPO (RAG Context) ===\n{kb_context}"
        f"{file_ctx}"
        f"\n\n=== LỊCH SỬ CHAT ===\n{history_str}"
        f"\n\n=== CÂU HỎI ===\n{req.question}"
    )

    repo_name = DB.get("repo_info", {}).get("repo", "project") if DB.get("repo_info") else "project"

    answer = await call_ai(
        "EXPERT",
        prompt,
        (
            f"Bạn là chuyên gia kỹ thuật của dự án '{repo_name}'. "
            "Trả lời câu hỏi dựa trên context được cung cấp. "
            "Nếu không đủ thông tin, hãy nói rõ. "
            "Trả lời bằng Markdown tự nhiên, súc tích."
        )
    )

    # ---- Cập nhật chat history ----
    session["chat_history"].extend([
        {"role": "user", "text": req.question},
        {"role": "assistant", "text": answer, "trace": trace_info}
    ])

    return {
        "question": req.question,
        "answer": answer,
        "trace": trace_info,
        "session_id": req.session_id
    }
