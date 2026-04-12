'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import ProviderSection from '@/components/ProviderSection'
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
        className={`flex items-center gap-1.5 cursor-pointer font-mono text-sm ${active ? 'border-l-2 border-green-500' : 'border-l-2 border-transparent'}`}
        style={{
          paddingLeft: indent,
          paddingTop: 5,
          paddingBottom: 5,
          paddingRight: 8,
          background: active ? 'var(--green-glow)' : 'transparent',
          color: active ? 'var(--green)' : 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
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
        onClick={() => setOpen((o: boolean) => !o)}
        className="flex items-center gap-1 cursor-pointer text-sm"
        style={{
          paddingLeft: level * 14,
          paddingTop: 5,
          paddingBottom: 5,
          paddingRight: 8,
          color: 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span className="text-2xs">{ open ? '▾' : '▸'}</span>
        <span className="text-2xs" style={{ color: level === 0 ? 'var(--green)' : 'var(--amber)' }}>📁</span>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>{node.name}</span>
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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-base" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-15">⬡</div>
        <p>Chưa có Topology Graph.</p>
        <p className="text-xs">Chạy Scan Repo để AI bóc tách.</p>
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
            className="cursor-pointer"
          >
            <circle cx={n.x} cy={n.y} r="38" fill={`url(#g${n.id})`} stroke={n.color} strokeWidth="2" />
            <circle cx={n.x} cy={n.y} r="32" fill="#0d1210" />
            <text x={n.x} y={n.y - 5} textAnchor="middle" fill={n.color} fontSize="9.5" fontWeight="bold" fontFamily="monospace">{n.label}</text>
            <text x={n.x} y={n.y + 9} textAnchor="middle" fill="#3a5a48" fontSize="8" fontFamily="monospace">{n.count} files</text>
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="fixed z-[100] rounded-lg pointer-events-none text-sm"
          style={{
            left: Math.min(hovered.mx + 12, window.innerWidth - 260),
            top: hovered.my + 12,
            background: '#111a14',
            border: '1px solid #1e2e24',
            padding: '.75rem',
            width: 240,
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

// ─── AgentCard ───────────────────────────────────────────────────────────────

function AgentCard({ dot, title, loading, content, editable, editValue, onEditChange, onApprove, approveLabel, approveColor, busy }: {
  dot: string; title: string; loading: boolean; content?: string
  editable: boolean; editValue: string; onEditChange: (v: string) => void
  onApprove: () => void; approveLabel: string; approveColor: string; busy: boolean
}) {
  return (
    <div className="relative">
      <div className="absolute" style={{ left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: `2px solid ${dot}` }} />
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
        <div className="px-5 py-2.5 border-b font-bold text-sm" style={{ borderColor: 'var(--border)', color: dot }}>
          {title}
        </div>
        <div className="p-5">
          {loading ? (
            <span className="text-sm" style={{ color: 'var(--amber)' }}>⟳ AI đang xử lý...</span>
          ) : editable ? (
            <textarea
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              className="w-full font-mono text-base resize-y rounded"
              style={{
                minHeight: 280,
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '.75rem',
                borderRadius: 6,
                fontSize: '.82rem',
                lineHeight: 1.7,
              }}
            />
          ) : (
            content && (
              <div className="prose overflow-auto" style={{ maxHeight: 400 }} dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
            )
          )}
          {editable && (
            <div className="mt-4 flex justify-end border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={onApprove}
                disabled={busy}
                className="font-bold text-base cursor-pointer rounded"
                style={{ background: approveColor, color: 'var(--bg)', border: 'none', padding: '.45rem 1.2rem', borderRadius: 6, fontSize: '.82rem', opacity: busy ? .6 : 1 }}
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
type LeftTab = 'chat' | 'sessions' | 'tracing' | 'settings'

export default function WorkspacePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params)
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
  const [suggestionIdx, setSuggestionIdx] = useState(0)

  // ── settings form state ──────────────────────────────────────────────────────
  const [cfgProvider, setCfgProvider] = useState<'gemini' | 'ollama' | 'copilot'>('gemini')
  const [cfgGeminiKey, setCfgGeminiKey] = useState('')
  const [cfgGeminiModel, setCfgGeminiModel] = useState('')
  const [cfgOllamaUrl, setCfgOllamaUrl] = useState('')
  const [cfgOllamaModel, setCfgOllamaModel] = useState('')
  const [cfgCopilotToken, setCfgCopilotToken] = useState('')
  const [cfgCopilotModel, setCfgCopilotModel] = useState('')
  const [cfgGithubToken, setCfgGithubToken] = useState('')
  const [cfgSaving, setCfgSaving] = useState(false)
  const [cfgMsg, setCfgMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const termRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)
  // Tracks the previous leftTab value so the settings form is only seeded from
  // server state when the user *switches* to the settings tab, not on every
  // background poll that updates `status`.
  const prevLeftTabRef = useRef<string>('')

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
    // Only seed the settings form from server state when the user first opens
    // the settings tab (tab switch). Polling updates to `status` must NOT reset
    // fields the user has already edited but not yet saved.
    if (leftTab === 'settings' && prevLeftTabRef.current !== 'settings' && status) {
      setCfgProvider(status.ai_provider)
      setCfgGeminiModel(status.gemini_model || '')
      setCfgOllamaUrl(status.ollama_url || '')
      setCfgOllamaModel(status.ollama_model || '')
      setCfgCopilotModel(status.copilot_model || '')
    }
    prevLeftTabRef.current = leftTab
  }, [leftTab, fetchMetrics, status])

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

  // ── settings save ────────────────────────────────────────────────────────────

  const saveSettings = async (section: 'gemini' | 'ollama' | 'copilot' | 'provider' | 'github') => {
    setCfgSaving(true); setCfgMsg(null)
    try {
      if (section === 'provider') {
        await api.config.setProvider(cfgProvider)
        setCfgMsg({ ok: true, text: `Provider switched to ${cfgProvider}.` })
      } else if (section === 'gemini') {
        if (!cfgGeminiKey) throw new Error('API key is required.')
        await api.config.setGeminiKey(cfgGeminiKey, cfgGeminiModel || undefined)
        await api.config.setProvider('gemini')
        setCfgProvider('gemini')
        setCfgMsg({ ok: true, text: 'Gemini API key saved.' })
      } else if (section === 'ollama') {
        await api.config.setOllama(cfgOllamaUrl || 'http://localhost:11434', cfgOllamaModel || 'llama3')
        await api.config.setProvider('ollama')
        setCfgProvider('ollama')
        setCfgMsg({ ok: true, text: 'Ollama config saved.' })
      } else if (section === 'copilot') {
        if (!cfgCopilotToken) throw new Error('GitHub token is required.')
        await api.config.setCopilot(cfgCopilotToken, cfgCopilotModel || undefined)
        await api.config.setProvider('copilot')
        setCfgProvider('copilot')
        setCfgMsg({ ok: true, text: 'Copilot config saved.' })
      } else if (section === 'github') {
        await api.config.setup(status?.repo ? `https://github.com/${status.repo.owner}/${status.repo.repo}` : '', cfgGithubToken, status ? 10000 : 10000)
        setCfgMsg({ ok: true, text: 'GitHub token saved.' })
      }
      await fetchStatus()
    } catch (e: any) {
      setCfgMsg({ ok: false, text: e.message })
    } finally {
      setCfgSaving(false)
    }
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
            '  /healthcheck          — Kiểm tra kết nối AI model\n' +
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

        case '/healthcheck': {
          print('⟳ Pinging AI model...')
          setBusy(true)
          const hc = await api.health.model() as any
          setBusy(false)
          if (hc.status === 'ok') {
            print(`✅ Model connection OK\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Latency  : ${hc.latency_ms}ms`)
          } else {
            print(`❌ Model connection FAILED\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Error    : ${hc.error}`)
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
      <div className="h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  const fileTree = buildFileTree(kb?.tree || [])
  const isRunning = session.workflow_state?.includes('running') || !!scanStatus?.running
  const outputs = session.agent_outputs || {}

  const RTAB = (key: RightTab, label: string, color = 'var(--text-2)') => (
    <button key={key} onClick={() => setRightTab(key)}
      className="whitespace-nowrap cursor-pointer font-mono text-xs bg-transparent border-none"
      style={{
        padding: '.45rem .9rem',
        borderBottom: rightTab === key ? `2px solid ${color}` : '2px solid transparent',
        color: rightTab === key ? color : 'var(--text-3)',
      }}
    >
      {label}
    </button>
  )

  const LTAB = (key: LeftTab, label: string) => (
    <button key={key} onClick={() => setLeftTab(key)}
      className="flex-1 cursor-pointer bg-transparent border-none uppercase tracking-wide font-mono"
      style={{
        padding: '.5rem .3rem',
        borderBottom: leftTab === key ? '2px solid var(--green)' : '2px solid transparent',
        color: leftTab === key ? 'var(--green)' : 'var(--text-3)',
        fontSize: '.7rem',
        letterSpacing: '.05em',
      }}
    >
      {label}
    </button>
  )

  const COMMANDS = [
    { cmd: '/setup',       args: '<github_url> [token]', desc: 'Configure GitHub repo' },
    { cmd: '/scan',        args: '',                     desc: 'Scan & index codebase' },
    { cmd: '/ask',         args: '<question>',           desc: 'RAG chat with AI about code' },
    { cmd: '/cr',          args: '<requirement>',        desc: 'Start SDLC brainstorm' },
    { cmd: '/new',         args: '',                     desc: 'Create new workspace' },
    { cmd: '/delete',      args: '[session_id]',         desc: 'Delete session (default: current)' },
    { cmd: '/healthcheck', args: '',                     desc: 'Ping AI model connection' },
    { cmd: '/info',        args: '',                     desc: 'Show system info' },
    { cmd: '/help',        args: '',                     desc: 'List all commands' },
  ]

  const activeSuggestions = cmd.startsWith('/')
    ? COMMANDS.filter(c => c.cmd.startsWith(cmd.split(' ')[0]))
    : []

  return (
    <div className="flex h-screen overflow-hidden font-mono" style={{ background: 'var(--bg)' }}>

      {/* ═══════════════════ LEFT ═══════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 border-r"
        style={{ width: `${leftW}%`, minWidth: 300, background: 'var(--bg-1)', borderColor: 'var(--border)' }}
      >

        {/* header */}
        <div className="flex items-center justify-between px-4 border-b flex-shrink-0" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <span className="font-display font-extrabold text-lg" style={{ color: 'var(--green)' }}>
            YUMMY <span className="text-2xs font-normal" style={{ color: 'var(--text-3)' }}>.better than your ex</span>
          </span>
          {(isRunning || scanStatus) && (
            <span className="text-2xs" style={{ color: 'var(--amber)', background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.2)', padding: '2px 8px', borderRadius: 20 }}>
              ⟳ {scanStatus?.text?.slice(0, 26) || 'running...'}
            </span>
          )}
        </div>

        {/* left tabs */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {LTAB('chat', '⬡ Chat')}
          {LTAB('sessions', '⬡ Session')}
          {LTAB('tracing', '⬡ Tracing')}
          {LTAB('settings', '⚙ Settings')}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── CHAT ── */}
          {leftTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="border-b flex-shrink-0 text-center uppercase tracking-widest text-2xs px-4 py-1" style={{ background: 'var(--green-mute)', borderColor: 'var(--border)', color: 'var(--green)', letterSpacing: '.08em' }}>
                {session.name}
              </div>

              <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 text-base leading-relaxed">
                {termLogs.map((log, i) => (
                  <div key={i} className="flex gap-2" style={{ color: log.role === 'user' ? 'var(--green)' : 'var(--text-2)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{log.role === 'user' ? '❯' : '⚡'}</span>
                    <span className="whitespace-pre-wrap">{log.text}</span>
                  </div>
                ))}

                {chatHistory.map((m, i) => (
                  <div key={`c${i}`} className="flex gap-2" style={{ color: m.role === 'user' ? 'var(--green)' : 'var(--text)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{m.role === 'user' ? '❯' : '🤖'}</span>
                    {m.role === 'user' ? (
                      <span className="font-semibold">{m.text}</span>
                    ) : (
                      <div className="flex-1 border rounded-lg p-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                        <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                        {m.trace && (
                          <details className="mt-2">
                            <summary className="text-2xs cursor-pointer" style={{ color: 'var(--text-3)' }}>
                              ⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks
                            </summary>
                            <div className="mt-1.5 p-2 border rounded text-xs" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                              {m.trace.source_chunks?.map((c: any, j: number) => (
                                <div key={j} className="mb-1.5">
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
                  <div className="flex gap-2 items-center text-sm border rounded px-3 py-2" style={{ color: 'var(--amber)', background: 'rgba(255,179,0,.05)', borderColor: 'rgba(255,179,0,.15)' }}>
                    <span>⟳</span> {scanStatus?.text || 'AI đang xử lý...'}
                  </div>
                )}
                <div ref={termRef} />
              </div>

              {/* quick cmds */}
              <div className="px-3 flex gap-1 overflow-x-auto pb-1.5 flex-shrink-0">
                {['/scan', '/ask Giải thích flow?', '/cr Thêm export PDF', '/help'].map((h, i) => (
                  <button key={i} onClick={() => handleCmd(h)} disabled={busy}
                    className="whitespace-nowrap border rounded-full text-2xs cursor-pointer flex-shrink-0"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '3px 10px' }}>
                    ⚡ {h}
                  </button>
                ))}
              </div>

              {/* suggestions */}
              {activeSuggestions.length > 0 && (
                <div className="mx-3 mb-1 border rounded-lg overflow-hidden flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  {activeSuggestions.map((s, i) => (
                    <div key={s.cmd}
                      onMouseEnter={() => setSuggestionIdx(i)}
                      onClick={() => { setCmd(s.args ? s.cmd + ' ' : s.cmd); setSuggestionIdx(i) }}
                      className="flex items-baseline gap-2 px-3 py-1.5 cursor-pointer"
                      style={{
                        background: i === suggestionIdx ? 'var(--green-glow)' : 'transparent',
                        borderLeft: `2px solid ${i === suggestionIdx ? 'var(--green)' : 'transparent'}`,
                      }}
                    >
                      <span className="font-mono text-sm font-bold flex-shrink-0" style={{ color: i === suggestionIdx ? 'var(--green)' : 'var(--text-2)' }}>{s.cmd}</span>
                      {s.args && <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--amber)' }}>{s.args}</span>}
                      <span className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{s.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* input */}
              <div className="px-3 py-2.5 border-t flex gap-1.5 flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <input
                  value={cmd}
                  onChange={e => { setCmd(e.target.value); setSuggestionIdx(0) }}
                  onKeyDown={e => {
                    if (activeSuggestions.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIdx(i => Math.min(i + 1, activeSuggestions.length - 1)) }
                      if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggestionIdx(i => Math.max(i - 1, 0)) }
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const s = activeSuggestions[suggestionIdx]
                        setCmd(s.args ? s.cmd + ' ' : s.cmd)
                      }
                    }
                    if (e.key === 'Enter') handleCmd()
                    if (e.key === 'Escape') setCmd('')
                  }}
                  placeholder="Gõ / để xem lệnh..." disabled={busy} autoFocus
                  className="flex-1 border rounded font-mono text-base outline-none"
                  style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text)', padding: '.5rem .75rem', fontSize: '.82rem' }}
                />
                <button onClick={() => handleCmd()} disabled={busy || !cmd.trim()}
                  className="border-none rounded cursor-pointer font-bold text-md"
                  style={{ background: 'var(--green)', color: 'var(--bg)', padding: '.5rem .9rem', opacity: busy ? .5 : 1 }}>
                  ↑
                </button>
              </div>
            </div>
          )}

          {/* ── SESSIONS ── */}
          {leftTab === 'sessions' && (
            <div className="p-3 flex flex-col gap-2 overflow-auto h-full">
              <button onClick={() => handleCmd('/new')}
                className="border border-dashed rounded cursor-pointer font-mono text-sm"
                style={{ padding: '.6rem', borderColor: 'var(--border)', background: 'none', color: 'var(--text-3)' }}>
                + Tạo Workspace Mới
              </button>
              {sessions.map(s => (
                <div key={s.id}
                  className="relative rounded-lg cursor-pointer"
                  style={{
                    padding: '.65rem .75rem',
                    background: s.id === sessionId ? 'var(--green-glow)' : 'var(--bg)',
                    border: `1px solid ${s.id === sessionId ? 'var(--green-dim)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${s.id === sessionId ? 'var(--green)' : 'var(--border)'}`,
                  }}
                  onClick={() => router.push(`/workspace/${s.id}`)}>
                  <div className="font-bold text-base truncate mb-0.5 pr-6" style={{ color: s.id === sessionId ? 'var(--green)' : 'var(--text)' }}>{s.name}</div>
                  <div className="text-2xs" style={{ color: 'var(--text-3)' }}>{s.workflow_state?.replace(/_/g, ' ')} · {new Date(s.created_at).toLocaleDateString()}</div>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                    title="Delete session"
                    className="absolute top-1/2 -translate-y-1/2 right-2 bg-transparent border-none cursor-pointer leading-none rounded hover:text-red-500 transition-colors"
                    style={{ color: 'var(--text-3)', fontSize: '.75rem', padding: '2px 4px' }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* ── TRACING ── */}
          {leftTab === 'tracing' && (
            <div className="p-3 flex flex-col gap-2 h-full overflow-auto">
              {metrics ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Requests', value: metrics.total_requests, color: 'var(--green)' },
                      { label: 'Cost (est)', value: `$${metrics.total_cost_usd.toFixed(4)}`, color: 'var(--amber)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="border rounded-lg text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '.65rem' }}>
                        <div className="text-xl font-bold" style={{ color }}>{value}</div>
                        <div className="text-2xs uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-3)', letterSpacing: '.06em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {metrics.logs.map(log => (
                    <div key={log.id} className="border rounded-lg" style={{ background: 'var(--bg)', borderColor: 'var(--border)', padding: '.5rem .65rem' }}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: 'var(--green)' }}>⚡ {log.agent}</span>
                        <span className="text-2xs" style={{ color: 'var(--text-3)' }}>{log.time}</span>
                      </div>
                      <div className="flex justify-between text-2xs" style={{ color: 'var(--text-3)' }}>
                        <span>In: {log.in_tokens}</span><span>Out: {log.out_tokens}</span>
                        <span style={{ color: 'var(--amber)' }}>${log.cost.toFixed(5)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <button onClick={fetchMetrics} className="border rounded cursor-pointer font-mono" style={{ background: 'none', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '.5rem 1rem' }}>
                    ⟳ Load Metrics
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {leftTab === 'settings' && (
            <div className="flex flex-col h-full">

              {/* status bar */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <span className="text-2xs uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-3)' }}>Active provider</span>
                <span className="text-2xs font-bold px-2 py-0.5 rounded whitespace-nowrap" style={{ background: cfgProvider === 'gemini' ? 'var(--green-mute)' : cfgProvider === 'copilot' ? 'rgba(100,160,255,.12)' : 'rgba(255,179,0,.12)', color: cfgProvider === 'gemini' ? 'var(--green)' : cfgProvider === 'copilot' ? '#64a0ff' : 'var(--amber)', border: `1px solid ${cfgProvider === 'gemini' ? 'var(--green-dim)' : cfgProvider === 'copilot' ? 'rgba(100,160,255,.4)' : 'var(--amber-dim)'}` }}>
                  {status?.ai_provider?.toUpperCase() ?? '—'}
                </span>
                {cfgMsg && (
                  <span className="text-2xs px-2 py-0.5 rounded" style={{ color: cfgMsg.ok ? 'var(--green)' : 'var(--red)', background: cfgMsg.ok ? 'var(--green-mute)' : 'rgba(255,68,68,.1)', border: `1px solid ${cfgMsg.ok ? 'var(--green-dim)' : 'var(--red-dim)'}` }}>
                    {cfgMsg.ok ? '✓' : '✕'} {cfgMsg.text}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4 p-3 overflow-auto flex-1">

                <ProviderSection
                  cfgProvider={cfgProvider}
                  cfgSaving={cfgSaving}
                  onProviderChange={setCfgProvider}
                  onApplyProvider={() => saveSettings('provider')}
                />

                {/* ── Gemini Config ── */}
                <section className="rounded-lg border overflow-hidden" style={{ borderColor: cfgProvider === 'gemini' ? 'var(--green-dim)' : 'var(--border)' }}>
                  <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: cfgProvider === 'gemini' ? 'var(--green)' : 'var(--text-3)' }}>
                    ✦ Gemini
                    {status?.has_gemini_key && <span className="text-2xs px-1.5 rounded" style={{ background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>key set</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-3" style={{ background: 'var(--bg-1)' }}>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>API Key</span>
                      <input
                        type="password"
                        value={cfgGeminiKey}
                        onChange={e => setCfgGeminiKey(e.target.value)}
                        placeholder={status?.has_gemini_key ? '••••••••••••••••' : 'AIza...'}
                        className="input text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', caretColor: 'var(--green)' }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Model</span>
                      <select
                        value={cfgGeminiModel}
                        onChange={e => setCfgGeminiModel(e.target.value)}
                        className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                      >
                        <option value="">-- keep current ({status?.gemini_model ?? 'default'}) --</option>
                        <option value="gemini-2.5-flash-preview-09-2025">gemini-2.5-flash-preview (latest)</option>
                        <option value="gemini-2.5-pro-preview-03-25">gemini-2.5-pro-preview</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                      </select>
                    </label>
                    <button onClick={() => saveSettings('gemini')} disabled={cfgSaving || !cfgGeminiKey}
                      className="w-full py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)', opacity: (cfgSaving || !cfgGeminiKey) ? .5 : 1 }}>
                      {cfgSaving ? '⟳ Saving...' : 'Save Gemini Config'}
                    </button>
                  </div>
                </section>

                {/* ── Ollama Config ── */}
                <section className="rounded-lg border overflow-hidden" style={{ borderColor: cfgProvider === 'ollama' ? 'var(--amber-dim)' : 'var(--border)' }}>
                  <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: cfgProvider === 'ollama' ? 'var(--amber)' : 'var(--text-3)' }}>
                    ⬡ Ollama (Local)
                  </div>
                  <div className="p-3 flex flex-col gap-3" style={{ background: 'var(--bg-1)' }}>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Base URL</span>
                      <input
                        value={cfgOllamaUrl}
                        onChange={e => setCfgOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', caretColor: 'var(--amber)' }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Model</span>
                      <input
                        value={cfgOllamaModel}
                        onChange={e => setCfgOllamaModel(e.target.value)}
                        placeholder="codellama / llama3 / deepseek-coder"
                        className="text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', caretColor: 'var(--amber)' }}
                      />
                    </label>
                    <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
                      Run <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>ollama serve</code> &amp; pull a model first.
                    </p>
                    <button onClick={() => saveSettings('ollama')} disabled={cfgSaving}
                      className="w-full py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ background: 'rgba(255,179,0,.1)', color: 'var(--amber)', border: '1px solid var(--amber-dim)', opacity: cfgSaving ? .5 : 1 }}>
                      {cfgSaving ? '⟳ Saving...' : 'Save Ollama Config'}
                    </button>
                  </div>
                </section>

                {/* ── Copilot Config ── */}
                <section className="rounded-lg border overflow-hidden" style={{ borderColor: cfgProvider === 'copilot' ? 'rgba(100,160,255,.4)' : 'var(--border)' }}>
                  <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: cfgProvider === 'copilot' ? '#64a0ff' : 'var(--text-3)' }}>
                    ⊕ GitHub Copilot
                    {status?.has_copilot_token && <span className="text-2xs px-1.5 rounded" style={{ background: 'rgba(100,160,255,.1)', color: '#64a0ff', border: '1px solid rgba(100,160,255,.3)' }}>token set</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-3" style={{ background: 'var(--bg-1)' }}>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>GitHub Token</span>
                      <input
                        type="password"
                        value={cfgCopilotToken}
                        onChange={e => setCfgCopilotToken(e.target.value)}
                        placeholder={status?.has_copilot_token ? '••••••••••••••••' : 'ghp_... or gho_...'}
                        className="text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', caretColor: '#64a0ff' }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Model</span>
                      <select
                        value={cfgCopilotModel}
                        onChange={e => setCfgCopilotModel(e.target.value)}
                        className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                      >
                        <option value="">-- keep current ({status?.copilot_model ?? 'gpt-4o'}) --</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-5">gpt-5</option>
                        <option value="o3-mini">o3-mini</option>
                        <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
                        <option value="claude-opus-4-5">claude-opus-4-5</option>
                      </select>
                    </label>
                    <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
                      Requires an active GitHub Copilot subscription. Token needs <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: '#64a0ff' }}>copilot</code> scope.
                    </p>
                    <button onClick={() => saveSettings('copilot')} disabled={cfgSaving || !cfgCopilotToken}
                      className="w-full py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ background: 'rgba(100,160,255,.1)', color: '#64a0ff', border: '1px solid rgba(100,160,255,.35)', opacity: (cfgSaving || !cfgCopilotToken) ? .5 : 1 }}>
                      {cfgSaving ? '⟳ Saving...' : 'Save Copilot Config'}
                    </button>
                  </div>
                </section>

                {/* ── GitHub Token ── */}
                <section className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    GitHub Token
                    {status?.has_github_token && <span className="text-2xs px-1.5 rounded" style={{ background: 'rgba(0,170,255,.1)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)' }}>set</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-3" style={{ background: 'var(--bg-1)' }}>
                    <label className="flex flex-col gap-1">
                      <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Personal Access Token</span>
                      <input
                        type="password"
                        value={cfgGithubToken}
                        onChange={e => setCfgGithubToken(e.target.value)}
                        placeholder={status?.has_github_token ? '••••••••••••••••' : 'ghp_...'}
                        className="text-xs rounded px-2 py-1.5 font-mono w-full outline-none"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                      />
                    </label>
                    <p className="text-2xs" style={{ color: 'var(--text-3)' }}>Required for private repos. Needs <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>Contents: Read</code> scope.</p>
                    <button onClick={() => saveSettings('github')} disabled={cfgSaving || !cfgGithubToken || !status?.repo}
                      className="w-full py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ background: 'rgba(0,170,255,.08)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)', opacity: (cfgSaving || !cfgGithubToken || !status?.repo) ? .5 : 1 }}>
                      {cfgSaving ? '⟳ Saving...' : 'Save GitHub Token'}
                    </button>
                    {!status?.repo && <p className="text-2xs" style={{ color: 'var(--text-3)' }}>Run <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>/setup</code> first to set a repo.</p>}
                  </div>
                </section>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ RESIZER ═══ */}
      <div
        onMouseDown={() => setDragging(true)}
        className="cursor-col-resize flex-shrink-0 z-50 hover:bg-green-500 transition-colors"
        style={{ width: 4, background: dragging ? 'var(--green)' : 'var(--border)' }}
      />

      {/* ═══════════════════ RIGHT ═══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg)' }}>

        {/* right tabs */}
        <div className="flex border-b overflow-x-auto flex-shrink-0 items-end" style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
          {RTAB('ide', '⬡ IDE Simulator', 'var(--text-2)')}
          {RTAB('graph', '⬡ Node Arch', 'var(--green)')}
          {RTAB('wiki', '⬡ GitBook Wiki', '#ff79c6')}
          {RTAB('insights', '⬡ AI Insights', '#ffb300')}
          {RTAB('rag', '⬡ RAG Trace', '#00aaff')}
          {RTAB('sdlc', '⬡ SDLC Brainstorm', '#ffb300')}
          {RTAB('backlog', '⬡ JIRA Kanban', '#aa88ff')}
          {RTAB('db', '⬡ Local DB', '#ff6644')}
        </div>

        <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-1)' }}>

          {/* ── IDE ── */}
          {rightTab === 'ide' && (
            <div className="flex h-full text-base">
              <div className="border-r flex flex-col overflow-hidden" style={{ width: '28%', minWidth: 220, borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <div className="flex justify-between items-center border-b text-2xs uppercase tracking-widest px-3 py-2" style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)', letterSpacing: '.08em' }}>
                  <span>FILE EXPLORER</span>
                  <span className="rounded px-1.5 py-px" style={{ color: 'var(--green)', background: 'var(--green-mute)' }}>{kb?.tree?.length || 0}</span>
                </div>
                <div className="flex-1 overflow-auto pt-1">
                  {!kb?.tree?.length ? (
                    <div className="flex flex-col items-center justify-center text-sm gap-2 text-center px-4" style={{ height: '70%', color: 'var(--text-3)' }}>
                      <div className="text-4xl opacity-15">📁</div>
                      <p>Workspace trống.<br />Chạy /scan để index.</p>
                    </div>
                  ) : (
                    Object.values(fileTree.children)
                      .sort((a: any, b: any) => a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1)
                      .map((node: any) => <TreeNode key={node.name} node={node} onFile={openFile} selected={ideFile} />)
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="border-b flex items-center pl-4 flex-shrink-0" style={{ height: 38, background: 'var(--bg)', borderColor: 'var(--border)' }}>
                  <span className="font-mono text-sm pt-1" style={{ color: 'var(--text-2)', borderTop: '2px solid #ff79c6' }}>
                    {ideFile ? ideFile.split('/').pop() : 'Welcome'}
                  </span>
                </div>
                <div className="flex-1 flex overflow-hidden">
                  <div className="border-r p-4 pr-2 font-mono text-sm text-right overflow-hidden select-none leading-relaxed" style={{ width: 44, background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {Array.from({ length: 120 }).map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <div className="flex-1 p-4 font-mono text-base overflow-auto whitespace-pre leading-relaxed" style={{ color: 'var(--text)' }}>
                    {ideLoading ? <span style={{ color: 'var(--green)' }}>⟳ Tải source code...</span>
                      : ideContent ? <code>{ideContent}</code>
                        : <div className="flex flex-col items-center justify-center gap-2 opacity-20" style={{ height: '60%', color: 'var(--text-3)' }}><div className="text-5xl">⬡</div><p>IDE Ready.</p></div>
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NODE GRAPH ── */}
          {rightTab === 'graph' && (
            <div className="p-6 h-full flex flex-col">
              <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--green)' }}>⬡ Node Architecture Graph</h2>
              <div className="flex-1 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <NodeGraph tree={kb?.tree || []} repoInfo={status?.repo} />
              </div>
            </div>
          )}

          {/* ── WIKI ── */}
          {rightTab === 'wiki' && (
            <div className="h-full overflow-auto" style={{ background: 'var(--bg)' }}>
              <div className="max-w-[900px] mx-auto border-l border-r min-h-full" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-center px-8 py-4 border-b sticky top-0 z-10" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <span className="font-display font-extrabold" style={{ fontSize: '1.05rem', color: 'var(--text)' }}>📖 Project Documentation</span>
                  {kb?.project_summary && (
                    <button onClick={() => { const b = new Blob([kb.project_summary], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wiki.md'; a.click() }}
                      className="border-none rounded cursor-pointer font-bold text-xs"
                      style={{ background: 'var(--green)', color: 'var(--bg)', padding: '.3rem .8rem' }}>
                      ↓ Export
                    </button>
                  )}
                </div>
                <div className="p-8">
                  {kb?.project_summary
                    ? <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(kb.project_summary) }} />
                    : <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}><div className="text-5xl opacity-10">📖</div><p>Wiki chưa có. Chạy /scan để tạo.</p></div>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── INSIGHTS ── */}
          {rightTab === 'insights' && (
            <div className="h-full overflow-auto p-6">
              <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--amber)' }}>⚡ AI Project Insights</h2>
              {!kb?.insights?.length
                ? <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}><div className="text-5xl opacity-10">⬡</div><p>Chưa có insights. Chạy /scan.</p></div>
                : <div className="grid gap-4 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
                  {kb.insights.map((ins, i) => (
                    <div key={i} className="border rounded-lg p-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                      <div className="flex flex-wrap gap-1 mb-2.5 pb-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                        {ins.files.map((f, j) => (
                          <span key={j} className="border rounded font-mono text-2xs" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '2px 7px' }}>
                            {f.split('/').pop()}
                          </span>
                        ))}
                      </div>
                      <div className="prose overflow-auto" style={{ maxHeight: 200 }} dangerouslySetInnerHTML={{ __html: mdToHtml(ins.summary) }} />
                    </div>
                  ))}
                </div>
              }
            </div>
          )}

          {/* ── RAG TRACE ── */}
          {rightTab === 'rag' && (
            <div className="h-full overflow-auto p-6">
              <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: '#00aaff' }}>⬡ RAG & Chat History</h2>
              {!chatHistory.length
                ? <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}><div className="text-4xl opacity-20">💬</div><p>Chưa có lịch sử. Gõ /ask ở Chat.</p></div>
                : <div className="flex flex-col gap-5 pb-8 max-w-[860px] mx-auto">
                  {chatHistory.map((m, i) => (
                    <div key={i} className="border rounded-xl px-5 py-4" style={{ borderColor: 'var(--border)', background: m.role === 'user' ? 'var(--green-glow)' : 'var(--bg)', marginLeft: m.role === 'user' ? '10%' : 0 }}>
                      <div className="text-2xs uppercase tracking-wide font-bold mb-2" style={{ color: m.role === 'user' ? 'var(--green)' : 'var(--text-3)', letterSpacing: '.06em' }}>
                        {m.role === 'user' ? '🔍 User Query' : '🤖 AI Response'}
                      </div>
                      {m.role === 'user'
                        ? <p style={{ color: 'var(--text)', fontSize: '.9rem' }}>{m.text}</p>
                        : <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                      }
                      {m.trace && (
                        <details className="mt-2.5">
                          <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-3)' }}>⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks</summary>
                          <div className="mt-2 p-3 border rounded text-xs leading-relaxed" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                            <div className="mb-1.5" style={{ color: 'var(--text-3)' }}>Intent: <strong style={{ color: 'var(--amber)' }}>{m.trace.intent}</strong></div>
                            {m.trace.source_chunks?.map((c: any, j: number) => (
                              <div key={j} className="border rounded p-2 mb-1.5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                                <div className="mb-0.5 text-2xs" style={{ color: 'var(--amber)' }}>{c.files?.slice(0, 3).join(' · ')}</div>
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
            <div className="h-full overflow-auto p-6">
              <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: 'var(--amber)' }}>⚡ Multi-Agent SDLC Brainstorm</h2>
              {!outputs.requirement
                ? <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}><div className="text-5xl opacity-10">⬡</div><p>Gõ <code>/cr [Yêu cầu]</code> ở Terminal để bắt đầu SDLC.</p></div>
                : (
                  <div className="relative pl-12 flex flex-col gap-8 max-w-[820px]">
                    <div className="absolute top-0 bottom-0 w-px" style={{ left: 22, background: 'var(--border)' }} />

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
                      <div className="relative">
                        <div className="absolute" style={{ left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: '2px solid #aa88ff' }} />
                        <div className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                          <div className="border-b px-5 py-2.5 text-sm font-bold" style={{ background: 'rgba(170,136,255,.08)', borderColor: 'var(--border)', color: '#aa88ff' }}>
                            4. Implementation & Verification
                          </div>
                          <div className="p-5 flex flex-col gap-4">
                            {[
                              { key: 'dev', label: '💻 Lead Developer', color: 'var(--amber)' },
                              { key: 'security', label: '🔐 Security Review', color: 'var(--red)' },
                              { key: 'qa', label: '🧪 QA Engineer', color: '#aa88ff' },
                              { key: 'sre', label: '🚀 SRE / DevOps', color: '#44ddff' },
                            ].map(({ key, label, color }) => (
                              <div key={key} className="border rounded-lg px-4 py-3" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                                <div className="text-xs font-bold mb-2" style={{ color }}>{label}</div>
                                {(outputs as any)[key]
                                  ? <div className="prose overflow-auto" style={{ maxHeight: 280 }} dangerouslySetInnerHTML={{ __html: mdToHtml((outputs as any)[key]) }} />
                                  : <span className="text-xs" style={{ color: 'var(--text-3)' }}>{session.workflow_state === 'running_rest' ? '⟳ Đang xử lý...' : '—'}</span>
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {session.workflow_state === 'done' && (
                      <div className="border rounded-lg px-6 py-4 font-bold text-center" style={{ background: 'var(--green-mute)', borderColor: 'var(--green-dim)', color: 'var(--green)' }}>
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
            <div className="h-full overflow-auto p-6">
              <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: '#aa88ff' }}>⬡ JIRA Kanban Backlog</h2>
              {!session.jira_backlog?.length
                ? <div className="flex flex-col items-center justify-center gap-3" style={{ height: 300, color: 'var(--text-3)' }}><div className="text-5xl opacity-10">⬡</div><p>Backlog trống. Chạy /cr để sinh JIRA tasks.</p></div>
                : <div className="flex flex-col gap-5 max-w-[820px]">
                  {session.jira_backlog.map((epic, ei) => (
                    <div key={ei} className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                      <div className="border-b px-5 py-3 flex items-center gap-2.5" style={{ background: 'rgba(170,136,255,.1)', borderColor: 'var(--border)' }}>
                        <span className="text-white text-2xs font-extrabold rounded" style={{ background: '#7c3aed', padding: '2px 8px' }}>EPIC</span>
                        <span className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>{epic.title}</span>
                      </div>
                      <div className="px-4 py-3 flex flex-col gap-2">
                        {epic.tasks?.map((task, ti) => (
                          <div key={ti} className="border rounded-lg px-3.5 py-2.5" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-2 mb-1.5" style={{ marginBottom: task.subtasks?.length ? undefined : 0 }}>
                              <span className="text-2xs rounded font-bold" style={{ padding: '2px 7px', background: task.type === 'backend' ? 'rgba(0,170,255,.15)' : task.type === 'frontend' ? 'rgba(170,136,255,.15)' : 'rgba(255,179,0,.12)', color: task.type === 'backend' ? '#00aaff' : task.type === 'frontend' ? '#aa88ff' : 'var(--amber)' }}>
                                {task.type?.toUpperCase()}
                              </span>
                              <span className="text-md font-semibold" style={{ color: 'var(--text)' }}>{task.title}</span>
                              {task.story_points && <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>{task.story_points} pts</span>}
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
            <div className="h-full overflow-auto p-6">
              <h2 className="font-display font-extrabold text-xl mb-6" style={{ color: '#ff6644' }}>⬡ Backend Store</h2>
              <div className="border rounded-lg px-5 py-4 mb-6 flex gap-3.5 text-sm" style={{ background: 'rgba(255,68,68,.06)', borderColor: 'rgba(255,68,68,.2)', color: 'rgba(255,100,100,.9)' }}>
                <span className="text-2xl">⬡</span>
                <div><strong className="block mb-1" style={{ color: '#ff6644' }}>Zero-Trust In-Memory Store (FastAPI Backend)</strong>Trong môi trường Production (Banking/Enterprise), dữ liệu bảo mật On-Premise.</div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'KB Files', value: status?.kb_files ?? 0, color: 'var(--green)' },
                  { label: 'KB Chunks', value: status?.kb_insights ?? 0, color: '#00aaff' },
                  { label: 'Sessions', value: status?.total_sessions ?? 0, color: '#aa88ff' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="border rounded-lg p-4 text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                    <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-2xs uppercase tracking-wide mt-1" style={{ color: 'var(--text-3)', letterSpacing: '.06em' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="text-2xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)', letterSpacing: '.08em' }}>⬡ Active Workspaces</div>
              <div className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="grid border-b px-4 py-2 text-2xs uppercase tracking-wide" style={{ gridTemplateColumns: '1fr 2fr 100px 140px', borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)', letterSpacing: '.04em' }}>
                  <span>ID</span><span>Name</span><span>Q&A Pairs</span><span>Created</span>
                </div>
                {sessions.map(s => (
                  <div key={s.id} className="grid border-b items-center px-4" style={{ gridTemplateColumns: '1fr 2fr 100px 140px', padding: '.55rem 1rem', borderColor: 'var(--border)', background: s.id === sessionId ? 'var(--green-glow)' : 'transparent' }}>
                    <span className="font-mono text-2xs truncate" style={{ color: 'var(--green)' }}>{s.id.slice(0, 10)}…</span>
                    <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{s.name}</span>
                    <span className="border rounded text-2xs w-fit" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '1px 8px' }}>
                      {Math.floor((s.chat_history?.length || 0) / 2)} pairs
                    </span>
                    <span className="text-2xs" style={{ color: 'var(--text-3)' }}>{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteTarget(null)}>
          <div className="border rounded-xl" style={{ background: 'var(--bg-1)', borderColor: '#ff664455', padding: '1.75rem 2rem', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">🗑</span>
              <span className="font-display font-extrabold text-lg" style={{ color: '#ff6644' }}>Delete Session</span>
            </div>
            <p className="text-base leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
              Are you sure you want to delete this workspace?
            </p>
            <p className="text-sm border rounded px-3 py-2 mb-6 font-mono truncate" style={{ color: 'var(--text-3)', background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {deleteTarget.name}
            </p>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,100,68,.7)' }}>
              This action cannot be undone.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="border rounded-lg cursor-pointer font-mono text-base"
                style={{ padding: '.5rem 1.2rem', background: 'none', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = deleteTarget
                  setDeleteTarget(null)
                  await handleCmd(`/delete ${target.id}`)
                }}
                className="border-none rounded-lg cursor-pointer font-mono text-base font-bold"
                style={{ padding: '.5rem 1.2rem', background: '#ff6644', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] border rounded-lg flex items-center gap-2 font-mono text-base" style={{ background: 'var(--bg-1)', borderColor: 'var(--green-dim)', padding: '.65rem 1.1rem', color: 'var(--green)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
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
