'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { Session, WorkflowState, AgentOutputs } from '@/lib/types'

interface Props {
  session: Session
  onUpdate: (updated: Partial<Session>) => void
  hasKB: boolean
}

const AGENTS = [
  { key: 'ba',       label: 'BA',       full: 'Business Analyst',    icon: '📋', color: '#00ff88' },
  { key: 'sa',       label: 'SA',       full: 'Solution Architect',  icon: '🏛',  color: '#00cc66' },
  { key: 'dev_lead', label: 'Dev Lead', full: 'Tech Lead',           icon: '⚙️',  color: '#ffb300' },
  { key: 'dev',      label: 'DEV',      full: 'Developer',           icon: '💻',  color: '#00aaff' },
  { key: 'security', label: 'SEC',      full: 'Security Engineer',   icon: '🔐',  color: '#ff6644' },
  { key: 'qa',       label: 'QA',       full: 'QA Engineer',         icon: '🧪',  color: '#aa88ff' },
  { key: 'sre',      label: 'SRE',      full: 'SRE / DevOps',        icon: '🚀',  color: '#44ddff' },
]

const STATE_ORDER: WorkflowState[] = [
  'idle',
  'running_ba', 'waiting_ba_approval',
  'running_sa', 'waiting_sa_approval',
  'running_dev_lead', 'waiting_dev_lead_approval',
  'running_rest', 'done',
]

function agentStatus(agentKey: string, state: WorkflowState, outputs: AgentOutputs): 'done' | 'running' | 'pending' {
  const runningMap: Record<string, WorkflowState[]> = {
    ba:       ['running_ba'],
    sa:       ['running_sa'],
    dev_lead: ['running_dev_lead'],
    dev:      ['running_rest'],
    security: ['running_rest'],
    qa:       ['running_rest'],
    sre:      ['running_rest'],
  }
  if (outputs[agentKey as keyof AgentOutputs]) return 'done'
  if (runningMap[agentKey]?.includes(state)) return 'running'
  return 'pending'
}

export default function SDLCWorkflow({ session, onUpdate, hasKB }: Props) {
  const [requirement, setRequirement] = useState(session.agent_outputs.requirement || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewingAgent, setViewingAgent] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const state = session.workflow_state
  const outputs = session.agent_outputs

  const run = async (fn: () => Promise<any>) => {
    setLoading(true)
    setError('')
    try {
      const res = await fn()
      // Refresh session state from server
      const updated = await api.sdlc.state(session.id) as any
      onUpdate({
        workflow_state: updated.workflow_state,
        agent_outputs: updated.agent_outputs,
        jira_backlog: updated.jira_backlog,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openAgent = (key: string) => {
    const content = outputs[key as keyof AgentOutputs] || ''
    setEditContent(content)
    setViewingAgent(key)
  }

  const isWaiting = (approval: WorkflowState) => state === approval

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Pipeline visualization */}
      <div style={{
        padding: '0.75rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: '0.25rem',
        alignItems: 'center',
        overflowX: 'auto',
      }}>
        {AGENTS.map((agent, i) => {
          const status = agentStatus(agent.key, state, outputs)
          return (
            <div key={agent.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <button
                onClick={() => outputs[agent.key as keyof AgentOutputs] && openAgent(agent.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.4rem 0.5rem',
                  background: status === 'done' ? 'var(--green-glow)' : 'var(--bg-2)',
                  border: `1px solid ${status === 'done' ? 'var(--green-mute)' : status === 'running' ? 'var(--amber-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: outputs[agent.key as keyof AgentOutputs] ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  minWidth: '52px',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{agent.icon}</span>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: status === 'done' ? 'var(--green)' : status === 'running' ? 'var(--amber)' : 'var(--text-3)',
                }}>
                  {status === 'running' ? '⟳' : status === 'done' ? '✓' : ''} {agent.label}
                </span>
              </button>
              {i < AGENTS.length - 1 && (
                <span style={{ color: 'var(--border-2)', fontSize: '0.7rem' }}>→</span>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

        {/* IDLE: Start CR */}
        {(state === 'idle' || state === 'done') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {state === 'done' && (
              <div style={{ padding: '0.6rem 0.9rem', background: 'var(--green-glow)', border: '1px solid var(--green-mute)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--green)' }}>
                🎉 SDLC Pipeline complete! Start a new CR below.
              </div>
            )}
            <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Change Request
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the feature or change required..."
              value={requirement}
              onChange={e => setRequirement(e.target.value)}
              disabled={!hasKB}
              style={{ resize: 'vertical' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => run(() => api.sdlc.start(session.id, requirement))}
              disabled={!hasKB || loading || !requirement.trim()}
              style={{ justifyContent: 'center' }}
            >
              {loading ? '⟳ Running BA...' : '▶ Start SDLC Pipeline'}
            </button>
            {!hasKB && <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Scan repo first to enable SDLC.</div>}
          </div>
        )}

        {/* Running states */}
        {state.startsWith('running_') && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-2)', fontSize: '0.82rem' }}>
            <div className="blink" style={{ color: 'var(--green)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>⟳</div>
            Agent running...
          </div>
        )}

        {/* WAITING BA APPROVAL */}
        {isWaiting('waiting_ba_approval') && (
          <ApprovalCard
            title="BA — Business Requirements Document"
            agentKey="ba"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('ba')}
            onApprove={() => run(() => api.sdlc.approveBa(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveBa(session.id, editContent))}
          />
        )}

        {/* WAITING SA APPROVAL */}
        {isWaiting('waiting_sa_approval') && (
          <ApprovalCard
            title="SA — System Architecture Document"
            agentKey="sa"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('sa')}
            onApprove={() => run(() => api.sdlc.approveSa(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveSa(session.id, editContent))}
          />
        )}

        {/* WAITING DEV LEAD APPROVAL */}
        {isWaiting('waiting_dev_lead_approval') && (
          <ApprovalCard
            title="Dev Lead — Implementation Plan"
            agentKey="dev_lead"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('dev_lead')}
            onApprove={() => run(() => api.sdlc.approveDevLead(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveDevLead(session.id, editContent))}
          />
        )}

        {/* DONE — show all outputs */}
        {state === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Agent Outputs — click to view
            </div>
            {AGENTS.filter(a => outputs[a.key as keyof AgentOutputs]).map(agent => (
              <button key={agent.key} className="btn btn-ghost" onClick={() => openAgent(agent.key)}
                style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                <span>{agent.icon}</span>
                <span style={{ color: 'var(--text)' }}>{agent.full}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '0.7rem' }}>view →</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,68,68,0.06)', border: '1px solid var(--red-dim)', borderRadius: 'var(--radius)', color: 'var(--red)', fontSize: '0.78rem' }}>
            ❌ {error}
          </div>
        )}
      </div>

      {/* Agent output viewer/editor modal */}
      {viewingAgent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
            padding: '0.6rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center',
          }}>
            <span style={{ color: 'var(--green)', fontSize: '0.82rem', fontWeight: 600 }}>
              {AGENTS.find(a => a.key === viewingAgent)?.full} Output
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
              {isWaiting('waiting_ba_approval') && viewingAgent === 'ba' ? '— edit before approving' :
               isWaiting('waiting_sa_approval') && viewingAgent === 'sa' ? '— edit before approving' :
               isWaiting('waiting_dev_lead_approval') && viewingAgent === 'dev_lead' ? '— edit before approving' : ''}
            </span>
            <button className="btn btn-ghost" onClick={() => setViewingAgent(null)} style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem' }}>✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Rendered view */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
              <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(editContent) }} />
            </div>
            {/* Edit textarea */}
            <div style={{ width: '45%', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                ✎ Edit
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg)', border: 'none', outline: 'none',
                  padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  color: 'var(--text)', lineHeight: 1.6, resize: 'none',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ title, agentKey, outputs, loading, onView, onApprove, onApproveEdited }: {
  title: string; agentKey: string; outputs: AgentOutputs;
  loading: boolean; onView: () => void; onApprove: () => void; onApproveEdited: () => void;
}) {
  const content = outputs[agentKey as keyof AgentOutputs] || ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        ⏳ Awaiting approval: {title}
      </div>
      <div style={{
        padding: '0.7rem', background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
        maxHeight: '120px', overflow: 'hidden', position: 'relative',
      }}>
        {content.slice(0, 400)}...
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, var(--bg-2))' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-ghost" onClick={onView} style={{ flex: 1, justifyContent: 'center' }}>
          View & Edit
        </button>
        <button className="btn btn-amber" onClick={onApprove} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
          {loading ? '⟳' : '✓ Approve →'}
        </button>
      </div>
    </div>
  )
}

function mdToHtml(md: string): string {
  return md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\|(.+)\|$/gm, (row) => `<tr>${row.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('')}</tr>`)
    .replace(/(<tr>[\s\S]*?<\/tr>)/g, '<table>$1</table>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
}
