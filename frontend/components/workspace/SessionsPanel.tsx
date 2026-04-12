'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@/lib/types'

interface SessionsPanelProps {
  sessions: Session[]
  currentSessionId: string
  onNew: () => void
  onDeleteRequest: (s: Session) => void
}

export default function SessionsPanel({ sessions, currentSessionId, onNew, onDeleteRequest }: SessionsPanelProps) {
  const router = useRouter()

  return (
    <div className="p-3 flex flex-col gap-2 overflow-auto h-full">
      <button
        onClick={onNew}
        className="border border-dashed rounded cursor-pointer font-mono text-sm"
        style={{ padding: '.6rem', borderColor: 'var(--border)', background: 'none', color: 'var(--text-3)' }}>
        + New Workspace
      </button>

      {sessions.map(s => (
        <div
          key={s.id}
          className="relative rounded-lg cursor-pointer"
          style={{
            padding: '.65rem .75rem',
            background: s.id === currentSessionId ? 'var(--green-glow)' : 'var(--bg)',
            border: `1px solid ${s.id === currentSessionId ? 'var(--green-dim)' : 'var(--border)'}`,
            borderLeft: `3px solid ${s.id === currentSessionId ? 'var(--green)' : 'var(--border)'}`,
          }}
          onClick={() => router.push(`/workspace/${s.id}`)}
        >
          <div className="font-bold text-base truncate mb-0.5 pr-6"
            style={{ color: s.id === currentSessionId ? 'var(--green)' : 'var(--text)' }}>
            {s.name}
          </div>
          <div className="text-2xs" style={{ color: 'var(--text-3)' }}>
            {s.workflow_state?.replace(/_/g, ' ')} · {new Date(s.created_at).toLocaleDateString()}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDeleteRequest(s) }}
            title="Delete session"
            className="absolute top-1/2 -translate-y-1/2 right-2 bg-transparent border-none cursor-pointer leading-none rounded hover:text-red-500 transition-colors"
            style={{ color: 'var(--text-3)', fontSize: '.75rem', padding: '2px 4px' }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}
