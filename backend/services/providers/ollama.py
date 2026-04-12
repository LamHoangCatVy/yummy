"""
Ollama provider — blocking and streaming.
Talks to a locally running Ollama server via its REST API.
"""

import json
from typing import AsyncGenerator
import httpx
from fastapi import HTTPException

from config import API_CONFIG


def _base_url() -> str:
    return API_CONFIG.get("ollama_base_url", "http://localhost:11434")


def _model() -> str:
    return API_CONFIG.get("ollama_model", "llama3")


async def call_ollama(agent_role: str, prompt: str, instruction: str):
    model = _model()
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{_base_url()}/api/chat", json=payload)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Ollama error {resp.status_code}: {resp.text[:300]}\n"
                    f"Make sure Ollama is running (`ollama serve`) and the model is pulled (`ollama pull {model}`)."
                ),
            )
        data = resp.json()
    return data.get("message", {}).get("content", "")


async def stream_ollama(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": _model(),
        "stream": True,
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", f"{_base_url()}/api/chat", json=payload) as resp:
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Ollama stream error {resp.status_code}")
            async for line in resp.aiter_lines():
                if line:
                    try:
                        token = json.loads(line).get("message", {}).get("content", "")
                        if token:
                            yield token
                    except Exception:
                        pass
