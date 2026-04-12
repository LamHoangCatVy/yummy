'use client'

import React from 'react'
import { mdToHtml } from '@/lib/mdToHtml'
import type { ChatMessage } from '@/lib/types'

interface RagPanelProps {
  chatHistory: ChatMessage[]
}

export default function RagPanel({ chatHistory }: RagPanelProps) {
  if (!chatHistory.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-4xl opacity-20">💬</div>
        <p>No history yet. Type /ask in the chat.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: '#00aaff' }}>
        ⬡ RAG &amp; Chat History
      </h2>
      <div className="flex flex-col gap-5 pb-8 max-w-[860px] mx-auto">
        {chatHistory.map((m, i) => (
          <div key={i} className="border rounded-xl px-5 py-4"
            style={{
              borderColor: 'var(--border)',
              background: m.role === 'user' ? 'var(--green-glow)' : 'var(--bg)',
              marginLeft: m.role === 'user' ? '10%' : 0,
            }}>
            <div className="text-2xs uppercase tracking-wide font-bold mb-2"
              style={{ color: m.role === 'user' ? 'var(--green)' : 'var(--text-3)', letterSpacing: '.06em' }}>
              {m.role === 'user' ? '🔍 User Query' : '🤖 AI Response'}
            </div>
            {m.role === 'user'
              ? <p style={{ color: 'var(--text)', fontSize: '.9rem' }}>{m.text}</p>
              : <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
            }
            {m.trace && (
              <details className="mt-2.5">
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-3)' }}>
                  ⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks
                </summary>
                <div className="mt-2 p-3 border rounded text-xs leading-relaxed"
                  style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                  <div className="mb-1.5" style={{ color: 'var(--text-3)' }}>
                    Intent: <strong style={{ color: 'var(--amber)' }}>{m.trace.intent}</strong>
                  </div>
                  {m.trace.source_chunks?.map((c: any, j: number) => (
                    <div key={j} className="border rounded p-2 mb-1.5"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                      <div className="mb-0.5 text-2xs" style={{ color: 'var(--amber)' }}>
                        {c.files?.slice(0, 3).join(' · ')}
                      </div>
                      <div style={{ color: 'var(--text-3)' }}>{c.summary_preview || c.summary}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
