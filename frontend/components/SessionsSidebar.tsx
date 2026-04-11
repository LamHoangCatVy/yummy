'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Session } from '@/lib/types'

interface Props {
  currentSessionId: string
}

const STATE_ICON: Record<string, string> = {
  idle:                      '○',
  running_ba:                '⟳',
  waiting_ba_approval:       '⏳',
  running_sa:                '⟳',
  waiting_sa_approval:       '⏳',
  running_dev_lead:          '⟳',
  waiting_dev_lead_approval: '⏳',
  running_rest:              '⟳',
  done:                      '✓',
}
const STATE_COLOR: Record<string, string> = {
  idle:                      'var(--text-3)',
  running_ba:                'var(--amber)',
  waiting_ba_approval:       'var(--amber)',
  running_sa:                'var(--amber)',
  waiting_sa_approval:       'var(--amber)',
  running_dev_lead:          'var(--amber)',
  waiting_dev_lead_approval: 'var(--amber)',
  running_rest:              'var(--amber)',
  done:                      'var(--green)',
}

export default function SessionsSidebar({ currentSessionId }: Props) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const fetchSessions = async () => {
    try {
      const data = await api.sessions.list() as Session[]
      setSessions(data)
    } catch { }
  }

  useEffect(() => {
    fetchSessions()
    const iv = setInterval(fetchSessions, 5000) // refresh every 5s
    return () => clearInterval(iv)
  }, [])

  const createSession = async () => {
    setCreating(true)
    try {
      const s = await api.sessions.create(newName || undefined) as Session
      setNewName('')
      setShowInput(false)
      await fetchSessions()
      router.push(`/workspace/${s.id}`)
    } catch { } finally {
      setCreating(false)
    }
  }

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this session?')) return
    await api.sessions.delete(id)
    await fetchSessions()
    if (id === currentSessionId && sessions.length > 1) {
      const other = sessions.find(s => s.id !== id)
      if (other) router.push(`/workspace/${other.id}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Workspaces
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => setShowInput(!showInput)}
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
        >
          +
        </button>
      </div>

      {/* New session input */}
      {showInput && (
        <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.3rem' }}>
          <input
            className="input"
            placeholder="Session name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSession()}
            autoFocus
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
          />
          <button className="btn btn-primary" onClick={createSession} disabled={creating} style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem' }}>
            {creating ? '⟳' : '✓'}
          </button>
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {sessions.map(session => {
          const active = session.id === currentSessionId
          return (
            <div
              key={session.id}
              onClick={() => router.push(`/workspace/${session.id}`)}
              style={{
                padding: '0.55rem 0.75rem',
                cursor: 'pointer',
                background: active ? 'var(--green-glow)' : 'transparent',
                borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                <span style={{
                  fontSize: '0.65rem',
                  color: STATE_COLOR[session.workflow_state] || 'var(--text-3)',
                }}>
                  {STATE_ICON[session.workflow_state] || '○'}
                </span>
                <span style={{
                  fontSize: '0.78rem',
                  color: active ? 'var(--green)' : 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {session.name}
                </span>
                <button
                  onClick={e => deleteSession(session.id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', fontSize: '0.7rem', padding: '0',
                    opacity: 0, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', paddingLeft: '0.85rem' }}>
                {session.workflow_state.replace(/_/g, ' ')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
