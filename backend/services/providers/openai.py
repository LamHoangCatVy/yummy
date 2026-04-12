"""
OpenAI provider — blocking and streaming.
Uses the Chat Completions REST API directly via httpx.
"""

import json
from typing import AsyncGenerator
import httpx
from fastapi import HTTPException

from config import API_CONFIG

_BASE = "https://api.openai.com/v1/chat/completions"


def _headers() -> dict:
    key = API_CONFIG.get("openai_key", "")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="OPENAI_API_KEY is not configured. Set it in Settings or via the OPENAI_API_KEY env var.",
        )
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _model() -> str:
    return API_CONFIG.get("openai_model", "gpt-4o")


async def call_openai(agent_role: str, prompt: str, instruction: str):
    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(_BASE, json=payload, headers=_headers())
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"OpenAI error {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return text, usage.get("prompt_tokens"), usage.get("completion_tokens")


async def stream_openai(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": _model(),
        "stream": True,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", _BASE, json=payload, headers=_headers()) as resp:
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"OpenAI stream error {resp.status_code}")
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        token = json.loads(data_str)["choices"][0].get("delta", {}).get("content", "")
                        if token:
                            yield token
                    except Exception:
                        pass
