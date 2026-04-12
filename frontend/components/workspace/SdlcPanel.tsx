'use client'

import React from 'react'
import AgentCard from './AgentCard'
import { mdToHtml } from '@/lib/mdToHtml'
import type { Session, AgentOutputs } from '@/lib/types'

interface SdlcPanelProps {
  session: Session
  editBA: string
  editSA: string
  editDevLead: string
  busy: boolean
  onEditBA: (v: string) => void
  onEditSA: (v: string) => void
  onEditDevLead: (v: string) => void
  onApproveBA: () => void
  onApproveSA: () => void
  onApproveDevLead: () => void
}

export default function SdlcPanel({
  session, editBA, editSA, editDevLead, busy,
  onEditBA, onEditSA, onEditDevLead,
  onApproveBA, onApproveSA, onApproveDevLead,
}: SdlcPanelProps) {
  const outputs: AgentOutputs = session.agent_outputs || {}
  const state = session.workflow_state

  if (!outputs.requirement) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p>Type <code>/cr [requirement]</code> in the terminal to start SDLC.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: 'var(--amber)' }}>
        ⚡ Multi-Agent SDLC Brainstorm
      </h2>

      <div className="relative pl-12 flex flex-col gap-8 max-w-[820px]">
        {/* Vertical timeline line */}
        <div className="absolute top-0 bottom-0 w-px" style={{ left: 22, background: 'var(--border)' }} />

        {(outputs.ba || state === 'running_ba') && (
          <AgentCard dot="var(--green)" title="1. Business Analyst (BRD)"
            loading={state === 'running_ba' && !outputs.ba}
            content={outputs.ba} editable={state === 'waiting_ba_approval'}
            editValue={editBA} onEditChange={onEditBA}
            onApprove={onApproveBA} approveLabel="Approve BA" approveColor="var(--green)" busy={busy} />
        )}

        {(outputs.sa || state === 'running_sa') && (
          <AgentCard dot="#00aaff" title="2. Solution Architect (Design)"
            loading={state === 'running_sa' && !outputs.sa}
            content={outputs.sa} editable={state === 'waiting_sa_approval'}
            editValue={editSA} onEditChange={onEditSA}
            onApprove={onApproveSA} approveLabel="Approve SA" approveColor="#00aaff" busy={busy} />
        )}

        {(outputs.dev_lead || state === 'running_dev_lead') && (
          <AgentCard dot="var(--amber)" title="3. Tech Lead (Plan)"
            loading={state === 'running_dev_lead' && !outputs.dev_lead}
            content={outputs.dev_lead} editable={state === 'waiting_dev_lead_approval'}
            editValue={editDevLead} onEditChange={onEditDevLead}
            onApprove={onApproveDevLead} approveLabel="Approve Dev Lead" approveColor="var(--amber)" busy={busy} />
        )}

        {(outputs.dev || outputs.security || state === 'running_rest') && (
          <div className="relative">
            <div className="absolute" style={{ left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: '2px solid #aa88ff' }} />
            <div className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="border-b px-5 py-2.5 text-sm font-bold"
                style={{ background: 'rgba(170,136,255,.08)', borderColor: 'var(--border)', color: '#aa88ff' }}>
                4. Implementation &amp; Verification
              </div>
              <div className="p-5 flex flex-col gap-4">
                {([
                  { key: 'dev',      label: '💻 Lead Developer',  color: 'var(--amber)' },
                  { key: 'security', label: '🔐 Security Review', color: 'var(--red)' },
                  { key: 'qa',       label: '🧪 QA Engineer',     color: '#aa88ff' },
                  { key: 'sre',      label: '🚀 SRE / DevOps',    color: '#44ddff' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className="border rounded-lg px-4 py-3"
                    style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                    <div className="text-xs font-bold mb-2" style={{ color }}>{label}</div>
                    {(outputs as any)[key]
                      ? <div className="prose overflow-auto" style={{ maxHeight: 280 }}
                          dangerouslySetInnerHTML={{ __html: mdToHtml((outputs as any)[key]) }} />
                      : <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {state === 'running_rest' ? '⟳ Processing...' : '—'}
                        </span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="border rounded-lg px-6 py-4 font-bold text-center"
            style={{ background: 'var(--green-mute)', borderColor: 'var(--green-dim)', color: 'var(--green)' }}>
            🎉 SDLC Pipeline complete! Check the JIRA Kanban for the backlog.
          </div>
        )}
      </div>
    </div>
  )
}
