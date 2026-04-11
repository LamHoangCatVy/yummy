'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type {
  Session, SystemStatus, KnowledgeBase, ScanStatus,
  MetricsData, ChatMessage, FileNode
} from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function buildFileTree(flatList: FileNode[]) {
  const root: any = { name: 'root', children: {}, isDir: true, path: '' }
  flatList.forEach(file => {
    const parts = file.path.split('/')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!cur.children[part]) {
        const isFile = i === parts.length - 1
        cur.children[part] = {
          name: part, children: {}, isDir: !isFile,
          path: isFile ? file.path : parts.slice(0, i + 1).join('/'),
          status: isFile ? file.status : null,
        }
      }
      cur = cur.children[part]
    }
  })
  return root
}

function mdToHtml(md: string): string {
  if (!md) return ''
  let s = md.trim()
  if (s.startsWith('```markdown')) s = s.slice(11)
  else if (s.startsWith('```')) s = s.slice(3)
  if (s.endsWith('```')) s = s.slice(0, -3)

  const blocks: string[] = []
  s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
    const safe = code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()
    blocks.push(
      `<div style="margin:1rem 0;border-radius:6px;overflow:hidden;border:1px solid var(--border)">` +
      `<div style="background:var(--bg-2);padding:.3rem .8rem;font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${lang || 'code'}</div>` +
      `<pre style="padding:1rem;overflow-x:auto;background:var(--bg-1);font-size:.8rem;line-height:1.6"><code>${safe}</code></pre></div>`
    )
    return `__CB${blocks.length - 1}__`
  })

  s = s
    .replace(/^### (.*)/gm, '<h3 style="font-size:1rem;color:var(--text);margin:1rem 0 .4rem;font-family:var(--font-display)">$1</h3>')
    .replace(/^## (.*)/gm, '<h2 style="font-size:1.1rem;color:var(--green);margin:1.2rem 0 .5rem;border-bottom:1px solid var(--border);padding-bottom:.3rem;font-family:var(--font-display)">$1</h2>')
    .replace(/^# (.*)/gm, '<h1 style="font-size:1.3rem;color:var(--green);margin:1.5rem 0 .6rem;font-family:var(--font-display)">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color:var(--text-2)">$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-2);border:1px solid var(--border);color:var(--amber);padding:.1rem .35rem;border-radius:3px;font-size:.82rem">$1</code>')
    .replace(/^- (.*)/gm, '<li style="margin-left:1.2rem;list-style:disc;margin-bottom:.2rem;color:var(--text)">$1</li>')
    .replace(/^> (.*)/gm, '<blockquote style="border-left:3px solid var(--green-dim);background:var(--green-mute);padding:.5rem 1rem;margin:.5rem 0;border-radius:0 4px 4px 0;color:var(--text-2)">$1</blockquote>')

  s = s.split(/\n\n+/).map((p: string) => {
    const t = p.trim()
    if (!t) return ''
    if (t.startsWith('<') || t.startsWith('__CB')) return t
    if (t.startsWith('<li')) return `<ul style="margin:.4rem 0">${t}</ul>`
    return `<p style="margin-bottom:.6rem;line-height:1.7;color:var(--text);font-size:.85rem">${t.replace(/\n/g, '<br/>')}</p>`
  }).join('\n')

  s = s.replace(/__CB(\d+)__/g, (_: string, i: string) => blocks[+i])
  return s
}

// ─── TreeNode ────────────────────────────────────────────────────────────────

function TreeNode({ node, level = 0, onFile, selected }: any) {
  const [open, setOpen] = useState(level < 2)
  const indent = level * 14 + 12

  if (!node.isDir) {
    const active = selected === node.path
    return (
      <div
        onClick={() => onFile(node.path)}
        style={{
          paddingLeft: indent, padding: `5px 8px 5px ${indent}px`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          background: active ? 'var(--green-glow)' : 'transparent',
          borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
          fontSize: '.78rem', color: active ? 'var(--green)' : 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ flexShrink: 0, fontSize: '.65rem', opacity: .7 }}>
          {node.status === 'processing' ? '⟳' : node.status === 'done' ? '✓' : '⬡'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
    )
  }
  return (
    <div>
      <div
        onClick={() => setOpen((o: boolean) => !o)}
        style={{
          paddingLeft: level * 14, padding: `5px 8px 5px ${level * 14}px`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '.78rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ fontSize: '.65rem' }}>{open ? '▾' : '▸'}</span>
        <span style={{ color: level === 0 ? 'var(--green)' : 'var(--amber)', fontSize: '.65rem' }}>📁</span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{node.name}</span>
      </div>
      {open && (
        <div>
          {Object.values(node.children)
            .sort((a: any, b: any) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)
            .map((child: any) => (
              <TreeNode key={child.name} node={child} level={level + 1} onFile={onFile} selected={selected} />
            ))}
        </div>
      )}
    </div>
  )
}

// ─── NodeGraph ───────────────────────────────────────────────────────────────

function NodeGraph({ tree, repoInfo }: { tree: FileNode[], repoInfo: any }) {
  const [hovered, setHovered] = useState<any>(null)

  if (!tree || tree.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-3)', fontSize: '.85rem' }}>
        <div style={{ fontSize: '3rem', opacity: .15 }}>⬡</div>
        <p>Chưa có Topology Graph.</p>
        <p style={{ fontSize: '.75rem' }}>Chạy Scan Repo để AI bóc tách.</p>
      </div>
    )
  }

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
  const nodes: any[] = [
    { id: 'core', label: coreLabel, type: 'Gateway/Core', color: '#ffb300', x: 400, y: 250, count: tree.length, desc: 'Entry point', entities: 'App, Main, Server' }
  ]
  sorted.forEach((entry, idx) => {
    const angle = (idx / sorted.length) * Math.PI * 2
    const r = 175
    let color = '#00aaff', type = 'Domain Service'
    if (entry[0].match(/db|model|data|store/)) { color = '#00ff88'; type = 'Data Layer' }
    else if (entry[0].match(/ui|view|page|component/)) { color = '#aa88ff'; type = 'Presentation' }
    else if (entry[0].match(/api|route|controller/)) { color = '#ff6644'; type = 'API Gateway' }
    const entities = fileMap[entry[0]].slice(0, 3).join(', ')
    nodes.push({
      id: entry[0], label: entry[0].toUpperCase().slice(0, 10),
      type, color,
      x: 400 + Math.cos(angle) * r,
      y: 250 + Math.sin(angle) * r,
      count: entry[1], desc: `/${entry[0]} directory`, entities
    })
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg)', borderRadius: 8 }}>
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
        {nodes.map(n => (
          <g key={n.id}
            onMouseEnter={(e: any) => setHovered({ ...n, mx: e.clientX, my: e.clientY })}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={n.x} cy={n.y} r="38" fill={`url(#g${n.id})`} stroke={n.color} strokeWidth="2" />
            <circle cx={n.x} cy={n.y} r="32" fill="#0d1210" />
            <text x={n.x} y={n.y - 5} textAnchor="middle" fill={n.color} fontSize="9.5" fontWeight="bold" fontFamily="monospace">{n.label}</text>
            <text x={n.x} y={n.y + 9} textAnchor="middle" fill="#3a5a48" fontSize="8" fontFamily="monospace">{n.count} files</text>
          </g>
        ))}
      </svg>
      {hovered && (
        <div style={{
          position: 'fixed', zIndex: 100,
          left: Math.min(hovered.mx + 12, window.innerWidth - 260),
          top: hovered.my + 12,
          background: '#111a14', border: '1px solid #1e2e24',
          borderRadius: 8, padding: '.75rem', width: 240,
          pointerEvents: 'none', fontSize: '.78rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #1e2e24' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: hovered.color }} />
            <strong style={{ color: '#c8ddd2', fontFamily: 'Syne, sans-serif' }}>{hovered.label}</strong>
            <span style={{ marginLeft: 'auto', background: '#080c0a', border: '1px solid #1e2e24', color: '#3a5a48', fontSize: '.65rem', padding: '1px 6px', borderRadius: 3 }}>{hovered.type}</span>
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

// ─── AgentCard ───────────────────────────────────────────────────────────────

function AgentCard({ dot, title, loading, content, editable, editValue, onEditChange, onApprove, approveLabel, approveColor, busy }: {
  dot: string; title: string; loading: boolean; content?: string
  editable: boolean; editValue: string; onEditChange: (v: string) => void
  onApprove: () => void; approveLabel: string; approveColor: string; busy: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: `2px solid ${dot}` }} />
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '.6rem 1.25rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '.78rem', color: dot }}>
          {title}
        </div>
        <div style={{ padding: '1.25rem' }}>
          {loading ? (
            <span style={{ color: 'var(--amber)', fontSize: '.8rem' }}>⟳ AI đang xử lý...</span>
          ) : editable ? (
            <textarea
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              style={{
                width: '100%', minHeight: 280, background: 'var(--bg-1)',
                border: '1px solid var(--border)', color: 'var(--text)',
                padding: '.75rem', borderRadius: 6,
                fontFamily: 'var(--font-mono)', fontSize: '.82rem', lineHeight: 1.7, resize: 'vertical'
              }}
            />
          ) : (
            content && (
              <div className="prose" style={{ maxHeight: 400, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
            )
          )}
          {editable && (
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button
                onClick={onApprove}
                disabled={busy}
                style={{ background: approveColor, color: 'var(--bg)', border: 'none', padding: '.45rem 1.2rem', borderRadius: 6, fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', opacity: busy ? .6 : 1 }}
              >
                ✓ {approveLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

type RightTab = 'ide' | 'graph' | 'wiki' | 'insights' | 'rag' | 'sdlc' | 'backlog' | 'db'
type LeftTab = 'chat' | 'sessions' | 'tracing'

export default function WorkspacePage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params
  const router = useRouter()

  const [leftW, setLeftW] = useState(36)
  const [dragging, setDragging] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('chat')
  const [rightTab, setRightTab] = useState<RightTab>('ide')

  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  const [termLogs, setTermLogs] = useState<{ role: string; text: string }[]>([
    { role: 'system', text: '⚡ YUMMY.better than your ex\nGõ /help để xem lệnh.' }
  ])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)

  const [ideFile, setIdeFile] = useState('')
  const [ideContent, setIdeContent] = useState('')
  const [ideLoading, setIdeLoading] = useState(false)

  const [editBA, setEditBA] = useState('')
  const [editSA, setEditSA] = useState('')
  const [editDevLead, setEditDevLead] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const termRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)

  // ── fetchers ────────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    try {
      setSession(await api.sessions.get(sessionId) as Session)
    } catch (e: any) {
      if (e.message?.includes('404') || e.message?.includes('không tồn tại')) {
        // Session was deleted — renew by creating a fresh one and redirecting
        try {
          const fresh = await api.sessions.create() as Session
          router.replace(`/workspace/${fresh.id}`)
        } catch { }
      }
    }
  }, [sessionId, router])

  const fetchStatus = useCallback(async () => {
    try { setStatus(await api.config.status() as SystemStatus) } catch { }
  }, [])

  const fetchKb = useCallback(async () => {
    try { setKb(await api.kb.get() as KnowledgeBase) } catch { }
  }, [])

  const fetchSessions = useCallback(async () => {
    try { setSessions(await api.sessions.list() as Session[]) } catch { }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try { setMetrics(await api.metrics() as MetricsData) } catch { }
  }, [])

  useEffect(() => {
    fetchSession(); fetchStatus(); fetchKb(); fetchSessions()
    const iv = setInterval(() => { fetchSession(); fetchStatus() }, 4000)
    return () => clearInterval(iv)
  }, [sessionId, fetchSession, fetchStatus, fetchKb, fetchSessions])

  useEffect(() => {
    if (leftTab === 'tracing') fetchMetrics()
  }, [leftTab, fetchMetrics])

  // sync session state once on session change
  const prevId = useRef('')
  useEffect(() => {
    if (session && session.id !== prevId.current) {
      prevId.current = session.id
      setChatHistory(session.chat_history || [])
      if (session.agent_outputs?.ba) setEditBA(session.agent_outputs.ba)
      if (session.agent_outputs?.sa) setEditSA(session.agent_outputs.sa)
      if (session.agent_outputs?.dev_lead) setEditDevLead(session.agent_outputs.dev_lead)
    }
  }, [session])

  useEffect(() => {
    termRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [termLogs, chatHistory, scanStatus])

  // ── resize ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging) return
      const w = (e.clientX / window.innerWidth) * 100
      if (w > 22 && w < 78) setLeftW(w)
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])

  // ── scan poll ────────────────────────────────────────────────────────────────

  const startScanPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.kb.scanStatus() as ScanStatus
        setScanStatus(s)
        if (!s.running) {
          clearInterval(pollRef.current)
          setScanStatus(null)
          await fetchKb(); await fetchStatus()
          print('✅ Scan hoàn tất.')
          setRightTab('wiki')
        }
      } catch { }
    }, 1500)
  }

  // ── IDE ──────────────────────────────────────────────────────────────────────

  const openFile = async (path: string) => {
    setIdeFile(path); setRightTab('ide'); setIdeLoading(true); setIdeContent('')
    try {
      const res = await api.kb.file(path) as any
      setIdeContent(res.content || '// (empty)')
    } catch (e: any) {
      setIdeContent(`// [LỖI TẢI FILE]: ${e.message}`)
    } finally { setIdeLoading(false) }
  }

  // ── print ────────────────────────────────────────────────────────────────────

  const print = (text: string, role = 'system') =>
    setTermLogs(prev => [...prev, { role, text }])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── SDLC ─────────────────────────────────────────────────────────────────────

  const refreshSDLC = async () => {
    try {
      const u = await api.sdlc.state(sessionId) as any
      setSession((prev: Session | null) => prev ? { ...prev, workflow_state: u.workflow_state, agent_outputs: u.agent_outputs, jira_backlog: u.jira_backlog } : prev)
      if (u.agent_outputs?.ba) setEditBA(u.agent_outputs.ba)
      if (u.agent_outputs?.sa) setEditSA(u.agent_outputs.sa)
      if (u.agent_outputs?.dev_lead) setEditDevLead(u.agent_outputs.dev_lead)
    } catch { }
  }

  const handleApproveBA = async () => {
    setBusy(true)
    try { await api.sdlc.approveBa(sessionId, editBA); print('📧 Đã duyệt BA. Kích hoạt SA...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  const handleApproveSA = async () => {
    setBusy(true)
    try { await api.sdlc.approveSa(sessionId, editSA); print('📧 Đã duyệt SA. Kích hoạt Dev Lead...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  const handleApproveDevLead = async () => {
    setBusy(true)
    try { await api.sdlc.approveDevLead(sessionId, editDevLead); print('📧 Đã duyệt Dev Lead. Kích hoạt DEV/SEC/QA/SRE...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  // ── RAG ask ──────────────────────────────────────────────────────────────────

  const sendAsk = async (question: string) => {
    const userMsg: ChatMessage = { role: 'user', text: question }
    setChatHistory(prev => [...prev, userMsg])
    setBusy(true)
    try {
      const res = await api.ask(sessionId, question, ideFile || undefined, ideContent ? ideContent.slice(0, 3000) : undefined) as any
      setChatHistory(prev => [...prev, { role: 'assistant', text: res.answer, trace: res.trace }])
      setRightTab('rag')
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'system', text: `❌ ${e.message}` }])
    } finally { setBusy(false) }
  }

  // ── command handler ──────────────────────────────────────────────────────────

  const handleCmd = async (force?: string) => {
    const raw = (force || cmd).trim()
    if (!raw || busy) return
    setCmd('')
    print(`> ${raw}`, 'user')
    const args = raw.split(' ')
    const command = args[0].toLowerCase()

    try {
      switch (command) {
        case '/help':
          print(
            'Lệnh khả dụng:\n' +
            '  /setup <url> [token]  — Cấu hình GitHub repo\n' +
            '  /scan                 — Quét & index codebase\n' +
            '  /ask <câu hỏi>        — RAG Chat với AI\n' +
            '  /cr <yêu cầu>         — Khởi động SDLC brainstorm\n' +
            '  /new                  — Tạo workspace mới\n' +
            '  /delete [session_id]  — Xóa session (mặc định: hiện tại)\n' +
            '  /info                 — Thông tin hệ thống'
          )
          break

        case '/setup': {
          const url = args[1]
          if (!url) throw new Error('Cần URL GitHub. VD: /setup https://github.com/owner/repo')
          await api.config.setup(url, args[2] || '', 10000)
          await fetchStatus()
          print(`✅ Đã cấu hình repo: ${url}`)
          break
        }

        case '/scan': {
          if (!status?.repo) throw new Error('Chưa /setup repo. Vào tab Config để cấu hình.')
          setBusy(true)
          await api.kb.scan()
          setScanStatus({ running: true, text: 'Đang khởi động scan...', progress: 0 })
          print('🔍 Bắt đầu scan codebase...')
          setRightTab('ide')
          startScanPoll()
          setBusy(false)
          break
        }

        case '/ask': {
          const q = args.slice(1).join(' ')
          if (!q) throw new Error('Cần câu hỏi. VD: /ask Giải thích luồng auth?')
          if (!status?.kb_has_summary) throw new Error('Chưa scan KB. Chạy /scan trước.')
          setLeftTab('chat')
          await sendAsk(q)
          break
        }

        case '/cr': {
          const req = args.slice(1).join(' ')
          if (!req) throw new Error('Cần nội dung CR. VD: /cr Thêm module export PDF')
          if (!status?.kb_has_summary) throw new Error('Chưa scan KB. Chạy /scan trước.')
          setBusy(true)
          await api.sdlc.start(sessionId, req)
          print(`[BA] Đang phân tích yêu cầu...`)
          setRightTab('sdlc'); setLeftTab('tracing')
          await fetchMetrics()
          const poll = setInterval(async () => {
            const s = await api.sdlc.state(sessionId) as any
            if (s.workflow_state !== 'running_ba') {
              clearInterval(poll)
              await refreshSDLC()
              print('⚠️ BA xong. Chờ duyệt...')
              setBusy(false)
            }
          }, 2000)
          break
        }

        case '/new': {
          const s = await api.sessions.create() as Session
          await fetchSessions()
          router.push(`/workspace/${s.id}`)
          break
        }

        case '/delete': {
          const targetId = args[1] || sessionId
          await api.sessions.delete(targetId)
          await fetchSessions()
          showToast('🗑 Session deleted successfully.')
          print(`🗑 Session ${targetId.slice(0, 10)}… deleted.`)
          if (targetId === sessionId) {
            const fresh = await api.sessions.create() as Session
            await fetchSessions()
            router.replace(`/workspace/${fresh.id}`)
          }
          break
        }

        case '/info': {
          if (status) print(
            `System Info:\n- Repo: ${status.repo ? `${status.repo.owner}/${status.repo.repo}` : 'chưa set'}\n` +
            `- AI: ${status.ai_provider}${status.has_gemini_key ? ' (key OK)' : ''}\n` +
            `- KB: ${status.kb_files} files, ${status.kb_insights} chunks\n` +
            `- Sessions: ${status.total_sessions}  Cost: $${status.total_cost_usd.toFixed(5)}`
          )
          break
        }

        default: throw new Error(`Lệnh không tồn tại: ${command}. Gõ /help.`)
      }
    } catch (e: any) { print(`❌ ${e.message}`); setBusy(false) }
  }

  // ── loading ──────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '.8rem' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  const fileTree = buildFileTree(kb?.tree || [])
  const isRunning = session.workflow_state?.includes('running') || !!scanStatus?.running
  const outputs = session.agent_outputs || {}

  const RTAB = (key: RightTab, label: string, color = 'var(--text-2)') => (
    <button key={key} onClick={() => setRightTab(key)} style={{
      padding: '.45rem .9rem', background: 'none', border: 'none',
      borderBottom: rightTab === key ? `2px solid ${color}` : '2px solid transparent',
      color: rightTab === key ? color : 'var(--text-3)',
      fontFamily: 'var(--font-mono)', fontSize: '.72rem', cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )

  const LTAB = (key: LeftTab, label: string) => (
    <button key={key} onClick={() => setLeftTab(key)} style={{
      flex: 1, padding: '.5rem .3rem', background: 'none', border: 'none',
      borderBottom: leftTab === key ? '2px solid var(--green)' : '2px solid transparent',
      color: leftTab === key ? 'var(--green)' : 'var(--text-3)',
      fontFamily: 'var(--font-mono)', fontSize: '.7rem', cursor: 'pointer',
      textTransform: 'uppercase', letterSpacing: '.05em',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-mono)', background: 'var(--bg)' }}>

      {/* ═══════════════════ LEFT ═══════════════════ */}
      <div style={{ width: `${leftW}%`, minWidth: 300, display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>

        {/* header */}
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <span style={{ color: 'var(--green)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem' }}>
            YUMMY <span style={{ fontSize: '.55rem', color: 'var(--text-3)', fontWeight: 400 }}>.better than your ex</span>
          </span>
          {(isRunning || scanStatus) && (
            <span style={{ fontSize: '.62rem', color: 'var(--amber)', background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.2)', padding: '2px 8px', borderRadius: 20 }}>
              ⟳ {scanStatus?.text?.slice(0, 26) || 'running...'}
            </span>
          )}
        </div>

        {/* left tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          {LTAB('chat', '⬡ Chat')}
          {LTAB('sessions', '⬡ Session')}
          {LTAB('tracing', '⬡ Tracing')}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── CHAT ── */}
          {leftTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ background: 'var(--green-mute)', borderBottom: '1px solid var(--border)', padding: '4px 1rem', fontSize: '.68rem', color: 'var(--green)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>
                {session.name}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '.82rem', lineHeight: 1.65 }}>
                {termLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, color: log.role === 'user' ? 'var(--green)' : 'var(--text-2)' }}>
                    <span style={{ flexShrink: 0, color: 'var(--text-3)', marginTop: 2 }}>{log.role === 'user' ? '❯' : '⚡'}</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{log.text}</span>
                  </div>
                ))}

                {chatHistory.map((m, i) => (
                  <div key={`c${i}`} style={{ display: 'flex', gap: 8, color: m.role === 'user' ? 'var(--green)' : 'var(--text)' }}>
                    <span style={{ flexShrink: 0, color: 'var(--text-3)', marginTop: 2 }}>{m.role === 'user' ? '❯' : '🤖'}</span>
                    {m.role === 'user' ? (
                      <span style={{ fontWeight: 600 }}>{m.text}</span>
                    ) : (
                      <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '.75rem', borderRadius: 8 }}>
                        <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                        {m.trace && (
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ fontSize: '.68rem', color: 'var(--text-3)', cursor: 'pointer' }}>
                              ⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks
                            </summary>
                            <div style={{ marginTop: 6, padding: '.5rem', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '.7rem', color: 'var(--text-3)' }}>
                              {m.trace.source_chunks?.map((c: any, j: number) => (
                                <div key={j} style={{ marginBottom: 6 }}>
                                  <div style={{ color: 'var(--amber)' }}>{c.files?.slice(0, 3).join(' · ')}</div>
                                  <div>{c.summary_preview || c.summary}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {busy && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--amber)', fontSize: '.78rem', background: 'rgba(255,179,0,.05)', border: '1px solid rgba(255,179,0,.15)', padding: '.5rem .75rem', borderRadius: 6 }}>
                    <span>⟳</span> {scanStatus?.text || 'AI đang xử lý...'}
                  </div>
                )}
                <div ref={termRef} />
              </div>

              {/* quick cmds */}
              <div style={{ padding: '0 .75rem', display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6, flexShrink: 0 }}>
                {['/scan', '/ask Giải thích flow?', '/cr Thêm export PDF', '/help'].map((h, i) => (
                  <button key={i} onClick={() => handleCmd(h)} disabled={busy}
                    style={{ whiteSpace: 'nowrap', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '3px 10px', borderRadius: 20, fontSize: '.65rem', cursor: 'pointer', flexShrink: 0 }}>
                    ⚡ {h}
                  </button>
                ))}
              </div>

              {/* input */}
              <div style={{ padding: '.6rem .75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0, background: 'var(--bg)' }}>
                <input
                  value={cmd} onChange={e => setCmd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCmd()}
                  placeholder="Gõ /setup /scan /ask /cr..." disabled={busy} autoFocus
                  style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '.5rem .75rem', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '.82rem', outline: 'none' }}
                />
                <button onClick={() => handleCmd()} disabled={busy || !cmd.trim()}
                  style={{ background: 'var(--green)', color: 'var(--bg)', border: 'none', borderRadius: 6, padding: '.5rem .9rem', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem', opacity: busy ? .5 : 1 }}>
                  ↑
                </button>
              </div>
            </div>
          )}

          {/* ── SESSIONS ── */}
          {leftTab === 'sessions' && (
            <div style={{ padding: '.75rem', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', height: '100%' }}>
              <button onClick={() => handleCmd('/new')}
                style={{ padding: '.6rem', border: '1px dashed var(--border)', background: 'none', color: 'var(--text-3)', borderRadius: 6, cursor: 'pointer', fontSize: '.78rem', fontFamily: 'var(--font-mono)' }}>
                + Tạo Workspace Mới
              </button>
              {sessions.map(s => (
                <div key={s.id}
                  style={{ position: 'relative', padding: '.65rem .75rem', borderRadius: 8, cursor: 'pointer', background: s.id === sessionId ? 'var(--green-glow)' : 'var(--bg)', border: `1px solid ${s.id === sessionId ? 'var(--green-dim)' : 'var(--border)'}`, borderLeft: `3px solid ${s.id === sessionId ? 'var(--green)' : 'var(--border)'}` }}
                  onClick={() => router.push(`/workspace/${s.id}`)}>
                  <div style={{ fontWeight: 700, color: s.id === sessionId ? 'var(--green)' : 'var(--text)', fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3, paddingRight: '1.5rem' }}>{s.name}</div>
                  <div style={{ fontSize: '.65rem', color: 'var(--text-3)' }}>{s.workflow_state?.replace(/_/g, ' ')} · {new Date(s.created_at).toLocaleDateString()}</div>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                    title="Delete session"
                    style={{ position: 'absolute', top: '50%', right: '.5rem', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '.75rem', padding: '2px 4px', lineHeight: 1, borderRadius: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ff6644')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── TRACING ── */}
          {leftTab === 'tracing' && (
            <div style={{ padding: '.75rem', display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflow: 'auto' }}>
              {metrics ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Requests', value: metrics.total_requests, color: 'var(--green)' },
                      { label: 'Cost (est)', value: `$${metrics.total_cost_usd.toFixed(4)}`, color: 'var(--amber)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.65rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', color, fontWeight: 700 }}>{value}</div>
                        <div style={{ fontSize: '.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {metrics.logs.map(log => (
                    <div key={log.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.5rem .65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--green)', fontSize: '.72rem', fontWeight: 700 }}>⚡ {log.agent}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: '.65rem' }}>{log.time}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--text-3)' }}>
                        <span>In: {log.in_tokens}</span><span>Out: {log.out_tokens}</span>
                        <span style={{ color: 'var(--amber)' }}>${log.cost.toFixed(5)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <button onClick={fetchMetrics} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    ⟳ Load Metrics
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ═══ RESIZER ═══ */}
      <div
        onMouseDown={() => setDragging(true)}
        style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, zIndex: 50 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green)')}
        onMouseLeave={e => (e.currentTarget.style.background = dragging ? 'var(--green)' : 'var(--border)')}
      />

      {/* ═══════════════════ RIGHT ═══════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>

        {/* right tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', overflowX: 'auto', height: 44, alignItems: 'flex-end', flexShrink: 0 }}>
          {RTAB('ide', '⬡ IDE Simulator', 'var(--text-2)')}
          {RTAB('graph', '⬡ Node Arch', 'var(--green)')}
          {RTAB('wiki', '⬡ GitBook Wiki', '#ff79c6')}
          {RTAB('insights', '⬡ AI Insights', '#ffb300')}
          {RTAB('rag', '⬡ RAG Trace', '#00aaff')}
          {RTAB('sdlc', '⬡ SDLC Brainstorm', '#ffb300')}
          {RTAB('backlog', '⬡ JIRA Kanban', '#aa88ff')}
          {RTAB('db', '⬡ Local DB', '#ff6644')}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-1)' }}>

          {/* ── IDE ── */}
          {rightTab === 'ide' && (
            <div style={{ display: 'flex', height: '100%', fontSize: '.82rem' }}>
              <div style={{ width: '28%', minWidth: 220, borderRight: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '.5rem .75rem', borderBottom: '1px solid var(--border)', fontSize: '.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-1)' }}>
                  <span>FILE EXPLORER</span>
                  <span style={{ color: 'var(--green)', background: 'var(--green-mute)', padding: '1px 6px', borderRadius: 3 }}>{kb?.tree?.length || 0}</span>
                </div>
                <div style={{ flex: 1, overflow: 'auto', paddingTop: 4 }}>
                  {!kb?.tree?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', color: 'var(--text-3)', fontSize: '.78rem', gap: 8, textAlign: 'center', padding: '0 1rem' }}>
                      <div style={{ fontSize: '2.5rem', opacity: .15 }}>📁</div>
                      <p>Workspace trống.<br />Chạy /scan để index.</p>
                    </div>
                  ) : (
                    Object.values(fileTree.children)
                      .sort((a: any, b: any) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)
                      .map((node: any) => <TreeNode key={node.name} node={node} onFile={openFile} selected={ideFile} />)
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ height: 38, background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: '1rem', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--text-2)', borderTop: '2px solid #ff79c6', paddingTop: 4 }}>
                    {ideFile ? ideFile.split('/').pop() : 'Welcome'}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: 44, background: 'var(--bg)', borderRight: '1px solid var(--border)', padding: '1rem .5rem', fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: 'var(--text-3)', textAlign: 'right', overflow: 'hidden', userSelect: 'none', lineHeight: '1.6' }}>
                    {Array.from({ length: 120 }).map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <div style={{ flex: 1, padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '.82rem', color: 'var(--text)', overflow: 'auto', whiteSpace: 'pre', lineHeight: '1.6' }}>
                    {ideLoading ? <span style={{ color: 'var(--green)' }}>⟳ Tải source code...</span>
                      : ideContent ? <code>{ideContent}</code>
                        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-3)', opacity: .2, gap: 8 }}><div style={{ fontSize: '3rem' }}>⬡</div><p>IDE Ready.</p></div>
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NODE GRAPH ── */}
          {rightTab === 'graph' && (
            <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--green)', marginBottom: '1rem' }}>⬡ Node Architecture Graph</h2>
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                <NodeGraph tree={kb?.tree || []} repoInfo={status?.repo} />
              </div>
            </div>
          )}

          {/* ── WIKI ── */}
          {rightTab === 'wiki' && (
            <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
              <div style={{ maxWidth: 900, margin: '0 auto', background: 'var(--bg-1)', minHeight: '100%', border: '1px solid var(--border)', borderTop: 'none', borderBottom: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>📖 Project Documentation</span>
                  {kb?.project_summary && (
                    <button onClick={() => { const b = new Blob([kb.project_summary], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wiki.md'; a.click() }}
                      style={{ background: 'var(--green)', color: 'var(--bg)', border: 'none', padding: '.3rem .8rem', borderRadius: 5, fontSize: '.75rem', fontWeight: 700, cursor: 'pointer' }}>
                      ↓ Export
                    </button>
                  )}
                </div>
                <div style={{ padding: '2rem' }}>
                  {kb?.project_summary
                    ? <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(kb.project_summary) }} />
                    : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', gap: 12 }}><div style={{ fontSize: '3rem', opacity: .12 }}>📖</div><p>Wiki chưa có. Chạy /scan để tạo.</p></div>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── INSIGHTS ── */}
          {rightTab === 'insights' && (
            <div style={{ height: '100%', overflow: 'auto', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--amber)', marginBottom: '1rem' }}>⚡ AI Project Insights</h2>
              {!kb?.insights?.length
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', gap: 12 }}><div style={{ fontSize: '3rem', opacity: .1 }}>⬡</div><p>Chưa có insights. Chạy /scan.</p></div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem', paddingBottom: '2rem' }}>
                  {kb.insights.map((ins, i) => (
                    <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        {ins.files.map((f, j) => (
                          <span key={j} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '2px 7px', borderRadius: 3, fontSize: '.65rem', fontFamily: 'var(--font-mono)' }}>
                            {f.split('/').pop()}
                          </span>
                        ))}
                      </div>
                      <div className="prose" style={{ maxHeight: 200, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: mdToHtml(ins.summary) }} />
                    </div>
                  ))}
                </div>
              }
            </div>
          )}

          {/* ── RAG TRACE ── */}
          {rightTab === 'rag' && (
            <div style={{ height: '100%', overflow: 'auto', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#00aaff', marginBottom: '1rem' }}>⬡ RAG & Chat History</h2>
              {!chatHistory.length
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', gap: 12 }}><div style={{ fontSize: '2.5rem', opacity: .2 }}>💬</div><p>Chưa có lịch sử. Gõ /ask ở Chat.</p></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem', maxWidth: 860, margin: '0 auto' }}>
                  {chatHistory.map((m, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', background: m.role === 'user' ? 'var(--green-glow)' : 'var(--bg)', marginLeft: m.role === 'user' ? '10%' : 0 }}>
                      <div style={{ fontSize: '.68rem', color: m.role === 'user' ? 'var(--green)' : 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                        {m.role === 'user' ? '🔍 User Query' : '🤖 AI Response'}
                      </div>
                      {m.role === 'user'
                        ? <p style={{ color: 'var(--text)', fontSize: '.9rem' }}>{m.text}</p>
                        : <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                      }
                      {m.trace && (
                        <details style={{ marginTop: 10 }}>
                          <summary style={{ fontSize: '.7rem', color: 'var(--text-3)', cursor: 'pointer' }}>⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks</summary>
                          <div style={{ marginTop: 8, padding: '.75rem', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.72rem', lineHeight: 1.7 }}>
                            <div style={{ color: 'var(--text-3)', marginBottom: 6 }}>Intent: <strong style={{ color: 'var(--amber)' }}>{m.trace.intent}</strong></div>
                            {m.trace.source_chunks?.map((c: any, j: number) => (
                              <div key={j} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '.5rem', marginBottom: 6 }}>
                                <div style={{ color: 'var(--amber)', marginBottom: 3, fontSize: '.65rem' }}>{c.files?.slice(0, 3).join(' · ')}</div>
                                <div style={{ color: 'var(--text-3)' }}>{c.summary_preview || c.summary}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              }
            </div>
          )}

          {/* ── SDLC ── */}
          {rightTab === 'sdlc' && (
            <div style={{ height: '100%', overflow: 'auto', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--amber)', marginBottom: '1.5rem' }}>⚡ Multi-Agent SDLC Brainstorm</h2>
              {!outputs.requirement
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', gap: 12 }}><div style={{ fontSize: '3rem', opacity: .1 }}>⬡</div><p>Gõ <code>/cr [Yêu cầu]</code> ở Terminal để bắt đầu SDLC.</p></div>
                : (
                  <div style={{ position: 'relative', paddingLeft: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 820 }}>
                    <div style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />

                    {(outputs.ba || session.workflow_state === 'running_ba') && (
                      <AgentCard dot="var(--green)" title="1. Business Analyst (BRD)"
                        loading={session.workflow_state === 'running_ba' && !outputs.ba}
                        content={outputs.ba} editable={session.workflow_state === 'waiting_ba_approval'}
                        editValue={editBA} onEditChange={setEditBA}
                        onApprove={handleApproveBA} approveLabel="Approve BA" approveColor="var(--green)" busy={busy} />
                    )}

                    {(outputs.sa || session.workflow_state === 'running_sa') && (
                      <AgentCard dot="#00aaff" title="2. Solution Architect (Design)"
                        loading={session.workflow_state === 'running_sa' && !outputs.sa}
                        content={outputs.sa} editable={session.workflow_state === 'waiting_sa_approval'}
                        editValue={editSA} onEditChange={setEditSA}
                        onApprove={handleApproveSA} approveLabel="Approve SA" approveColor="#00aaff" busy={busy} />
                    )}

                    {(outputs.dev_lead || session.workflow_state === 'running_dev_lead') && (
                      <AgentCard dot="var(--amber)" title="3. Tech Lead (Plan)"
                        loading={session.workflow_state === 'running_dev_lead' && !outputs.dev_lead}
                        content={outputs.dev_lead} editable={session.workflow_state === 'waiting_dev_lead_approval'}
                        editValue={editDevLead} onEditChange={setEditDevLead}
                        onApprove={handleApproveDevLead} approveLabel="Approve Dev Lead" approveColor="var(--amber)" busy={busy} />
                    )}

                    {(outputs.dev || outputs.security || session.workflow_state === 'running_rest') && (
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: '2px solid #aa88ff' }} />
                        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ background: 'rgba(170,136,255,.08)', borderBottom: '1px solid var(--border)', padding: '.6rem 1.25rem', fontSize: '.78rem', fontWeight: 700, color: '#aa88ff' }}>
                            4. Implementation & Verification
                          </div>
                          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[
                              { key: 'dev', label: '💻 Lead Developer', color: 'var(--amber)' },
                              { key: 'security', label: '🔐 Security Review', color: 'var(--red)' },
                              { key: 'qa', label: '🧪 QA Engineer', color: '#aa88ff' },
                              { key: 'sre', label: '🚀 SRE / DevOps', color: '#44ddff' },
                            ].map(({ key, label, color }) => (
                              <div key={key} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '.75rem 1rem' }}>
                                <div style={{ fontSize: '.72rem', fontWeight: 700, color, marginBottom: 8 }}>{label}</div>
                                {(outputs as any)[key]
                                  ? <div className="prose" style={{ maxHeight: 280, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: mdToHtml((outputs as any)[key]) }} />
                                  : <span style={{ color: 'var(--text-3)', fontSize: '.75rem' }}>{session.workflow_state === 'running_rest' ? '⟳ Đang xử lý...' : '—'}</span>
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {session.workflow_state === 'done' && (
                      <div style={{ background: 'var(--green-mute)', border: '1px solid var(--green-dim)', borderRadius: 10, padding: '1rem 1.5rem', color: 'var(--green)', fontWeight: 700, textAlign: 'center' }}>
                        🎉 SDLC Pipeline hoàn tất! Xem JIRA Kanban để xem backlog.
                      </div>
                    )}
                  </div>
                )
              }
            </div>
          )}

          {/* ── BACKLOG ── */}
          {rightTab === 'backlog' && (
            <div style={{ height: '100%', overflow: 'auto', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#aa88ff', marginBottom: '1.5rem' }}>⬡ JIRA Kanban Backlog</h2>
              {!session.jira_backlog?.length
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', gap: 12 }}><div style={{ fontSize: '3rem', opacity: .1 }}>⬡</div><p>Backlog trống. Chạy /cr để sinh JIRA tasks.</p></div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 820 }}>
                  {session.jira_backlog.map((epic, ei) => (
                    <div key={ei} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: 'rgba(170,136,255,.1)', borderBottom: '1px solid var(--border)', padding: '.7rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: '#7c3aed', color: '#fff', fontSize: '.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 3 }}>EPIC</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>{epic.title}</span>
                      </div>
                      <div style={{ padding: '.75rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {epic.tasks?.map((task, ti) => (
                          <div key={ti} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '.65rem .9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: task.subtasks?.length ? 6 : 0 }}>
                              <span style={{ fontSize: '.6rem', padding: '2px 7px', borderRadius: 3, fontWeight: 700, background: task.type === 'backend' ? 'rgba(0,170,255,.15)' : task.type === 'frontend' ? 'rgba(170,136,255,.15)' : 'rgba(255,179,0,.12)', color: task.type === 'backend' ? '#00aaff' : task.type === 'frontend' ? '#aa88ff' : 'var(--amber)' }}>
                                {task.type?.toUpperCase()}
                              </span>
                              <span style={{ color: 'var(--text)', fontSize: '.85rem', fontWeight: 600 }}>{task.title}</span>
                              {task.story_points && <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: '.7rem' }}>{task.story_points} pts</span>}
                            </div>
                            {task.subtasks?.length > 0 && (
                              <div style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {task.subtasks.map((sub, si) => (
                                  <div key={si} style={{ fontSize: '.72rem', color: 'var(--text-3)', display: 'flex', gap: 5 }}>
                                    <span style={{ opacity: .5 }}>└</span> {sub}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          )}

          {/* ── DB ── */}
          {rightTab === 'db' && (
            <div style={{ height: '100%', overflow: 'auto', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#ff6644', marginBottom: '1.5rem' }}>⬡ Backend Store</h2>
              <div style={{ background: 'rgba(255,68,68,.06)', border: '1px solid rgba(255,68,68,.2)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: 14, fontSize: '.8rem', color: 'rgba(255,100,100,.9)' }}>
                <span style={{ fontSize: '1.5rem' }}>⬡</span>
                <div><strong style={{ color: '#ff6644', display: 'block', marginBottom: 4 }}>Zero-Trust In-Memory Store (FastAPI Backend)</strong>Trong môi trường Production (Banking/Enterprise), dữ liệu bảo mật On-Premise.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'KB Files', value: status?.kb_files ?? 0, color: 'var(--green)' },
                  { label: 'KB Chunks', value: status?.kb_insights ?? 0, color: '#00aaff' },
                  { label: 'Sessions', value: status?.total_sessions ?? 0, color: '#aa88ff' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>⬡ Active Workspaces</div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 100px 140px', padding: '.5rem 1rem', fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
                  <span>ID</span><span>Name</span><span>Q&A Pairs</span><span>Created</span>
                </div>
                {sessions.map(s => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 100px 140px', padding: '.55rem 1rem', fontSize: '.75rem', borderBottom: '1px solid var(--border)', alignItems: 'center', background: s.id === sessionId ? 'var(--green-glow)' : 'transparent' }}>
                    <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: '.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id.slice(0, 10)}…</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '1px 8px', borderRadius: 3, fontSize: '.65rem', width: 'fit-content' }}>
                      {Math.floor((s.chat_history?.length || 0) / 2)} pairs
                    </span>
                    <span style={{ color: 'var(--text-3)', fontSize: '.68rem' }}>{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteTarget(null)}>
          <div style={{ background: 'var(--bg-1)', border: '1px solid #ff664455', borderRadius: 12, padding: '1.75rem 2rem', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🗑</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#ff6644' }}>Delete Session</span>
            </div>
            <p style={{ fontSize: '.85rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '.5rem' }}>
              Are you sure you want to delete this workspace?
            </p>
            <p style={{ fontSize: '.78rem', color: 'var(--text-3)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem .75rem', fontFamily: 'var(--font-mono)', marginBottom: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deleteTarget.name}
            </p>
            <p style={{ fontSize: '.75rem', color: 'rgba(255,100,68,.7)', marginBottom: '1.5rem' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '.5rem 1.2rem', background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '.82rem' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = deleteTarget
                  setDeleteTarget(null)
                  await handleCmd(`/delete ${target.id}`)
                }}
                style={{ padding: '.5rem 1.2rem', background: '#ff6644', border: 'none', color: '#fff', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '.82rem', fontWeight: 700 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 300, background: 'var(--bg-1)', border: '1px solid var(--green-dim)', borderRadius: 8, padding: '.65rem 1.1rem', fontSize: '.82rem', color: 'var(--green)', fontFamily: 'var(--font-mono)', boxShadow: '0 8px 32px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast}
        </div>
      )}

      <style>{`
        .prose { font-family: var(--font-mono); font-size: .85rem; line-height: 1.7; color: var(--text); }
        .prose h1,.prose h2,.prose h3 { font-family: var(--font-display); }
        .prose code { background: var(--bg-2); border: 1px solid var(--border); color: var(--amber); padding: .1rem .3rem; border-radius: 3px; font-size: .8rem; }
        .prose pre { background: var(--bg-1) !important; }
        .prose ul { padding-left: 1.2rem; }
        .prose li { margin-bottom: .2rem; }
        .prose table { border-collapse: collapse; width: 100%; margin: .75rem 0; font-size: .8rem; }
        .prose th,.prose td { border: 1px solid var(--border); padding: .4rem .65rem; }
        .prose th { background: var(--bg-2); color: var(--text-2); }
      `}</style>
    </div>
  )
}
