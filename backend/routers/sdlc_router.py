"""
YUMMY Backend - SDLC Multi-Agent Workflow Router
Endpoints: /sdlc/*

AGENT PIPELINE:
┌─────────┐    ┌──────┐    ┌────────────┐    ┌─────────┐
│   BA    │───▶│  SA  │───▶│  DEV LEAD  │───▶│   DEV   │
│Business │    │System│    │  (review   │    │ (code)  │
│Analyst  │    │Archit│    │  SA plan)  │    │         │
└─────────┘    └──────┘    └────────────┘    └────┬────┘
                                                   │
               ┌──────┐    ┌────────────┐    ┌────▼────┐
               │ SRE  │◀───│  SECURITY  │◀───│   QA    │
               │(deploy│    │(sec review)│    │(testing)│
               │ plan) │    └────────────┘    └─────────┘
               └──────┘
                  │
               ┌──▼───┐
               │  PM  │ (JIRA backlog - runs in parallel with SA)
               └──────┘

Workflow states:
  idle → running_ba → waiting_ba_approval
       → running_sa → waiting_sa_approval
       → running_dev_lead → waiting_dev_lead_approval
       → running_rest → done
"""

import json
from fastapi import APIRouter
from models import CRRequest, ApproveRequest
from dependencies import get_session, require_knowledge_base, require_workflow_state
from services.ai_service import call_ai

router = APIRouter(prefix="/sdlc", tags=["SDLC Agents"])


# ============================================================
# AGENT SYSTEM INSTRUCTIONS
# ============================================================

AGENT_INSTRUCTIONS = {
    "BA": (
        "You are a Senior Business Analyst (BA) working on a banking/enterprise software project. "
        "Write a complete Business Requirements Document (BRD) including: "
        "## 1. Business Context & Problem Statement, "
        "## 2. Functional Requirements (FR), "
        "## 3. Non-Functional Requirements (NFR), "
        "## 4. User Stories (As a ... I want ... So that ...), "
        "## 5. Acceptance Criteria, "
        "## 6. Out of Scope. "
        "Use clear Markdown formatting. Do not fabricate technical information."
    ),

    "SA": (
        "You are a Senior Solution Architect (SA). "
        "Write a System Architecture Document (SAD) including: "
        "## 1. High-Level Architecture Diagram (text/mermaid format), "
        "## 2. Component Design, "
        "## 3. API Contracts (endpoints, request/response), "
        "## 4. Data Model Changes (if any), "
        "## 5. Integration Points, "
        "## 6. Technology Decisions & Rationale. "
        "Use Markdown formatting. Stay aligned with the BRD and existing architecture."
    ),

    "DEV_LEAD": (
        "You are a Principal Engineer / Tech Lead. "
        "Your task: REVIEW the SA Design and create an Implementation Plan for the dev team. "
        "Output must include: "
        "## 1. SA Review & Technical Concerns (unclear points or items needing clarification), "
        "## 2. Technical Debt & Risks, "
        "## 3. Implementation Breakdown (split tasks for developers), "
        "## 4. Code Standards & Patterns to follow, "
        "## 5. Testing Strategy (unit/integration/e2e), "
        "## 6. Definition of Done (DoD) for each task. "
        "Think critically and highlight real technical risks."
    ),

    "DEV": (
        "You are a Senior Developer. "
        "Based on the SA Plan and Dev Lead guidance, write: "
        "## 1. Pseudocode / Code Structure for the main changes, "
        "## 2. Files/Modules to create or modify, "
        "## 3. Key Implementation Details (algorithms, patterns), "
        "## 4. Database Migration scripts (if needed), "
        "## 5. Environment Variables / Config to add. "
        "Write real, practical code samples (not placeholders). "
        "Use Markdown with clear code blocks."
    ),

    "SECURITY": (
        "You are a Security Engineer / AppSec specialist in banking/enterprise security. "
        "Perform a comprehensive Security Review including: "
        "## 1. Threat Modeling (STRIDE: Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation), "
        "## 2. OWASP Top 10 Checklist (mark applicable items), "
        "## 3. Authentication & Authorization Review, "
        "## 4. Data Security (PII, encryption at rest/in transit), "
        "## 5. Input Validation & Injection Prevention, "
        "## 6. API Security (rate limiting, CORS, JWT, etc.), "
        "## 7. Compliance Considerations (PCI-DSS, GDPR if applicable), "
        "## 8. Security Action Items (CRITICAL / HIGH / MEDIUM / LOW). "
        "Reference specific CVE/CWE where applicable. Do not skip any risks."
    ),

    "QA": (
        "You are a QA Engineer / SDET. "
        "Write a complete Test Plan including: "
        "## 1. Test Scope & Strategy, "
        "## 2. Test Cases (Happy Path, Edge Cases, Negative Cases), "
        "## 3. Performance Test Scenarios, "
        "## 4. Regression Test Checklist, "
        "## 5. Test Data Requirements, "
        "## 6. Exit Criteria. "
        "Format test cases as: | ID | Scenario | Steps | Expected | Priority |"
    ),

    "SRE": (
        "You are an SRE / DevOps Engineer. "
        "Create a Release Package including: "
        "## 1. Release Notes (What's New, Bug Fixes, Breaking Changes), "
        "## 2. Deployment Checklist (step-by-step), "
        "## 3. Infrastructure Changes (if any), "
        "## 4. Configuration Changes (.env, feature flags), "
        "## 5. Monitoring & Alerting (metrics to watch after deploy), "
        "## 6. Rollback Plan (detailed steps when rollback is needed), "
        "## 7. Post-Deploy Verification (smoke tests). "
        "Write like a real runbook, not generic advice."
    ),

    "PM": (
        'Parse the SA Plan and Dev Lead Implementation Plan into a JIRA backlog JSON. '
        'Return only JSON, no extra text or markdown wrapper. '
        'Format: {"epics": [{"title": "Epic Title", "tasks": [{"title": "Task Title", '
        '"type": "backend|frontend|devops|security|testing", '
        '"story_points": 3, '
        '"subtasks": ["Subtask 1", "Subtask 2"]}]}]}'
    ),
}


# ============================================================
# STEP 1: BA — Business Analyst
# ============================================================

@router.post("/start")
async def sdlc_start(req: CRRequest):
    """
    Step 1: Start the SDLC workflow with a Change Request.
    BA writes BRD -> waits for approval.

    State: idle -> waiting_ba_approval
    Next: POST /sdlc/approve-ba
    """
    session = get_session(req.session_id)
    kb = require_knowledge_base()

    session["workflow_state"] = "running_ba"
    session["agent_outputs"] = {"requirement": req.requirement}
    session["jira_backlog"] = []
    session["name"] = f"CR: {req.requirement[:40]}..."

    ba_result = await call_ai(
        "BA",
        (
            f"CHANGE REQUEST:\n{req.requirement}\n\n"
            f"CURRENT ARCHITECTURE (Project Context):\n{kb['project_summary']}"
        ),
        AGENT_INSTRUCTIONS["BA"]
    )

    session["agent_outputs"]["ba"] = ba_result
    session["workflow_state"] = "waiting_ba_approval"

    return {
        "status": "waiting_ba_approval",
        "message": "BA has written the BRD. Review and call POST /sdlc/approve-ba to continue.",
        "ba_output": ba_result,
        "next_step": "POST /sdlc/approve-ba"
    }


# ============================================================
# STEP 2: SA + PM — Solution Architect + Project Manager
# ============================================================

@router.post("/approve-ba")
async def sdlc_approve_ba(req: ApproveRequest):
    """
    Step 2: Approve the BA's BRD.
    SA designs the architecture -> PM creates JIRA backlog.

    State: waiting_ba_approval -> waiting_sa_approval
    Next: POST /sdlc/approve-sa
    """
    session = get_session(req.session_id)
    require_workflow_state(session, "waiting_ba_approval")

    if req.edited_content:
        session["agent_outputs"]["ba"] = req.edited_content
    ba_content = session["agent_outputs"]["ba"]

    kb = require_knowledge_base()
    session["workflow_state"] = "running_sa"

    # SA — System Architecture
    sa_result = await call_ai(
        "SA",
        (
            f"BUSINESS REQUIREMENTS DOCUMENT:\n{ba_content}\n\n"
            f"CURRENT ARCHITECTURE:\n{kb['project_summary']}"
        ),
        AGENT_INSTRUCTIONS["SA"]
    )
    session["agent_outputs"]["sa"] = sa_result

    # PM — JIRA Backlog (based on SA plan)
    pm_result = await call_ai(
        "PM",
        f"SA PLAN:\n{sa_result}",
        AGENT_INSTRUCTIONS["PM"]
    )

    try:
        cleaned = pm_result.replace("```json", "").replace("```", "").strip()
        backlog = json.loads(cleaned).get("epics", [])
    except Exception:
        backlog = []

    session["jira_backlog"] = backlog
    session["workflow_state"] = "waiting_sa_approval"

    return {
        "status": "waiting_sa_approval",
        "message": "SA has designed the architecture + JIRA backlog. Review and call POST /sdlc/approve-sa.",
        "sa_output": sa_result,
        "jira_backlog": backlog,
        "next_step": "POST /sdlc/approve-sa"
    }


# ============================================================
# STEP 3: DEV LEAD — Review SA + Create Implementation Plan
# ============================================================

@router.post("/approve-sa")
async def sdlc_approve_sa(req: ApproveRequest):
    """
    Step 3: Approve the SA Design.
    Dev Lead reviews SA -> creates Implementation Plan -> waits for approval.

    State: waiting_sa_approval -> waiting_dev_lead_approval
    Next: POST /sdlc/approve-dev-lead
    """
    session = get_session(req.session_id)
    require_workflow_state(session, "waiting_sa_approval")

    if req.edited_content:
        session["agent_outputs"]["sa"] = req.edited_content
    sa_content = session["agent_outputs"]["sa"]
    ba_content = session["agent_outputs"].get("ba", "")

    session["workflow_state"] = "running_dev_lead"

    dev_lead_result = await call_ai(
        "DEV_LEAD",
        (
            f"BUSINESS REQUIREMENTS DOCUMENT:\n{ba_content}\n\n"
            f"SYSTEM ARCHITECTURE DOCUMENT:\n{sa_content}"
        ),
        AGENT_INSTRUCTIONS["DEV_LEAD"]
    )

    session["agent_outputs"]["dev_lead"] = dev_lead_result
    session["workflow_state"] = "waiting_dev_lead_approval"

    return {
        "status": "waiting_dev_lead_approval",
        "message": "Dev Lead has reviewed SA and created an Implementation Plan. Call POST /sdlc/approve-dev-lead.",
        "dev_lead_output": dev_lead_result,
        "next_step": "POST /sdlc/approve-dev-lead"
    }


# ============================================================
# STEP 4: DEV + SECURITY + QA + SRE
# ============================================================

@router.post("/approve-dev-lead")
async def sdlc_approve_dev_lead(req: ApproveRequest):
    """
    Step 4 (final): Approve the Dev Lead Implementation Plan.
    Runs pipeline: DEV -> SECURITY -> QA -> SRE (sequential).

    State: waiting_dev_lead_approval -> done

    Agents:
    - DEV:      Writes pseudocode/code structure
    - SECURITY: Security review (OWASP, threat model)
    - QA:       Test plan + test cases
    - SRE:      Deployment plan + rollback
    """
    session = get_session(req.session_id)
    require_workflow_state(session, "waiting_dev_lead_approval")

    if req.edited_content:
        session["agent_outputs"]["dev_lead"] = req.edited_content

    dev_lead_content = session["agent_outputs"]["dev_lead"]
    sa_content = session["agent_outputs"].get("sa", "")
    ba_content = session["agent_outputs"].get("ba", "")

    session["workflow_state"] = "running_rest"

    # ---- DEV ----
    dev_result = await call_ai(
        "DEV",
        (
            f"SA PLAN:\n{sa_content}\n\n"
            f"DEV LEAD IMPLEMENTATION PLAN:\n{dev_lead_content}"
        ),
        AGENT_INSTRUCTIONS["DEV"]
    )
    session["agent_outputs"]["dev"] = dev_result

    # ---- SECURITY ----
    security_result = await call_ai(
        "SECURITY",
        (
            f"BUSINESS REQUIREMENTS:\n{ba_content}\n\n"
            f"SYSTEM ARCHITECTURE:\n{sa_content}\n\n"
            f"IMPLEMENTATION CODE/PLAN:\n{dev_result}"
        ),
        AGENT_INSTRUCTIONS["SECURITY"]
    )
    session["agent_outputs"]["security"] = security_result

    # ---- QA ----
    qa_result = await call_ai(
        "QA",
        (
            f"BRD:\n{ba_content}\n\n"
            f"SA PLAN:\n{sa_content}\n\n"
            f"CODE PLAN:\n{dev_result}\n\n"
            f"SECURITY CONCERNS:\n{security_result}"
        ),
        AGENT_INSTRUCTIONS["QA"]
    )
    session["agent_outputs"]["qa"] = qa_result

    # ---- SRE ----
    sre_result = await call_ai(
        "SRE",
        (
            f"DEV CODE PLAN:\n{dev_result}\n\n"
            f"SECURITY REVIEW:\n{security_result}\n\n"
            f"QA TEST PLAN:\n{qa_result}"
        ),
        AGENT_INSTRUCTIONS["SRE"]
    )
    session["agent_outputs"]["sre"] = sre_result

    session["workflow_state"] = "done"

    return {
        "status": "done",
        "message": "SDLC Pipeline complete! All agents have finished.",
        "pipeline": {
            "dev": "Done",
            "security": "Done",
            "qa": "Done",
            "sre": "Done"
        },
        "dev_output": dev_result,
        "security_output": security_result,
        "qa_output": qa_result,
        "sre_output": sre_result,
        "full_state_url": f"/sdlc/{req.session_id}/state"
    }


# ============================================================
# STATE & HISTORY
# ============================================================

@router.get("/{session_id}/state")
def sdlc_get_state(session_id: str):
    """
    View the full SDLC state of a session:
    - workflow_state: current step
    - agent_outputs: output from each agent
    - jira_backlog: JIRA epics/tasks from PM
    """
    session = get_session(session_id)
    return {
        "session_id": session_id,
        "workflow_state": session["workflow_state"],
        "agent_outputs": session["agent_outputs"],
        "jira_backlog": session["jira_backlog"]
    }


@router.get("/{session_id}/history")
def sdlc_get_chat_history(session_id: str):
    """View the chat history of a session."""
    session = get_session(session_id)
    return {
        "session_id": session_id,
        "chat_history": session["chat_history"]
    }
