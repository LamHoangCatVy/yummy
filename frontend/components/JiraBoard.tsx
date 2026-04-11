'use client'
import type { JiraEpic } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  backend:  '#00aaff',
  frontend: '#aa88ff',
  devops:   '#ffb300',
  security: '#ff6644',
  testing:  '#00ff88',
}

interface Props {
  backlog: JiraEpic[]
}

export default function JiraBoard({ backlog }: Props) {
  if (backlog.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: '0.8rem', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '2rem', opacity: 0.3 }}>⬡</div>
        <div>JIRA backlog generated after SA approval</div>
      </div>
    )
  }

  const totalTasks = backlog.reduce((n, e) => n + e.tasks.length, 0)
  const totalPoints = backlog.reduce((n, e) => n + e.tasks.reduce((m, t) => m + (t.story_points || 0), 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header stats */}
      <div style={{
        display: 'flex', gap: '1rem', padding: '0.6rem 0.9rem',
        borderBottom: '1px solid var(--border)', fontSize: '0.75rem',
      }}>
        <span><span style={{ color: 'var(--green)' }}>{backlog.length}</span> epics</span>
        <span><span style={{ color: 'var(--amber)' }}>{totalTasks}</span> tasks</span>
        {totalPoints > 0 && <span><span style={{ color: 'var(--text-2)' }}>{totalPoints}</span> pts</span>}
      </div>

      {/* Epics */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {backlog.map((epic, ei) => (
          <div key={ei} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>

            {/* Epic header */}
            <div style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-2)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ color: 'var(--green)', fontSize: '0.7rem' }}>EPIC</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                {epic.title}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                {epic.tasks.length} tasks
              </span>
            </div>

            {/* Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {epic.tasks.map((task, ti) => (
                <details key={ti} style={{ borderBottom: ti < epic.tasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <summary style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.45rem 0.75rem', cursor: 'pointer', listStyle: 'none',
                  }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>▸</span>
                    <span style={{
                      fontSize: '0.68rem', padding: '0.1em 0.4em', borderRadius: 'var(--radius)',
                      background: `${TYPE_COLORS[task.type] || '#888'}18`,
                      color: TYPE_COLORS[task.type] || '#888',
                      border: `1px solid ${TYPE_COLORS[task.type] || '#888'}44`,
                      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0,
                    }}>
                      {task.type}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text)', flex: 1 }}>{task.title}</span>
                    {task.story_points && (
                      <span style={{
                        fontSize: '0.68rem', padding: '0.1em 0.4em', borderRadius: 'var(--radius)',
                        background: 'var(--bg-3)', color: 'var(--text-2)',
                        border: '1px solid var(--border)', flexShrink: 0,
                      }}>
                        {task.story_points} pts
                      </span>
                    )}
                  </summary>

                  {task.subtasks.length > 0 && (
                    <div style={{ padding: '0.3rem 0.75rem 0.6rem 2.2rem', background: 'var(--bg-1)' }}>
                      {task.subtasks.map((sub, si) => (
                        <div key={si} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-2)', padding: '0.15rem 0', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: '0.1rem' }}>○</span>
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
