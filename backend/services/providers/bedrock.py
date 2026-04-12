"""
AWS Bedrock provider — blocking + true token streaming via converse_stream.
Supports Claude, Llama, Nova, Mistral model families.
"""

import asyncio
from typing import AsyncGenerator
from fastapi import HTTPException

from config import API_CONFIG


def _make_client():
    try:
        import boto3
    except ImportError:
        raise HTTPException(status_code=500, detail="boto3 is not installed. Run: pip install boto3")

    access_key = API_CONFIG.get("bedrock_access_key", "")
    secret_key  = API_CONFIG.get("bedrock_secret_key", "")
    region      = API_CONFIG.get("bedrock_region", "us-east-1")

    if not access_key or not secret_key:
        raise HTTPException(
            status_code=400,
            detail="AWS credentials not configured. Set them in Settings or via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars.",
        )

    return boto3.client(
        "bedrock-runtime",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def _model() -> str:
    return API_CONFIG.get("bedrock_model", "anthropic.claude-3-5-sonnet-20241022-v2:0")


async def call_bedrock(agent_role: str, prompt: str, instruction: str):
    model = _model()

    def _invoke():
        return _make_client().converse(
            modelId=model,
            system=[{"text": instruction}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
        )

    try:
        response = await asyncio.get_event_loop().run_in_executor(None, _invoke)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AWS Bedrock error: {e}")

    text  = response["output"]["message"]["content"][0]["text"]
    usage = response.get("usage", {})
    return text, usage.get("inputTokens"), usage.get("outputTokens")


async def stream_bedrock(prompt: str, instruction: str) -> AsyncGenerator[str, None]:
    """True token streaming via Bedrock converse_stream API."""
    model = _model()
    loop  = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def _drain():
        """Runs in a thread — pulls events from the EventStream and pushes to queue."""
        try:
            client   = _make_client()
            response = client.converse_stream(
                modelId=model,
                system=[{"text": instruction}],
                messages=[{"role": "user", "content": [{"text": prompt}]}],
            )
            stream = response.get("stream")
            if stream is None:
                return
            for event in stream:
                delta = (
                    event.get("contentBlockDelta", {})
                         .get("delta", {})
                         .get("text", "")
                )
                if delta:
                    loop.call_soon_threadsafe(queue.put_nowait, delta)
        except HTTPException:
            raise
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, f"[BEDROCK_ERROR] {e}")
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    # Schedule drain in thread pool — must be awaited so it actually starts
    asyncio.ensure_future(loop.run_in_executor(None, _drain))

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        if chunk.startswith("[BEDROCK_ERROR]"):
            raise HTTPException(status_code=502, detail=chunk[15:].strip())
        yield chunk
