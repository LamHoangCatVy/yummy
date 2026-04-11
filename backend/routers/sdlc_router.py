"""
YUMMY Backend - SDLC Multi-Agent Workflow Router
Endpoints: /sdlc/*

AGENT PIPELINE (theo thứ tự):
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
               │  PM  │ (JIRA backlog - chạy song song với SA)
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
        "Bạn là Business Analyst (BA) cấp Senior trong dự án phần mềm ngân hàng/enterprise. "
        "Viết Business Requirements Document (BRD) đầy đủ bao gồm: "
        "## 1. Business Context & Problem Statement, "
        "## 2. Functional Requirements (FR), "
        "## 3. Non-Functional Requirements (NFR), "
        "## 4. User Stories (As a ... I want ... So that ...), "
        "## 5. Acceptance Criteria, "
        "## 6. Out of Scope. "
        "Trình bày Markdown rõ ràng. Không bịa đặt thông tin kỹ thuật."
    ),

    "SA": (
        "Bạn là Solution Architect (SA) cấp Senior. "
        "Viết System Architecture Document (SAD) bao gồm: "
        "## 1. High-Level Architecture Diagram (dạng text/mermaid), "
        "## 2. Component Design, "
        "## 3. API Contracts (endpoints, request/response), "
        "## 4. Data Model Changes (nếu có), "
        "## 5. Integration Points, "
        "## 6. Technology Decisions & Rationale. "
        "Trình bày Markdown. Bám sát BRD và kiến trúc hiện tại."
    ),

    "DEV_LEAD": (
        "Bạn là Tech Lead / Dev Lead cấp Principal Engineer. "
        "Nhiệm vụ: REVIEW SA Design và tạo Implementation Plan cho team dev. "
        "Output bao gồm: "
        "## 1. SA Review & Technical Concerns (những điểm SA chưa rõ hoặc cần clarify), "
        "## 2. Technical Debt & Risks, "
        "## 3. Implementation Breakdown (chia nhỏ task cho dev), "
        "## 4. Code Standards & Patterns cần tuân theo, "
        "## 5. Testing Strategy (unit/integration/e2e), "
        "## 6. Definition of Done (DoD) cho từng task. "
        "Tư duy phản biện, chỉ ra rủi ro kỹ thuật thực tế."
    ),

    "DEV": (
        "Bạn là Senior Developer. "
        "Dựa trên SA Plan và Dev Lead guidance, viết: "
        "## 1. Pseudocode / Code Structure cho các thay đổi chính, "
        "## 2. File/Module nào cần tạo mới hoặc sửa đổi, "
        "## 3. Key Implementation Details (algorithms, patterns), "
        "## 4. Database Migration scripts (nếu cần), "
        "## 5. Environment Variables / Config cần thêm. "
        "Viết code mẫu thực tế (không phải placeholder). "
        "Markdown với code blocks rõ ràng."
    ),

    "SECURITY": (
        "Bạn là Security Engineer / AppSec chuyên về banking/enterprise security. "
        "Thực hiện Security Review toàn diện bao gồm: "
        "## 1. Threat Modeling (STRIDE: Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation), "
        "## 2. OWASP Top 10 Checklist (đánh dấu applicable items), "
        "## 3. Authentication & Authorization Review, "
        "## 4. Data Security (PII, encryption at rest/in transit), "
        "## 5. Input Validation & Injection Prevention, "
        "## 6. API Security (rate limiting, CORS, JWT, v.v.), "
        "## 7. Compliance Considerations (PCI-DSS, GDPR nếu applicable), "
        "## 8. Security Action Items (CRITICAL / HIGH / MEDIUM / LOW). "
        "Chỉ ra CVE/CWE cụ thể nếu applicable. Không bỏ qua rủi ro."
    ),

    "QA": (
        "Bạn là QA Engineer / SDET. "
        "Viết Test Plan đầy đủ bao gồm: "
        "## 1. Test Scope & Strategy, "
        "## 2. Test Cases (Happy Path, Edge Cases, Negative Cases), "
        "## 3. Performance Test Scenarios, "
        "## 4. Regression Test Checklist, "
        "## 5. Test Data Requirements, "
        "## 6. Exit Criteria. "
        "Format test cases dạng: | ID | Scenario | Steps | Expected | Priority |"
    ),

    "SRE": (
        "Bạn là SRE / DevOps Engineer. "
        "Tạo Release Package bao gồm: "
        "## 1. Release Notes (What's New, Bug Fixes, Breaking Changes), "
        "## 2. Deployment Checklist (step-by-step), "
        "## 3. Infrastructure Changes (nếu có), "
        "## 4. Configuration Changes (.env, feature flags), "
        "## 5. Monitoring & Alerting (metrics cần watch sau deploy), "
        "## 6. Rollback Plan (steps chi tiết khi cần rollback), "
        "## 7. Post-Deploy Verification (smoke tests). "
        "Viết như runbook thực tế, không chung chung."
    ),

    "PM": (
        'Parse SA Plan và Dev Lead Implementation Plan thành JIRA backlog JSON. '
        'Chỉ trả về JSON, không thêm bất kỳ text hay markdown wrapper nào. '
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
    Bước 1: Khởi động SDLC workflow với Change Request.
    BA viết BRD → chờ approve.
    
    State: idle → waiting_ba_approval
    Next: POST /sdlc/approve-ba
    """
    session = get_session(req.session_id)
    kb = require_knowledge_base()

    if session["workflow_state"] not in ("idle", "done"):
        # Cho phép restart nếu đã done
        pass

    session["workflow_state"] = "running_ba"
    session["agent_outputs"] = {"requirement": req.requirement}
    session["jira_backlog"] = []
    session["name"] = f"CR: {req.requirement[:40]}..."

    ba_result = await call_ai(
        "BA",
        (
            f"CHANGE REQUEST:\n{req.requirement}\n\n"
            f"KIẾN TRÚC HIỆN TẠI (Project Context):\n{kb['project_summary']}"
        ),
        AGENT_INSTRUCTIONS["BA"]
    )

    session["agent_outputs"]["ba"] = ba_result
    session["workflow_state"] = "waiting_ba_approval"

    return {
        "status": "waiting_ba_approval",
        "message": "✅ BA đã viết BRD. Review và gọi POST /sdlc/approve-ba để tiếp tục.",
        "ba_output": ba_result,
        "next_step": "POST /sdlc/approve-ba"
    }


# ============================================================
# STEP 2: SA + PM — Solution Architect + Project Manager
# ============================================================

@router.post("/approve-ba")
async def sdlc_approve_ba(req: ApproveRequest):
    """
    Bước 2: Approve BRD của BA.
    SA thiết kế kiến trúc → PM tạo JIRA backlog.
    
    State: waiting_ba_approval → waiting_sa_approval
    Next: POST /sdlc/approve-sa
    """
    session = get_session(req.session_id)
    require_workflow_state(session, "waiting_ba_approval")

    # Cho phép user edit BA output trước khi approve
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
            f"KIẾN TRÚC HIỆN TẠI:\n{kb['project_summary']}"
        ),
        AGENT_INSTRUCTIONS["SA"]
    )
    session["agent_outputs"]["sa"] = sa_result

    # PM — JIRA Backlog (dựa trên SA plan)
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
        "message": "✅ SA đã thiết kế kiến trúc + JIRA backlog. Review và gọi POST /sdlc/approve-sa.",
        "sa_output": sa_result,
        "jira_backlog": backlog,
        "next_step": "POST /sdlc/approve-sa"
    }


# ============================================================
# STEP 3: DEV LEAD — Review SA + tạo Implementation Plan
# ============================================================

@router.post("/approve-sa")
async def sdlc_approve_sa(req: ApproveRequest):
    """
    Bước 3: Approve SA Design.
    Dev Lead review SA → tạo Implementation Plan → chờ approve.
    
    State: waiting_sa_approval → waiting_dev_lead_approval
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
        "message": "✅ Dev Lead đã review SA + tạo Implementation Plan. Gọi POST /sdlc/approve-dev-lead.",
        "dev_lead_output": dev_lead_result,
        "next_step": "POST /sdlc/approve-dev-lead"
    }


# ============================================================
# STEP 4: DEV + SECURITY + QA + SRE
# ============================================================

@router.post("/approve-dev-lead")
async def sdlc_approve_dev_lead(req: ApproveRequest):
    """
    Bước 4 (cuối): Approve Dev Lead Implementation Plan.
    Chạy pipeline: DEV → SECURITY → QA → SRE (tuần tự).
    
    State: waiting_dev_lead_approval → done
    
    Các agents:
    - DEV:      Viết pseudocode/code structure
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
        "message": "🎉 SDLC Pipeline hoàn tất! Tất cả agents đã chạy xong.",
        "pipeline": {
            "dev": "✅ Done",
            "security": "✅ Done",
            "qa": "✅ Done",
            "sre": "✅ Done"
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
    Xem toàn bộ trạng thái SDLC của session:
    - workflow_state: bước hiện tại
    - agent_outputs: output của từng agent
    - jira_backlog: JIRA epics/tasks từ PM
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
    """Xem lịch sử chat của session."""
    session = get_session(session_id)
    return {
        "session_id": session_id,
        "chat_history": session["chat_history"]
    }
