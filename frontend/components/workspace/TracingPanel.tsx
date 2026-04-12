'use client'

import React from 'react'
import type { MetricsData } from '@/lib/types'

interface TracingPanelProps {
  metrics: MetricsData | null
  onLoad: () => void
}

export default function TracingPanel({ metrics, onLoad }: TracingPanelProps) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center flex-1 h-full">
        <button
          onClick={onLoad}
          className="border rounded cursor-pointer font-mono"
          style={{ background: 'none', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '.5rem 1rem' }}>
          ⟳ Load Metrics
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2 h-full overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Requests', value: metrics.total_requests, color: 'var(--green)' },
          { label: 'Cost (est)', value: `$${metrics.total_cost_usd.toFixed(4)}`, color: 'var(--amber)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border rounded-lg text-center"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '.65rem' }}>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-2xs uppercase tracking-wide mt-0.5"
              style={{ color: 'var(--text-3)', letterSpacing: '.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Request log */}
      {metrics.logs.map(log => (
        <div key={log.id} className="border rounded-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '.5rem .65rem' }}>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-bold" style={{ color: 'var(--green)' }}>⚡ {log.agent}</span>
            <span className="text-2xs" style={{ color: 'var(--text-3)' }}>{log.time}</span>
          </div>
          <div className="flex justify-between text-2xs" style={{ color: 'var(--text-3)' }}>
            <span>{log.provider}{(log as any).model ? ` · ${(log as any).model}` : ''}</span>
            <span>↑{log.in_tokens} ↓{log.out_tokens}</span>
            <span>{log.latency}s</span>
            <span style={{ color: 'var(--amber)' }}>${log.cost.toFixed(5)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
