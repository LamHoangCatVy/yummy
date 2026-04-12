"""
Google Gemini provider — blocking and streaming.
Uses the official google-genai SDK.
"""

from typing import AsyncGenerator
from fastapi import HTTPException
from google import genai
from google.genai import types

from config import API_CONFIG

_DEFAULT_MODEL = "gemini-2.5-flash"


def _client() -> genai.Client:
    key = API_CONFIG.get("gemini_key", "")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is not configured. Set it in Settings or via the GEMINI_API_KEY env var.",
        )
    return genai.Client(api_key=key)


def _model() -> str:
    return API_CONFIG.get("gemini_model") or _DEFAULT_MODEL


async def call_gemini(agent_role: str, prompt: str, instruction: str):
    """Returns (text: str, usage_metadata)."""
    client = _client()
    try:
        response = await client.aio.models.generate_content(
            model=_model(),
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=instruction),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")
    return response.text or "", response.usage_metadata


async def stream_gemini(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    client = _client()
    try:
        # generate_content_stream returns an async iterator — do NOT await it
        async for chunk in client.aio.models.generate_content_stream(
            model=_model(),
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=instruction),
        ):
            if chunk.text:
                yield chunk.text
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini stream error: {e}")
