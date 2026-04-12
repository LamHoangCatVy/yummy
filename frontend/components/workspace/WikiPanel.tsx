'use client'

import React from 'react'
import { mdToHtml } from '@/lib/mdToHtml'
import type { KnowledgeBase } from '@/lib/types'

interface WikiPanelProps {
  kb: KnowledgeBase | null
}

export default function WikiPanel({ kb }: WikiPanelProps) {
  const exportMarkdown = () => {
    if (!kb?.project_summary) return
    const blob = new Blob([kb.project_summary], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wiki.md'
    a.click()
  }

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-[900px] mx-auto border-l border-r min-h-full"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
        <div className="flex justify-between items-center px-8 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <span className="font-display font-extrabold" style={{ fontSize: '1.05rem', color: 'var(--text)' }}>
            📖 Project Documentation
          </span>
          {kb?.project_summary && (
            <button onClick={exportMarkdown}
              className="border-none rounded cursor-pointer font-bold text-xs"
              style={{ background: 'var(--green)', color: 'var(--bg)', padding: '.3rem .8rem' }}>
              ↓ Export
            </button>
          )}
        </div>
        <div className="p-8">
          {kb?.project_summary
            ? <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(kb.project_summary) }} />
            : <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}>
                <div className="text-5xl opacity-10">📖</div>
                <p>No wiki yet. Run /scan to generate.</p>
              </div>
          }
        </div>
      </div>
    </div>
  )
}
