'use client'

import React from 'react'
import { TreeNode, buildFileTree } from './FileTree'
import type { FileNode } from '@/lib/types'

interface IdePanelProps {
  tree: FileNode[]
  ideFile: string
  ideContent: string
  ideLoading: boolean
  onFileOpen: (path: string) => void
}

export default function IdePanel({ tree, ideFile, ideContent, ideLoading, onFileOpen }: IdePanelProps) {
  const fileTree = buildFileTree(tree)

  return (
    <div className="flex h-full text-base">
      {/* File explorer sidebar */}
      <div className="border-r flex flex-col overflow-hidden"
        style={{ width: '28%', minWidth: 220, borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="flex justify-between items-center border-b text-2xs uppercase tracking-widest px-3 py-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)', letterSpacing: '.08em' }}>
          <span>FILE EXPLORER</span>
          <span className="rounded px-1.5 py-px" style={{ color: 'var(--green)', background: 'var(--green-mute)' }}>
            {tree.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto pt-1">
          {!tree.length ? (
            <div className="flex flex-col items-center justify-center text-sm gap-2 text-center px-4"
              style={{ height: '70%', color: 'var(--text-3)' }}>
              <div className="text-4xl opacity-15">📁</div>
              <p>Workspace empty.<br />Run /scan to index.</p>
            </div>
          ) : (
            Object.values(fileTree.children)
              .sort((a, b) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)
              .map(node => <TreeNode key={node.name} node={node} onFile={onFileOpen} selected={ideFile} />)
          )}
        </div>
      </div>

      {/* Editor pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b flex items-center pl-4 flex-shrink-0"
          style={{ height: 38, background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <span className="font-mono text-sm pt-1" style={{ color: 'var(--text-2)', borderTop: '2px solid #ff79c6' }}>
            {ideFile ? ideFile.split('/').pop() : 'Welcome'}
          </span>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* Line numbers */}
          <div className="border-r p-4 pr-2 font-mono text-sm text-right overflow-hidden select-none leading-relaxed"
            style={{ width: 44, background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            {Array.from({ length: 120 }).map((_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          {/* Code content */}
          <div className="flex-1 p-4 font-mono text-base overflow-auto whitespace-pre leading-relaxed"
            style={{ color: 'var(--text)' }}>
            {ideLoading
              ? <span style={{ color: 'var(--green)' }}>⟳ Loading source code...</span>
              : ideContent
                ? <code>{ideContent}</code>
                : <div className="flex flex-col items-center justify-center gap-2 opacity-20"
                    style={{ height: '60%', color: 'var(--text-3)' }}>
                    <div className="text-5xl">⬡</div>
                    <p>IDE Ready.</p>
                  </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
