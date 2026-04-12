'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { Session, SystemStatus } from '@/lib/types'

interface DbPanelProps {
  sessions: Session[]
  currentSessionId: string
  status: SystemStatus | null
}

export default function DbPanel({ sessions, currentSessionId, status }: DbPanelProps) {
  const router = useRouter()

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: '#ff6644' }}>
        ⬡ Backend Store
      </h2>

      {/* Info banner */}
      <div className="border rounded-lg px-5 py-4 mb-6 flex gap-3.5 text-sm"
        style={{ background: 'rgba(255,68,68,.06)', borderColor: 'rgba(255,68,68,.2)', color: 'rgba(255,100,100,.9)' }}>
        <span className="text-2xl">⬡</span>
        <div>
          <strong className="block mb-1" style={{ color: '#ff6644' }}>Zero-Trust In-Memory Store (FastAPI Backend)</strong>
          In production (Banking/Enterprise), data is secured on-premise.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'KB Files',  value: status?.kb_files ?? 0,       color: 'var(--green)' },
          { label: 'KB Chunks', value: status?.kb_insights ?? 0,    color: '#00aaff' },
          { label: 'Sessions',  value: status?.total_sessions ?? 0, color: '#aa88ff' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border rounded-lg p-4 text-center"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-2xs uppercase tracking-wide mt-1"
              style={{ color: 'var(--text-3)', letterSpacing: '.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <div className="text-2xs uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-3)', letterSpacing: '.08em' }}>⬡ Active Workspaces</div>
      <div className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="grid border-b px-4 py-2 text-2xs uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 2fr 100px 140px', borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)', letterSpacing: '.04em' }}>
          <span>ID</span><span>Name</span><span>Q&amp;A Pairs</span><span>Created</span>
        </div>
        {sessions.map(s => (
          <div key={s.id}
            className="grid border-b items-center cursor-pointer"
            style={{ gridTemplateColumns: '1fr 2fr 100px 140px', padding: '.55rem 1rem', borderColor: 'var(--border)', background: s.id === currentSessionId ? 'var(--green-glow)' : 'transparent' }}
            onClick={() => router.push(`/workspace/${s.id}`)}>
            <span className="font-mono text-2xs truncate" style={{ color: 'var(--green)' }}>{s.id.slice(0, 10)}…</span>
            <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{s.name}</span>
            <span className="border rounded text-2xs w-fit"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '1px 8px' }}>
              {Math.floor((s.chat_history?.length || 0) / 2)} pairs
            </span>
            <span className="text-2xs" style={{ color: 'var(--text-3)' }}>
              {new Date(s.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
