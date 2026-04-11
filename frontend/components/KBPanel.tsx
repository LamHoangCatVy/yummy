'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { KnowledgeBase, ScanStatus } from '@/lib/types'

interface Props {
  hasRepo: boolean
}

export default function KBPanel({ hasRepo }: Props) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'tree' | 'summary' | 'insights'>('tree')
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchKb = async () => {
    try {
      const data = await api.kb.get() as KnowledgeBase
      setKb(data)
    } catch { }
  }

  const pollScan = () => {
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.kb.scanStatus() as ScanStatus
        setScanStatus(s)
        if (!s.running) {
          clearInterval(pollRef.current!)
          await fetchKb()
        }
      } catch { }
    }, 1500)
  }

  useEffect(() => {
    fetchKb()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startScan = async () => {
    setLoading(true)
    try {
      await api.kb.scan()
      setScanStatus({ running: true, text: 'Starting...', progress: 0 })
      pollScan()
    } catch (e: any) {
      setScanStatus({ running: false, text: `Error: ${e.message}`, progress: 0, error: true })
    } finally {
      setLoading(false)
    }
  }

  const openFile = async (path: string) => {
    try {
      const res = await api.kb.file(path) as any
      setFileContent({ path, content: res.content })
    } catch (e: any) {
      alert(e.message)
    }
  }

  const statusColor = scanStatus?.error ? 'var(--red)' : scanStatus?.running ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Scan bar */}
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: scanStatus ? '0.5rem' : 0 }}>
          <button
            className="btn btn-primary"
            onClick={startScan}
            disabled={!hasRepo || loading || scanStatus?.running}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {scanStatus?.running ? '⟳ Scanning...' : '⬡ Scan Repo'}
          </button>
          {kb && kb.file_count > 0 && (
            <span className="tag tag-green">{kb.file_count} files</span>
          )}
        </div>

        {scanStatus && (
          <div style={{ fontSize: '0.73rem' }}>
            <div style={{ color: statusColor, marginBottom: '0.3rem', wordBreak: 'break-all' }}>
              {scanStatus.text}
            </div>
            <div style={{
              height: '3px',
              background: 'var(--bg-3)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${scanStatus.progress}%`,
                background: scanStatus.error ? 'var(--red)' : 'var(--green)',
                transition: 'width 0.5s ease',
                boxShadow: '0 0 6px rgba(0,255,136,0.5)',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {kb && kb.file_count > 0 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['tree', 'summary', 'insights'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1,
              padding: '0.45rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
              color: tab === t ? 'var(--green)' : 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* File tree */}
        {tab === 'tree' && kb && (
          <div style={{ fontSize: '0.75rem' }}>
            {kb.tree.length === 0 ? (
              <div style={{ padding: '1.5rem', color: 'var(--text-3)', textAlign: 'center' }}>
                {hasRepo ? 'Click Scan Repo to index codebase' : 'Setup GitHub repo first'}
              </div>
            ) : (
              kb.tree.map((f, i) => (
                <div
                  key={i}
                  onClick={() => openFile(f.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: f.status === 'done' ? 'var(--green)' : f.status === 'processing' ? 'var(--amber)' : 'var(--text-3)',
                    boxShadow: f.status === 'done' ? '0 0 4px var(--green)' : 'none',
                  }} />
                  <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.path}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Project summary */}
        {tab === 'summary' && kb && (
          <div style={{ padding: '0.9rem' }}>
            {kb.project_summary ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(kb.project_summary) }} />
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>No summary yet. Run scan first.</div>
            )}
          </div>
        )}

        {/* Insights */}
        {tab === 'insights' && kb && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {kb.insights.map((ins, i) => (
              <details key={ins.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <summary style={{
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--text-2)',
                  listStyle: 'none',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--green)' }}>▸</span>
                  <span>Chunk {i + 1} — {ins.files.length} files</span>
                </summary>
                <div style={{ padding: '0.5rem 0.75rem 0.75rem', background: 'var(--bg-1)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '0.4rem' }}>
                    {ins.files.slice(0, 4).join(' · ')}{ins.files.length > 4 ? ` +${ins.files.length - 4}` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {ins.summary.slice(0, 300)}{ins.summary.length > 300 ? '...' : ''}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* File viewer modal */}
      {fileContent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
        }} onClick={() => setFileContent(null)}>
          <div style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            width: '100%', maxWidth: '800px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{fileContent.path}</span>
              <button className="btn btn-ghost" onClick={() => setFileContent(null)} style={{ padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <pre style={{
              flex: 1, overflow: 'auto', padding: '1rem',
              fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.6,
              margin: 0, fontFamily: 'var(--font-mono)',
            }}>
              {fileContent.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// Minimal markdown → HTML converter (for project summary)
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
}
