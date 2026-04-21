/**
 * SDLC multi-agent router — /sdlc/*.
 * Mirrors backend/routers/sdlc_router.py.
 *
 * AGENT PIPELINE:
 *   BA -> SA + PM (parallel) -> DEV LEAD -> DEV -> SECURITY -> QA -> SRE
 *
 * Workflow states:
 *   idle -> running_ba -> waiting_ba_approval
 *        -> running_sa -> waiting_sa_approval
 *        -> running_dev_lead -> waiting_dev_lead_approval
 *        -> running_rest -> done
 *
 * agent_outputs is Record<string, unknown> — stores raw strings keyed by
 * agent name (ba, sa, dev_lead, dev, security, qa, sre) plus a 'requirement'
 * string for the original CR.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import {
  requireKnowledgeBase,
  requireSession,
  requireWorkflowState,
} from '../lib/guards.js';
import { callAI } from '../services/ai/dispatcher.js';
import {
  ApproveRequestSchema,
  CRRequestSchema,
  SDLCStateResponseSchema,
} from '../schemas/sdlc.schema.js';
import { ChatMessageSchema } from '../schemas/sessions.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const sdlcRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── Agent system instructions (verbatim from sdlc_router.py) ─
const AGENT_INSTRUCTIONS = {
  BA:
    'You are a Senior Business Analyst (BA) working on a banking/enterprise software project. ' +
    'Write a complete Business Requirements Document (BRD) including: ' +
    '## 1. Business Context & Problem Statement, ' +
    '## 2. Functional Requirements (FR), ' +
    '## 3. Non-Functional Requirements (NFR), ' +
    '## 4. User Stories (As a ... I want ... So that ...), ' +
    '## 5. Acceptance Criteria, ' +
    '## 6. Out of Scope. ' +
    'Use clear Markdown formatting. Do not fabricate technical information.',

  SA:
    'You are a Senior Solution Architect (SA). ' +
    'Write a System Architecture Document (SAD) including: ' +
    '## 1. High-Level Architecture Diagram (text/mermaid format), ' +
    '## 2. Component Design, ' +
    '## 3. API Contracts (endpoints, request/response), ' +
    '## 4. Data Model Changes (if any), ' +
    '## 5. Integration Points, ' +
    '## 6. Technology Decisions & Rationale. ' +
    'Use Markdown formatting. Stay aligned with the BRD and existing architecture.',

  DEV_LEAD:
    'You are a Principal Engineer / Tech Lead. ' +
    'Your task: REVIEW the SA Design and create an Implementation Plan for the dev team. ' +
    'Output must include: ' +
    '## 1. SA Review & Technical Concerns (unclear points or items needing clarification), ' +
    '## 2. Technical Debt & Risks, ' +
    '## 3. Implementation Breakdown (split tasks for developers), ' +
    '## 4. Code Standards & Patterns to follow, ' +
    '## 5. Testing Strategy (unit/integration/e2e), ' +
    '## 6. Definition of Done (DoD) for each task. ' +
    'Think critically and highlight real technical risks.',

  DEV:
    'You are a Senior Developer. ' +
    'Based on the SA Plan and Dev Lead guidance, write: ' +
    '## 1. Pseudocode / Code Structure for the main changes, ' +
    '## 2. Files/Modules to create or modify, ' +
    '## 3. Key Implementation Details (algorithms, patterns), ' +
    '## 4. Database Migration scripts (if needed), ' +
    '## 5. Environment Variables / Config to add. ' +
    'Write real, practical code samples (not placeholders). ' +
    'Use Markdown with clear code blocks.',

  SECURITY:
    'You are a Security Engineer / AppSec specialist in banking/enterprise security. ' +
    'Perform a comprehensive Security Review including: ' +
    '## 1. Threat Modeling (STRIDE: Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation), ' +
    '## 2. OWASP Top 10 Checklist (mark applicable items), ' +
    '## 3. Authentication & Authorization Review, ' +
    '## 4. Data Security (PII, encryption at rest/in transit), ' +
    '## 5. Input Validation & Injection Prevention, ' +
    '## 6. API Security (rate limiting, CORS, JWT, etc.), ' +
    '## 7. Compliance Considerations (PCI-DSS, GDPR if applicable), ' +
    '## 8. Security Action Items (CRITICAL / HIGH / MEDIUM / LOW). ' +
    'Reference specific CVE/CWE where applicable. Do not skip any risks.',

  QA:
    'You are a QA Engineer / SDET. ' +
    'Write a complete Test Plan including: ' +
    '## 1. Test Scope & Strategy, ' +
    '## 2. Test Cases (Happy Path, Edge Cases, Negative Cases), ' +
    '## 3. Performance Test Scenarios, ' +
    '## 4. Regression Test Checklist, ' +
    '## 5. Test Data Requirements, ' +
    '## 6. Exit Criteria. ' +
    'Format test cases as: | ID | Scenario | Steps | Expected | Priority |',

  SRE:
    'You are an SRE / DevOps Engineer. ' +
    'Create a Release Package including: ' +
    '## 1. Release Notes (What\'s New, Bug Fixes, Breaking Changes), ' +
    '## 2. Deployment Checklist (step-by-step), ' +
    '## 3. Infrastructure Changes (if any), ' +
    '## 4. Configuration Changes (.env, feature flags), ' +
    '## 5. Monitoring & Alerting (metrics to watch after deploy), ' +
    '## 6. Rollback Plan (detailed steps when rollback is needed), ' +
    '## 7. Post-Deploy Verification (smoke tests). ' +
    'Write like a real runbook, not generic advice.',

  PM:
    'Parse the SA Plan and Dev Lead Implementation Plan into a JIRA backlog JSON. ' +
    'Return only JSON, no extra text or markdown wrapper. ' +
    'Format: {"epics": [{"title": "Epic Title", "tasks": [{"title": "Task Title", ' +
    '"type": "backend|frontend|devops|security|testing", ' +
    '"story_points": 3, ' +
    '"subtasks": ["Subtask 1", "Subtask 2"]}]}]}',
} as const;

// ─── POST /sdlc/start ────────────────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/start',
    tags: ['SDLC Agents'],
    request: { body: { content: json(CRRequestSchema) } },
    responses: {
      200: {
        content: json(
          z.object({
            status: z.string(),
            message: z.string(),
            ba_output: z.string(),
            next_step: z.string(),
          }),
        ),
        description: 'BA done — waiting approval',
      },
      400: { content: json(ErrorSchema), description: 'KB empty' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    requireSession(req.session_id);
    const kb = requireKnowledgeBase();

    sessionsRepo.update(req.session_id, {
      workflowState: 'running_ba',
      agentOutputs: { requirement: req.requirement },
      jiraBacklog: [],
      name: `CR: ${req.requirement.slice(0, 40)}...`,
    });

    const baResult = await callAI(
      'BA',
      `CHANGE REQUEST:\n${req.requirement}\n\n` +
        `CURRENT ARCHITECTURE (Project Context):\n${kb.project_summary}`,
      AGENT_INSTRUCTIONS.BA,
    );

    sessionsRepo.update(req.session_id, {
      agentOutputs: { requirement: req.requirement, ba: baResult },
      workflowState: 'waiting_ba_approval',
    });

    return c.json(
      {
        status: 'waiting_ba_approval',
        message:
          'BA has written the BRD. Review and call POST /sdlc/approve-ba to continue.',
        ba_output: baResult,
        next_step: 'POST /sdlc/approve-ba',
      },
      200,
    );
  },
);

// ─── POST /sdlc/approve-ba ───────────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/approve-ba',
    tags: ['SDLC Agents'],
    request: { body: { content: json(ApproveRequestSchema) } },
    responses: {
      200: {
        content: json(
          z.object({
            status: z.string(),
            message: z.string(),
            sa_output: z.string(),
            jira_backlog: z.array(z.unknown()),
            next_step: z.string(),
          }),
        ),
        description: 'SA + PM done',
      },
      400: { content: json(ErrorSchema), description: 'Wrong workflow state' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    const session = requireSession(req.session_id);
    requireWorkflowState(session, 'waiting_ba_approval');

    const outputs = { ...session.agentOutputs };
    if (req.edited_content) outputs.ba = req.edited_content;
    const baContent = String(outputs.ba ?? '');

    const kb = requireKnowledgeBase();

    sessionsRepo.update(req.session_id, {
      workflowState: 'running_sa',
      agentOutputs: outputs,
    });

    const saResult = await callAI(
      'SA',
      `BUSINESS REQUIREMENTS DOCUMENT:\n${baContent}\n\n` +
        `CURRENT ARCHITECTURE:\n${kb.project_summary}`,
      AGENT_INSTRUCTIONS.SA,
    );
    outputs.sa = saResult;

    const pmResult = await callAI(
      'PM',
      `SA PLAN:\n${saResult}`,
      AGENT_INSTRUCTIONS.PM,
    );

    let backlog: unknown[] = [];
    try {
      const cleaned = pmResult.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as { epics?: unknown[] };
      backlog = parsed.epics ?? [];
    } catch {
      backlog = [];
    }

    sessionsRepo.update(req.session_id, {
      agentOutputs: outputs,
      jiraBacklog: backlog,
      workflowState: 'waiting_sa_approval',
    });

    return c.json(
      {
        status: 'waiting_sa_approval',
        message:
          'SA has designed the architecture + JIRA backlog. Review and call POST /sdlc/approve-sa.',
        sa_output: saResult,
        jira_backlog: backlog,
        next_step: 'POST /sdlc/approve-sa',
      },
      200,
    );
  },
);

// ─── POST /sdlc/approve-sa ───────────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/approve-sa',
    tags: ['SDLC Agents'],
    request: { body: { content: json(ApproveRequestSchema) } },
    responses: {
      200: {
        content: json(
          z.object({
            status: z.string(),
            message: z.string(),
            dev_lead_output: z.string(),
            next_step: z.string(),
          }),
        ),
        description: 'Dev Lead done',
      },
      400: { content: json(ErrorSchema), description: 'Wrong workflow state' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    const session = requireSession(req.session_id);
    requireWorkflowState(session, 'waiting_sa_approval');

    const outputs = { ...session.agentOutputs };
    if (req.edited_content) outputs.sa = req.edited_content;
    const saContent = String(outputs.sa ?? '');
    const baContent = String(outputs.ba ?? '');

    sessionsRepo.update(req.session_id, {
      workflowState: 'running_dev_lead',
      agentOutputs: outputs,
    });

    const devLeadResult = await callAI(
      'DEV_LEAD',
      `BUSINESS REQUIREMENTS DOCUMENT:\n${baContent}\n\n` +
        `SYSTEM ARCHITECTURE DOCUMENT:\n${saContent}`,
      AGENT_INSTRUCTIONS.DEV_LEAD,
    );

    outputs.dev_lead = devLeadResult;

    sessionsRepo.update(req.session_id, {
      agentOutputs: outputs,
      workflowState: 'waiting_dev_lead_approval',
    });

    return c.json(
      {
        status: 'waiting_dev_lead_approval',
        message:
          'Dev Lead has reviewed SA and created an Implementation Plan. Call POST /sdlc/approve-dev-lead.',
        dev_lead_output: devLeadResult,
        next_step: 'POST /sdlc/approve-dev-lead',
      },
      200,
    );
  },
);

// ─── POST /sdlc/approve-dev-lead ─────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/approve-dev-lead',
    tags: ['SDLC Agents'],
    request: { body: { content: json(ApproveRequestSchema) } },
    responses: {
      200: {
        content: json(
          z.object({
            status: z.string(),
            message: z.string(),
            pipeline: z.record(z.string(), z.string()),
            dev_output: z.string(),
            security_output: z.string(),
            qa_output: z.string(),
            sre_output: z.string(),
            full_state_url: z.string(),
          }),
        ),
        description: 'Pipeline complete',
      },
      400: { content: json(ErrorSchema), description: 'Wrong workflow state' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    const session = requireSession(req.session_id);
    requireWorkflowState(session, 'waiting_dev_lead_approval');

    const outputs = { ...session.agentOutputs };
    if (req.edited_content) outputs.dev_lead = req.edited_content;

    const devLeadContent = String(outputs.dev_lead ?? '');
    const saContent = String(outputs.sa ?? '');
    const baContent = String(outputs.ba ?? '');

    sessionsRepo.update(req.session_id, {
      workflowState: 'running_rest',
      agentOutputs: outputs,
    });

    // ---- DEV ----
    const devResult = await callAI(
      'DEV',
      `SA PLAN:\n${saContent}\n\nDEV LEAD IMPLEMENTATION PLAN:\n${devLeadContent}`,
      AGENT_INSTRUCTIONS.DEV,
    );
    outputs.dev = devResult;

    // ---- SECURITY ----
    const securityResult = await callAI(
      'SECURITY',
      `BUSINESS REQUIREMENTS:\n${baContent}\n\n` +
        `SYSTEM ARCHITECTURE:\n${saContent}\n\n` +
        `IMPLEMENTATION CODE/PLAN:\n${devResult}`,
      AGENT_INSTRUCTIONS.SECURITY,
    );
    outputs.security = securityResult;

    // ---- QA ----
    const qaResult = await callAI(
      'QA',
      `BRD:\n${baContent}\n\n` +
        `SA PLAN:\n${saContent}\n\n` +
        `CODE PLAN:\n${devResult}\n\n` +
        `SECURITY CONCERNS:\n${securityResult}`,
      AGENT_INSTRUCTIONS.QA,
    );
    outputs.qa = qaResult;

    // ---- SRE ----
    const sreResult = await callAI(
      'SRE',
      `DEV CODE PLAN:\n${devResult}\n\n` +
        `SECURITY REVIEW:\n${securityResult}\n\n` +
        `QA TEST PLAN:\n${qaResult}`,
      AGENT_INSTRUCTIONS.SRE,
    );
    outputs.sre = sreResult;

    sessionsRepo.update(req.session_id, {
      agentOutputs: outputs,
      workflowState: 'done',
    });

    return c.json(
      {
        status: 'done',
        message: 'SDLC Pipeline complete! All agents have finished.',
        pipeline: { dev: 'Done', security: 'Done', qa: 'Done', sre: 'Done' },
        dev_output: devResult,
        security_output: securityResult,
        qa_output: qaResult,
        sre_output: sreResult,
        full_state_url: `/sdlc/${req.session_id}/state`,
      },
      200,
    );
  },
);

// ─── GET /sdlc/{session_id}/state ────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sdlc/{session_id}/state',
    tags: ['SDLC Agents'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: { content: json(SDLCStateResponseSchema), description: 'State' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const session = requireSession(session_id);
    return c.json(
      {
        session_id,
        workflow_state: session.workflowState,
        agent_outputs: session.agentOutputs as Record<string, unknown>,
        jira_backlog: session.jiraBacklog,
      },
      200,
    );
  },
);

// ─── GET /sdlc/{session_id}/history ──────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sdlc/{session_id}/history',
    tags: ['SDLC Agents'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: {
        content: json(
          z.object({
            session_id: z.string(),
            chat_history: z.array(ChatMessageSchema),
          }),
        ),
        description: 'History',
      },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const session = requireSession(session_id);
    return c.json(
      {
        session_id,
        chat_history: session.chatHistory,
      },
      200,
    );
  },
);
