'use client'

import React, { useState } from 'react'
import type { FileNode } from '@/lib/types'

// ─── Tree builder ────────────────────────────────────────────────────────────

export interface TreeNodeData {
  name: string
  path: string
  isDir: boolean
  status: string | null
  children: Record<string, TreeNodeData>
}

export function buildFileTree(flatList: FileNode[]): TreeNodeData {
  const root: TreeNodeData = { name: 'root', children: {}, isDir: true, path: '', status: null }

  flatList.forEach(file => {
    const parts = file.path.split('/')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!cur.children[part]) {
        const isFile = i === parts.length - 1
        cur.children[part] = {
          name: part,
          children: {},
          isDir: !isFile,
          path: isFile ? file.path : parts.slice(0, i + 1).join('/'),
          status: isFile ? file.status : null,
        }
      }
      cur = cur.children[part]
    }
  })

  return root
}

// ─── TreeNode ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNodeData
  level?: number
  onFile: (path: string) => void
  selected: string
}

export function TreeNode({ node, level = 0, onFile, selected }: TreeNodeProps) {
  const [open, setOpen] = useState(level < 2)
  const indent = level * 14 + 12

  if (!node.isDir) {
    const active = selected === node.path
    return (
      <div
        onClick={() => onFile(node.path)}
        className={`flex items-center gap-1.5 cursor-pointer font-mono text-sm ${active ? 'border-l-2 border-green-500' : 'border-l-2 border-transparent'}`}
        style={{
          paddingLeft: indent, paddingTop: 5, paddingBottom: 5, paddingRight: 8,
          background: active ? 'var(--green-glow)' : 'transparent',
          color: active ? 'var(--green)' : 'var(--text-2)',
        }}
      >
        <span className="flex-shrink-0 text-2xs opacity-70">
          {node.status === 'processing' ? '⟳' : node.status === 'done' ? '✓' : '⬡'}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 cursor-pointer text-sm"
        style={{ paddingLeft: level * 14, paddingTop: 5, paddingBottom: 5, paddingRight: 8, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}
      >
        <span className="text-2xs">{open ? '▾' : '▸'}</span>
        <span className="text-2xs" style={{ color: level === 0 ? 'var(--green)' : 'var(--amber)' }}>📁</span>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>{node.name}</span>
      </div>
      {open && (
        <div>
          {Object.values(node.children)
            .sort((a, b) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)
            .map(child => (
              <TreeNode key={child.name} node={child} level={level + 1} onFile={onFile} selected={selected} />
            ))}
        </div>
      )}
    </div>
  )
}
