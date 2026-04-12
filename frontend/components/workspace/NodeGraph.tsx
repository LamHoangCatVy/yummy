'use client'

import React, { useState } from 'react'
import type { FileNode } from '@/lib/types'

interface NodeGraphProps {
  tree: FileNode[]
  repoInfo: { owner: string; repo: string } | null
}

interface GraphNode {
  id: string
  label: string
  type: string
  color: string
  x: number
  y: number
  count: number
  desc: string
  entities: string
}

export default function NodeGraph({ tree, repoInfo }: NodeGraphProps) {
  const [hovered, setHovered] = useState<(GraphNode & { mx: number; my: number }) | null>(null)

  if (!tree || tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-base" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-15">⬡</div>
        <p>No topology graph yet.</p>
        <p className="text-xs">Run /scan to generate the architecture view.</p>
      </div>
    )
  }

  // Group files by top-level directory
  const counts: Record<string, number> = {}
  const fileMap: Record<string, string[]> = {}
  tree.forEach(f => {
    const parts = f.path.toLowerCase().split('/')
    let key = parts[0]
    if ((key === 'src' || key === 'app') && parts.length > 1) key = parts[1]
    if (key && !key.includes('.')) {
      counts[key] = (counts[key] || 0) + 1
      if (!fileMap[key]) fileMap[key] = []
      fileMap[key].push(f.path.split('/').pop() || '')
    }
  })

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const coreLabel = repoInfo?.repo ? repoInfo.repo.toUpperCase().slice(0, 12) : 'CORE'

  const nodes: GraphNode[] = [
    { id: 'core', label: coreLabel, type: 'Gateway/Core', color: '#ffb300', x: 400, y: 250, count: tree.length, desc: 'Entry point', entities: 'App, Main, Server' },
  ]

  sorted.forEach((entry, idx) => {
    const angle = (idx / sorted.length) * Math.PI * 2
    const r = 175
    let color = '#00aaff', type = 'Domain Service'
    if (entry[0].match(/db|model|data|store/)) { color = '#00ff88'; type = 'Data Layer' }
    else if (entry[0].match(/ui|view|page|component/)) { color = '#aa88ff'; type = 'Presentation' }
    else if (entry[0].match(/api|route|controller/)) { color = '#ff6644'; type = 'API Gateway' }
    nodes.push({
      id: entry[0],
      label: entry[0].toUpperCase().slice(0, 10),
      type, color,
      x: 400 + Math.cos(angle) * r,
      y: 250 + Math.sin(angle) * r,
      count: entry[1],
      desc: `/${entry[0]} directory`,
      entities: fileMap[entry[0]].slice(0, 3).join(', '),
    })
  })

  return (
    <div className="relative w-full h-full rounded-lg" style={{ background: 'var(--bg)' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 500">
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="6" refX="26" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="#2a3a30" />
          </marker>
          {nodes.map(n => (
            <radialGradient key={`g${n.id}`} id={`g${n.id}`} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor={n.color} stopOpacity=".3" />
              <stop offset="100%" stopColor={n.color} stopOpacity=".05" />
            </radialGradient>
          ))}
        </defs>

        {/* Edges */}
        {nodes.map((n, i) => {
          if (i === 0) return null
          const c = nodes[0]
          return (
            <g key={`e${i}`}>
              <line x1={c.x} y1={c.y} x2={n.x} y2={n.y} stroke="#1e2e24" strokeWidth="1.5" markerEnd="url(#arr)" />
              <rect x={(c.x + n.x) / 2 - 28} y={(c.y + n.y) / 2 - 9} width="56" height="18" rx="3" fill="#0d1210" stroke="#1e2e24" strokeWidth="1" />
              <text x={(c.x + n.x) / 2} y={(c.y + n.y) / 2 + 4} textAnchor="middle" fill="#3a5a48" fontSize="8" fontFamily="monospace">
                {n.type.includes('Presentation') ? 'IMPORTS' : 'REST/gRPC'}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map(n => (
          <g key={n.id}
            onMouseEnter={(e) => setHovered({ ...n, mx: e.clientX, my: e.clientY })}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          >
            <circle cx={n.x} cy={n.y} r="38" fill={`url(#g${n.id})`} stroke={n.color} strokeWidth="2" />
            <circle cx={n.x} cy={n.y} r="32" fill="#0d1210" />
            <text x={n.x} y={n.y - 5} textAnchor="middle" fill={n.color} fontSize="9.5" fontWeight="bold" fontFamily="monospace">{n.label}</text>
            <text x={n.x} y={n.y + 9} textAnchor="middle" fill="#3a5a48" fontSize="8" fontFamily="monospace">{n.count} files</text>
          </g>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="fixed z-[100] rounded-lg pointer-events-none text-sm"
          style={{
            left: Math.min(hovered.mx + 12, window.innerWidth - 260),
            top: hovered.my + 12,
            background: '#111a14', border: '1px solid #1e2e24',
            padding: '.75rem', width: 240,
          }}
        >
          <div className="flex items-center gap-1.5 mb-2 pb-2" style={{ borderBottom: '1px solid #1e2e24' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: hovered.color }} />
            <strong style={{ color: '#c8ddd2', fontFamily: 'Syne, sans-serif' }}>{hovered.label}</strong>
            <span className="ml-auto text-2xs" style={{ background: '#080c0a', border: '1px solid #1e2e24', color: '#3a5a48', padding: '1px 6px', borderRadius: 3 }}>{hovered.type}</span>
          </div>
          <div style={{ color: '#7a9e8a', lineHeight: 1.7 }}>
            <div><span style={{ color: '#3a5a48' }}>Entities: </span>{hovered.entities}</div>
            <div><span style={{ color: '#3a5a48' }}>Files: </span><strong style={{ color: '#00ff88' }}>{hovered.count}</strong></div>
            <div><span style={{ color: '#3a5a48' }}>Desc: </span>{hovered.desc}</div>
          </div>
        </div>
      )}
    </div>
  )
}
