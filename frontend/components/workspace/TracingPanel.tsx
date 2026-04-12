'use client'

import type { MetricsData } from '@/lib/types'

interface TracingPanelProps {
  metrics: MetricsData | null
  onLoad: () => void
}

export default function TracingPanel({ metrics, onLoad }: TracingPanelProps) {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center flex-1 h-full">
        <button onClick={onLoad} className="border rounded cursor-pointer font-mono"
          style={{ background: 'none', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '.5rem 1rem' }}>
          ⟳ Load Metrics
        </button>
      </div>
    )
  }

  const limit = (metrics as any).cost_limit_usd as number | undefined
  const pct   = limit ? Math.min(100, (metrics.total_cost_usd / limit) * 100) : 0
  const overLimit = limit ? metrics.total_cost_usd >= limit : false

  return (
    <div className="p-3 flex flex-col gap-2 h-full overflow-auto">

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Requests', value: String(metrics.total_requests), color: 'var(--green)' },
          { label: 'Cost (est)', value: `$${metrics.total_cost_usd.toFixed(4)}`, color: overLimit ? 'var(--red)' : 'var(--amber)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border rounded-lg text-center"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '.65rem' }}>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-2xs uppercase tracking-wide mt-0.5"
              style={{ color: 'var(--text-3)', letterSpacing: '.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Demo budget bar */}
      {limit && (
        <div className="border rounded-lg px-3 py-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex justify-between text-2xs mb-1.5">
            <span style={{ color: 'var(--text-3)' }}>Demo budget</span>
            <span style={{ color: overLimit ? 'var(--red)' : 'var(--amber)', fontWeight: 700 }}>
              ${metrics.total_cost_usd.toFixed(2)} / ${limit}
              {overLimit && '  ⚠ LIMIT REACHED'}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--bg-2)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct > 80 ? 'var(--red)' : 'var(--amber)',
              }} />
          </div>
        </div>
      )}

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
