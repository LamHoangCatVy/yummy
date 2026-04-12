"""
GitHub Copilot provider — blocking + streaming via event-driven SDK.
Uses the github-copilot-sdk async client.
"""

import os
import asyncio
from typing import AsyncGenerator
from fastapi import HTTPException

from config import API_CONFIG


def _token() -> str:
    token = API_CONFIG.get("copilot_token", "")
    if not token:
        raise HTTPException(
            status_code=400,
            detail="COPILOT_GITHUB_TOKEN is not configured. Set it in Settings or via the COPILOT_GITHUB_TOKEN env var.",
        )
    return token


def _model() -> str:
    return API_CONFIG.get("copilot_model", "gpt-4o")


async def stream_copilot(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    """
    Streaming via Copilot SDK.
    Events from the SDK are pushed into an asyncio.Queue by a background task.
    The generator consumes from the queue until it receives the None sentinel.
    """
    token = _token()
    model = _model()

    try:
        from copilot import CopilotClient
        from copilot.session import PermissionHandler
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="github-copilot-sdk is not installed. Run: pip install github-copilot-sdk",
        )

    os.environ["COPILOT_GITHUB_TOKEN"] = token

    loop  = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _run_session():
        try:
            async with CopilotClient() as client:
                async with await client.create_session(
                    on_permission_request=PermissionHandler.approve_all,
                    model=model,
                    system_message={"role": "system", "content": instruction},
                ) as session:

                    idle_event = asyncio.Event()

                    def on_event(event):
                        ev = event.type.value if hasattr(event.type, "value") else str(event.type)
                        if ev in ("assistant.message", "assistant.message.delta"):
                            content = getattr(event.data, "content", "") or ""
                            if content:
                                loop.call_soon_threadsafe(queue.put_nowait, content)
                        elif ev == "session.idle":
                            loop.call_soon_threadsafe(idle_event.set)

                    session.on(on_event)
                    await session.send(prompt)

                    # Wait for the idle signal (up to 120s)
                    try:
                        await asyncio.wait_for(idle_event.wait(), timeout=120)
                    except asyncio.TimeoutError:
                        pass

        except asyncio.CancelledError:
            pass
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, f"[COPILOT_ERROR] {e}")
        finally:
            # Always push sentinel so the consumer unblocks
            loop.call_soon_threadsafe(queue.put_nowait, None)

    task = asyncio.ensure_future(_run_session())

    try:
        while True:
            chunk = await asyncio.wait_for(queue.get(), timeout=125)
            if chunk is None:
                break
            if chunk.startswith("[COPILOT_ERROR]"):
                raise HTTPException(status_code=502, detail=chunk[15:].strip())
            yield chunk
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Copilot session timed out.")
    finally:
        task.cancel()


async def call_copilot(agent_role: str, prompt: str, instruction: str) -> str:
    """Blocking call — collects all streamed chunks."""
    chunks: list[str] = []
    async for chunk in stream_copilot(prompt, instruction):
        chunks.append(chunk)
    return "".join(chunks)
