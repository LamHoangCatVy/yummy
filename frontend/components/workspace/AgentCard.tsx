'use client'

import React from 'react'
import { mdToHtml } from '@/lib/mdToHtml'

interface AgentCardProps {
  dot: string
  title: string
  loading: boolean
  content?: string
  editable: boolean
  editValue: string
  onEditChange: (v: string) => void
  onApprove: () => void
  approveLabel: string
  approveColor: string
  busy: boolean
}

export default function AgentCard({
  dot, title, loading, content,
  editable, editValue, onEditChange,
  onApprove, approveLabel, approveColor, busy,
}: AgentCardProps) {
  return (
    <div className="relative">
      {/* Timeline dot */}
      <div className="absolute" style={{ left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: `2px solid ${dot}` }} />

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
        <div className="px-5 py-2.5 border-b font-bold text-sm" style={{ borderColor: 'var(--border)', color: dot }}>
          {title}
        </div>

        <div className="p-5">
          {loading ? (
            <span className="text-sm" style={{ color: 'var(--amber)' }}>⟳ AI is processing...</span>
          ) : editable ? (
            <textarea
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              className="w-full font-mono text-base resize-y rounded"
              style={{ minHeight: 280, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.75rem', borderRadius: 6, fontSize: '.82rem', lineHeight: 1.7 }}
            />
          ) : (
            content && (
              <div className="prose overflow-auto" style={{ maxHeight: 400 }} dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
            )
          )}

          {editable && (
            <div className="mt-4 flex justify-end border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={onApprove}
                disabled={busy}
                className="font-bold text-base cursor-pointer rounded"
                style={{ background: approveColor, color: 'var(--bg)', border: 'none', padding: '.45rem 1.2rem', borderRadius: 6, fontSize: '.82rem', opacity: busy ? .6 : 1 }}
              >
                ✓ {approveLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
