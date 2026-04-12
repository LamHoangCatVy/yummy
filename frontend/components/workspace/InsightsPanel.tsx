'use client'

import React from 'react'
import { mdToHtml } from '@/lib/mdToHtml'
import type { KnowledgeBase } from '@/lib/types'

interface InsightsPanelProps {
  kb: KnowledgeBase | null
}

export default function InsightsPanel({ kb }: InsightsPanelProps) {
  if (!kb?.insights?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p>No insights yet. Run /scan.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--amber)' }}>
        ⚡ AI Project Insights
      </h2>
      <div className="grid gap-4 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {kb.insights.map((ins, i) => (
          <div key={i} className="border rounded-lg p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap gap-1 mb-2.5 pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              {ins.files.map((f, j) => (
                <span key={j} className="border rounded font-mono text-2xs"
                  style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '2px 7px' }}>
                  {f.split('/').pop()}
                </span>
              ))}
            </div>
            <div className="prose overflow-auto" style={{ maxHeight: 200 }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(ins.summary) }} />
          </div>
        ))}
      </div>
    </div>
  )
}
