"""
YUMMY Backend - RAG Ask Router
Endpoint: POST /ask  (streaming SSE)
          POST /ask/sync (non-streaming, kept for compatibility)
"""

import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from config import DB
from models import AskRequest
from dependencies import get_session, require_knowledge_base
from services.ai_service import call_ai, stream_ai

router = APIRouter(tags=["RAG Chat"])


def _build_rag_prompt(session: dict, kb: dict, req: AskRequest) -> tuple[str, str, dict]:
    """Build the RAG prompt and return (prompt, instruction, trace_info)."""
    retrieved_chunks = kb["insights"][:2]
    trace_info = {
        "intent": "Code Structure Query",
        "retrieval_method": "top-k (k=2)",
        "source_chunks": [
            {"files": c["files"], "summary_preview": c["summary"][:200] + "..."}
            for c in retrieved_chunks
        ],
    }

    kb_context = (
        kb["project_summary"]
        + "\n\n=== TOP INSIGHTS ===\n"
        + "\n".join(c["summary"] for c in retrieved_chunks)
    )

    file_ctx = ""
    if req.ide_file and req.ide_content:
        file_ctx = (
            f"\n\n=== FILE OPEN IN IDE: {req.ide_file} ===\n"
            f"{req.ide_content[:4000]}\n"
        )

    recent_history = session["chat_history"][-8:]
    history_str = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in recent_history)

    prompt = (
        f"=== REPO KNOWLEDGE (RAG Context) ===\n{kb_context}"
        f"{file_ctx}"
        f"\n\n=== CHAT HISTORY ===\n{history_str}"
        f"\n\n=== QUESTION ===\n{req.question}"
    )

    repo_name = (DB.get("repo_info") or {}).get("repo", "project")
    instruction = (
        f"You are a technical expert on the '{repo_name}' project. "
        "Answer the question based on the provided context. "
        "If information is insufficient, say so clearly. "
        "Reply in natural Markdown, concise and precise."
    )

    return prompt, instruction, trace_info


@router.post("/ask/free")
async def ask_free_stream(req: AskRequest):
    """
    Free-form streaming chat — no KB required. Used by /btw command.
    Same SSE protocol as /ask.
    """
    session = get_session(req.session_id)

    recent_history = session["chat_history"][-8:]
    history_str = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in recent_history)

    file_ctx = ""
    if req.ide_file and req.ide_content:
        file_ctx = f"\n\n=== FILE OPEN IN IDE: {req.ide_file} ===\n{req.ide_content[:4000]}\n"

    prompt = (
        f"{file_ctx}"
        f"\n\n=== CHAT HISTORY ===\n{history_str}"
        f"\n\n=== QUESTION ===\n{req.question}"
    )
    instruction = (
        "You are YUMMY, a helpful AI assistant for software development. "
        "Answer clearly and concisely in Markdown. "
        "You can discuss any topic — code, architecture, concepts, or general questions."
    )

    session["chat_history"].append({"role": "user", "text": req.question})

    async def event_stream():
        full_response = []
        try:
            async for chunk in stream_ai(prompt, instruction):
                full_response.append(chunk)
                safe = chunk.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
            return

        answer = "".join(full_response)
        session["chat_history"].append({"role": "assistant", "text": answer})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/ask")
async def ask_question_stream(req: AskRequest):
    """
    RAG Chat with streaming SSE response.

    The client receives a stream of Server-Sent Events:
      data: <text chunk>\\n\\n   — token chunks while generating
      data: [DONE]\\n\\n         — signals completion
      data: [TRACE] {...}\\n\\n  — RAG trace metadata (last event)

    Falls back gracefully if streaming is not supported by the active provider.
    """
    session = get_session(req.session_id)
    kb = require_knowledge_base()
    prompt, instruction, trace_info = _build_rag_prompt(session, kb, req)

    # Save user message immediately
    session["chat_history"].append({"role": "user", "text": req.question})

    async def event_stream():
        full_response = []
        try:
            async for chunk in stream_ai(prompt, instruction):
                full_response.append(chunk)
                # Escape newlines so SSE framing stays intact
                safe = chunk.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
            return

        answer = "".join(full_response)

        # Persist assistant message
        session["chat_history"].append({
            "role": "assistant",
            "text": answer,
            "trace": trace_info,
        })

        yield "data: [DONE]\n\n"
        yield f"data: [TRACE] {json.dumps(trace_info)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


@router.post("/ask/sync")
async def ask_question_sync(req: AskRequest):
    """Non-streaming fallback — returns the full answer in one JSON response."""
    session = get_session(req.session_id)
    kb = require_knowledge_base()
    prompt, instruction, trace_info = _build_rag_prompt(session, kb, req)

    answer = await call_ai("EXPERT", prompt, instruction)

    session["chat_history"].extend([
        {"role": "user", "text": req.question},
        {"role": "assistant", "text": answer, "trace": trace_info},
    ])

    return {"question": req.question, "answer": answer, "trace": trace_info, "session_id": req.session_id}
