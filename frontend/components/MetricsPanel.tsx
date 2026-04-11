'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { MetricsData } from '@/lib/types'

export default function MetricsPanel() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const d = await api.metrics() as MetricsData
      setData(d)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: '0.8rem' }}>
      {loading ? 'Loading...' : 'No metrics yet'}
    </div>
  )

  const agentEntries = Object.entries(data.agent_breakdown || {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Requests', value: data.total_requests },
          { label: 'Cost (USD)', value: `$${data.total_cost_usd.toFixed(5)}` },
          { label: 'Agents', value: agentEntries.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '0.75rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--green)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Agent breakdown */}
      {agentEntries.length > 0 && (
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Agent Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {agentEntries.map(([agent, stats]) => (
              <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--green)', width: '80px', flexShrink: 0 }}>{agent}</span>
                <div style={{ flex: 1, height: '4px', background: 'var(--bg-3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (stats.calls / data.total_requests) * 100)}%`,
                    background: 'var(--green)',
                    boxShadow: '0 0 4px rgba(0,255,136,0.4)',
                  }} />
                </div>
                <span style={{ color: 'var(--text-2)', width: '40px', textAlign: 'right' }}>{stats.calls}x</span>
                <span style={{ color: 'var(--text-3)', width: '60px', textAlign: 'right' }}>${stats.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request log */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '50px 60px 80px 55px 55px 55px 65px', gap: '0', borderBottom: '1px solid var(--border)', padding: '0.3rem 0.5rem', fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, background: 'var(--bg-1)' }}>
          <span>#</span><span>Time</span><span>Agent</span><span>In</span><span>Out</span><span>Lat</span><span>Cost</span>
        </div>
        {data.logs.map((log, i) => (
          <div key={log.id} style={{
            display: 'grid',
            gridTemplateColumns: '50px 60px 80px 55px 55px 55px 65px',
            gap: '0',
            padding: '0.3rem 0.5rem',
            fontSize: '0.72rem',
            borderBottom: '1px solid var(--border)',
            background: i % 2 === 0 ? 'transparent' : 'var(--bg-1)',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text-3)' }}>{i + 1}</span>
            <span style={{ color: 'var(--text-2)' }}>{log.time}</span>
            <span style={{ color: 'var(--green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.agent}</span>
            <span style={{ color: 'var(--text-2)' }}>{(log.in_tokens / 1000).toFixed(1)}k</span>
            <span style={{ color: 'var(--text-2)' }}>{(log.out_tokens / 1000).toFixed(1)}k</span>
            <span style={{ color: 'var(--text-2)' }}>{log.latency}s</span>
            <span style={{ color: log.cost > 0.001 ? 'var(--amber)' : 'var(--text-3)' }}>${log.cost.toFixed(4)}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost" onClick={fetch} style={{ fontSize: '0.72rem' }}>
          ⟳ Refresh
        </button>
      </div>
    </div>
  )
}
