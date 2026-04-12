"""
YUMMY Backend - Metrics Router
Endpoint: /metrics
"""

from fastapi import APIRouter
from config import DB

router = APIRouter(tags=["Metrics"])


@router.get("/metrics")
def get_metrics():
    """
    View request logs and AI costs.

    Returns:
    - Total number of requests
    - Total cost in USD (Gemini pricing)
    - 50 most recent requests
    """
    logs = DB["request_logs"]
    total_cost = round(sum(l["cost"] for l in logs), 6)

    # Aggregate by agent
    agent_stats = {}
    for log in logs:
        agent = log["agent"]
        if agent not in agent_stats:
            agent_stats[agent] = {"calls": 0, "cost": 0.0, "total_tokens": 0}
        agent_stats[agent]["calls"] += 1
        agent_stats[agent]["cost"] += log["cost"]
        agent_stats[agent]["total_tokens"] += log.get("in_tokens", 0) + log.get("out_tokens", 0)

    return {
        "total_requests": len(logs),
        "total_cost_usd": total_cost,
        "agent_breakdown": agent_stats,
        "logs": logs[:50]  # 50 most recent
    }


@router.delete("/metrics")
def clear_metrics():
    """Clear all request logs."""
    DB["request_logs"] = []
    return {"status": "ok", "message": "Request logs cleared."}
