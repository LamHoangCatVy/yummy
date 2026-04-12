"""
YUMMY Backend - AI Service
Orchestrates provider selection for both blocking and streaming calls.

Blocking:   call_ai(agent_role, prompt, instruction) -> str
Streaming:  stream_ai(prompt, instruction) -> AsyncGenerator[str, None]

Provider implementations live in services/providers/:
  gemini.py   — Google Gemini (google-genai SDK)
  openai.py   — OpenAI Chat Completions (httpx)
  ollama.py   — Ollama local server (httpx)
  copilot.py  — GitHub Copilot SDK (no token streaming)
  bedrock.py  — AWS Bedrock Converse API (boto3, no token streaming)
"""

import time
from datetime import datetime
from typing import AsyncGenerator

from config import DB, API_CONFIG
from services.providers.gemini  import call_gemini,  stream_gemini
from services.providers.openai  import call_openai,  stream_openai
from services.providers.ollama  import call_ollama,  stream_ollama
from services.providers.copilot import call_copilot, stream_copilot
from services.providers.bedrock import call_bedrock, stream_bedrock


# ─── Per-provider pricing (USD per 1M tokens, April 2026) ────────────────────

PRICING: dict[str, dict[str, float]] = {
    # Gemini
    "gemini-2.5-pro":           {"in": 1.25,  "out": 10.00},
    "gemini-2.5-flash":         {"in": 0.075, "out": 0.30},
    "gemini-2.5-flash-lite":    {"in": 0.025, "out": 0.10},
    "gemini-3.1-flash-preview": {"in": 0.075, "out": 0.30},
    # OpenAI GPT-5 family
    "gpt-5.2":      {"in": 1.75,  "out": 14.00},
    "gpt-5.1":      {"in": 1.25,  "out": 10.00},
    "gpt-5":        {"in": 1.25,  "out": 10.00},
    "gpt-5-mini":   {"in": 0.25,  "out": 2.00},
    "gpt-5-nano":   {"in": 0.05,  "out": 0.40},
    # OpenAI GPT-4.1 family
    "gpt-4.1":      {"in": 2.00,  "out": 8.00},
    "gpt-4.1-mini": {"in": 0.40,  "out": 1.60},
    "gpt-4.1-nano": {"in": 0.10,  "out": 0.40},
    # OpenAI legacy
    "gpt-4o":       {"in": 2.50,  "out": 10.00},
    "gpt-4o-mini":  {"in": 0.15,  "out": 0.60},
    # OpenAI o-series
    "o1":           {"in": 15.00, "out": 60.00},
    "o1-mini":      {"in": 1.10,  "out": 4.40},
    "o3":           {"in": 2.00,  "out": 8.00},
    "o3-mini":      {"in": 0.50,  "out": 2.00},
    "o4-mini":      {"in": 1.10,  "out": 4.40},
    # Bedrock — Anthropic Claude
    "anthropic.claude-opus-4-6-v1:0":            {"in": 15.00, "out": 75.00},
    "anthropic.claude-sonnet-4-5-v1:0":          {"in": 3.00,  "out": 15.00},
    "anthropic.claude-3-5-sonnet-20241022-v2:0": {"in": 3.00,  "out": 15.00},
    "anthropic.claude-3-5-haiku-20241022-v1:0":  {"in": 0.80,  "out": 4.00},
    "anthropic.claude-3-haiku-20240307-v1:0":    {"in": 0.25,  "out": 1.25},
    # Bedrock — Amazon Nova
    "amazon.nova-premier-v1:0": {"in": 2.00,  "out": 15.00},
    "amazon.nova-pro-v1:0":     {"in": 0.80,  "out": 3.20},
    "amazon.nova-lite-v1:0":    {"in": 0.06,  "out": 0.24},
    "amazon.nova-micro-v1:0":   {"in": 0.035, "out": 0.14},
    # Bedrock — Meta Llama
    "meta.llama4-maverick-17b-instruct-v1:0": {"in": 0.24, "out": 0.97},
    "meta.llama4-scout-17b-instruct-v1:0":    {"in": 0.17, "out": 0.66},
    "meta.llama3-70b-instruct-v1:0":          {"in": 0.99, "out": 0.99},
    # Bedrock — Mistral
    "mistral.mistral-large-2-v1:0": {"in": 3.00, "out": 9.00},
    # Copilot models (billed per seat — proxy pricing for display)
    "gpt-5-codex":       {"in": 1.25,  "out": 10.00},
    "claude-opus-4-6":   {"in": 15.00, "out": 75.00},
    "claude-sonnet-4-5": {"in": 3.00,  "out": 15.00},
}

_DEFAULTS: dict[str, dict[str, float]] = {
    "gemini":  {"in": 0.075, "out": 0.30},
    "openai":  {"in": 1.25,  "out": 10.00},
    "bedrock": {"in": 3.00,  "out": 15.00},
    "copilot": {"in": 1.25,  "out": 10.00},
    "ollama":  {"in": 0.0,   "out": 0.0},
}


def _get_price(provider: str, model: str) -> dict[str, float]:
    return PRICING.get(model) or _DEFAULTS.get(provider, {"in": 0.0, "out": 0.0})


# ─── Token estimation ─────────────────────────────────────────────────────────

def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


# ─── Request tracker ──────────────────────────────────────────────────────────

def _track(
    agent_role: str,
    prompt: str,
    instruction: str,
    result_text: str,
    latency: float,
    in_tokens: int | None = None,
    out_tokens: int | None = None,
) -> None:
    if in_tokens is None:
        in_tokens = _estimate_tokens(prompt + instruction)
    if out_tokens is None:
        out_tokens = _estimate_tokens(result_text)

    provider = API_CONFIG.get("provider", "gemini")
    model    = API_CONFIG.get(f"{provider}_model", "")
    price    = _get_price(provider, model)
    cost     = (in_tokens / 1_000_000 * price["in"]) + (out_tokens / 1_000_000 * price["out"])

    DB["request_logs"].insert(0, {
        "id": int(time.time() * 1000),
        "time": datetime.now().strftime("%H:%M:%S"),
        "agent": agent_role,
        "provider": provider,
        "model": model,
        "in_tokens": in_tokens,
        "out_tokens": out_tokens,
        "latency": round(latency, 2),
        "cost": round(cost, 6),
    })

    # Accumulate total cost
    DB["total_cost_usd"] = round(DB.get("total_cost_usd", 0.0) + cost, 6)


# ─── Public: blocking call ────────────────────────────────────────────────────

async def call_ai(agent_role: str, prompt: str, instruction: str) -> str:
    """Blocking AI call. Checks cost limit before proceeding."""
    limit = DB.get("cost_limit_usd", 300.0)
    spent = DB.get("total_cost_usd", 0.0)
    if spent >= limit:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=402,
            detail=f"Demo credit limit of ${limit:.0f} reached (spent ${spent:.2f}). Contact the admin to continue.",
        )

    provider = API_CONFIG.get("provider", "gemini")
    start = time.time()
    in_tokens = out_tokens = None

    if provider == "gemini":
        text, usage = await call_gemini(agent_role, prompt, instruction)
        in_tokens  = getattr(usage, "prompt_token_count", None)
        out_tokens = getattr(usage, "candidates_token_count", None)
    elif provider == "openai":
        text, in_tokens, out_tokens = await call_openai(agent_role, prompt, instruction)
    elif provider == "ollama":
        text = await call_ollama(agent_role, prompt, instruction)
    elif provider == "copilot":
        text = await call_copilot(agent_role, prompt, instruction)
    elif provider == "bedrock":
        text, in_tokens, out_tokens = await call_bedrock(agent_role, prompt, instruction)
    else:
        text, usage = await call_gemini(agent_role, prompt, instruction)

    _track(agent_role, prompt, instruction, text, time.time() - start, in_tokens, out_tokens)
    return text


# ─── Public: streaming call ───────────────────────────────────────────────────

async def stream_ai(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    """
    Streaming AI call — yields text chunks as they arrive.
    All providers now support true token-by-token streaming.
    """
    provider = API_CONFIG.get("provider", "gemini")

    if provider == "gemini":
        async for chunk in stream_gemini(prompt, instruction):
            yield chunk
    elif provider == "openai":
        async for chunk in stream_openai(prompt, instruction):
            yield chunk
    elif provider == "ollama":
        async for chunk in stream_ollama(prompt, instruction):
            yield chunk
    elif provider == "copilot":
        async for chunk in stream_copilot(prompt, instruction):
            yield chunk
    elif provider == "bedrock":
        async for chunk in stream_bedrock(prompt, instruction):
            yield chunk
    else:
        async for chunk in stream_gemini(prompt, instruction):
            yield chunk
