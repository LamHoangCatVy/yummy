'use client'

import React from 'react'
import type { JiraEpic } from '@/lib/types'

interface BacklogPanelProps {
  backlog: JiraEpic[]
}

const TASK_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  backend:  { bg: 'rgba(0,170,255,.15)',   color: '#00aaff' },
  frontend: { bg: 'rgba(170,136,255,.15)', color: '#aa88ff' },
  devops:   { bg: 'rgba(255,179,0,.12)',   color: 'var(--amber)' },
  security: { bg: 'rgba(255,68,68,.12)',   color: 'var(--red)' },
  testing:  { bg: 'rgba(68,221,255,.12)',  color: '#44ddff' },
}

export default function BacklogPanel({ backlog }: BacklogPanelProps) {
  if (!backlog?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p>Backlog empty. Run /cr to generate JIRA tasks.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: '#aa88ff' }}>
        ⬡ JIRA Kanban Backlog
      </h2>
      <div className="flex flex-col gap-5 max-w-[820px]">
        {backlog.map((epic, ei) => (
          <div key={ei} className="border rounded-lg overflow-hidden"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="border-b px-5 py-3 flex items-center gap-2.5"
              style={{ background: 'rgba(170,136,255,.1)', borderColor: 'var(--border)' }}>
              <span className="text-white text-2xs font-extrabold rounded"
                style={{ background: '#7c3aed', padding: '2px 8px' }}>EPIC</span>
              <span className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>{epic.title}</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {epic.tasks?.map((task, ti) => {
                const ts = TASK_TYPE_STYLE[task.type] ?? TASK_TYPE_STYLE.devops
                return (
                  <div key={ti} className="border rounded-lg px-3.5 py-2.5"
                    style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 mb-1.5"
                      style={{ marginBottom: task.subtasks?.length ? undefined : 0 }}>
                      <span className="text-2xs rounded font-bold"
                        style={{ padding: '2px 7px', background: ts.bg, color: ts.color }}>
                        {task.type?.toUpperCase()}
                      </span>
                      <span className="text-md font-semibold" style={{ color: 'var(--text)' }}>{task.title}</span>
                      {task.story_points && (
                        <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
                          {task.story_points} pts
                        </span>
                      )}
                    </div>
                    {task.subtasks?.length > 0 && (
                      <div className="pl-4 flex flex-col gap-0.5">
                        {task.subtasks.map((sub, si) => (
                          <div key={si} className="text-xs flex gap-1" style={{ color: 'var(--text-3)' }}>
                            <span className="opacity-50">└</span> {sub}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
