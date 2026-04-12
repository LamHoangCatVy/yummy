'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useScanPoll } from '@/hooks/useScanPoll'
import { applyTheme, loadSavedTheme, THEMES, type ThemeId } from '@/lib/theme'

// Left-panel tabs
import ChatPanel from '@/components/workspace/ChatPanel'
import SessionsPanel from '@/components/workspace/SessionsPanel'
import TracingPanel from '@/components/workspace/TracingPanel'
import SettingsPanel from '@/components/workspace/SettingsPanel'
import OnboardingWizard from '@/components/workspace/OnboardingWizard'

// Right-panel tabs
import IdePanel from '@/components/workspace/IdePanel'
import NodeGraph from '@/components/workspace/NodeGraph'
import WikiPanel from '@/components/workspace/WikiPanel'
import InsightsPanel from '@/components/workspace/InsightsPanel'
import RagPanel from '@/components/workspace/RagPanel'
import SdlcPanel from '@/components/workspace/SdlcPanel'
import BacklogPanel from '@/components/workspace/BacklogPanel'
import DbPanel from '@/components/workspace/DbPanel'

import type {
  Session, SystemStatus, KnowledgeBase,
  ScanStatus, MetricsData, ChatMessage,
} from '@/lib/types'

// ─── Tab types ───────────────────────────────────────────────────────────────

type LeftTab  = 'chat' | 'sessions' | 'tracing' | 'settings'
type RightTab = 'ide' | 'graph' | 'wiki' | 'insights' | 'rag' | 'sdlc' | 'backlog' | 'db'

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WorkspacePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params)
  const router = useRouter()

  // ── Layout ──────────────────────────────────────────────────────────────────
  const [leftW, setLeftW]     = useState(36)
  const [dragging, setDragging] = useState(false)
  const [leftTab, setLeftTab]   = useState<LeftTab>('chat')
  const [rightTab, setRightTab] = useState<RightTab>('ide')

  // ── Server data ─────────────────────────────────────────────────────────────
  const [session,  setSession]  = useState<Session | null>(null)
  const [status,   setStatus]   = useState<SystemStatus | null>(null)
  const [kb,       setKb]       = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [metrics,  setMetrics]  = useState<MetricsData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  // ── Chat / terminal ─────────────────────────────────────────────────────────
  const [termLogs, setTermLogs] = useState<{ role: string; text: string }[]>([
    { role: 'system', text: '⚡ YUMMY — type /help to see commands.' },
  ])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [cmd,  setCmd]  = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestionIdx, setSuggestionIdx] = useState(0)

  // ── IDE ──────────────────────────────────────────────────────────────────────
  const [ideFile,    setIdeFile]    = useState('')
  const [ideContent, setIdeContent] = useState('')
  const [ideLoading, setIdeLoading] = useState(false)

  // ── SDLC edit buffers ────────────────────────────────────────────────────────
  const [editBA,      setEditBA]      = useState('')
  const [editSA,      setEditSA]      = useState('')
  const [editDevLead, setEditDevLead] = useState('')

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // null = not yet asked, 'wizard' = show wizard, 'dismissed' = skip
  const [onboardingState, setOnboardingState] = useState<'asking' | 'wizard' | 'dismissed'>(() => {
    if (typeof window === 'undefined') return 'dismissed'
    const stored = localStorage.getItem('yummy_onboarding')
    if (stored === 'done') return 'dismissed'
    return 'asking'
  })

  const termRef = useRef<HTMLDivElement>(null)

  // ─── Fetchers ────────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    try {
      setSession(await api.sessions.get(sessionId) as Session)
    } catch (e: any) {
      if (e.message?.includes('404')) {
        try {
          const fresh = await api.sessions.create() as Session
          router.replace(`/workspace/${fresh.id}`)
        } catch { }
      }
    }
  }, [sessionId, router])

  const fetchStatus   = useCallback(async () => { try { setStatus(await api.config.status() as SystemStatus) } catch { } }, [])
  const fetchKb       = useCallback(async () => { try { setKb(await api.kb.get() as KnowledgeBase) } catch { } }, [])
  const fetchSessions = useCallback(async () => { try { setSessions(await api.sessions.list() as Session[]) } catch { } }, [])
  const fetchMetrics  = useCallback(async () => { try { setMetrics(await api.metrics() as MetricsData) } catch { } }, [])

  // ─── Bootstrap + polling ─────────────────────────────────────────────────────

  useEffect(() => {
    fetchSession(); fetchStatus(); fetchKb(); fetchSessions()
    loadSavedTheme()
    const iv = setInterval(() => { fetchSession(); fetchStatus() }, 4000)
    return () => clearInterval(iv)
  }, [sessionId, fetchSession, fetchStatus, fetchKb, fetchSessions])

  useEffect(() => {
    if (leftTab === 'tracing') fetchMetrics()
  }, [leftTab, fetchMetrics])

  // Sync session-level state once per session change
  const prevId = useRef('')
  useEffect(() => {
    if (session && session.id !== prevId.current) {
      prevId.current = session.id
      setChatHistory(session.chat_history || [])
      if (session.agent_outputs?.ba)       setEditBA(session.agent_outputs.ba)
      if (session.agent_outputs?.sa)       setEditSA(session.agent_outputs.sa)
      if (session.agent_outputs?.dev_lead) setEditDevLead(session.agent_outputs.dev_lead)
    }
  }, [session])

  // Auto-scroll terminal
  useEffect(() => {
    termRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [termLogs, chatHistory, scanStatus])

  // ─── Resize drag ─────────────────────────────────────────────────────────────

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

  // ─── Scan polling ────────────────────────────────────────────────────────────

  const print = (text: string, role = 'system') =>
    setTermLogs(prev => [...prev, { role, text }])

  const { startScanPoll } = useScanPoll({
    onStatusUpdate: setScanStatus,
    onMessage: print,
    onComplete: async () => {
      await fetchKb(); await fetchStatus()
      print('✅ Scan complete.')
      setRightTab('wiki')
    },
  })

  // ─── IDE file open ───────────────────────────────────────────────────────────

  const openFile = async (path: string) => {
    setIdeFile(path); setRightTab('ide'); setIdeLoading(true); setIdeContent('')
    try {
      const res = await api.kb.file(path) as any
      setIdeContent(res.content || '// (empty)')
    } catch (e: any) {
      setIdeContent(`// [ERROR LOADING FILE]: ${e.message}`)
    } finally { setIdeLoading(false) }
  }

  // ─── Toast ───────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ─── SDLC helpers ────────────────────────────────────────────────────────────

  const refreshSDLC = async () => {
    try {
      const u = await api.sdlc.state(sessionId) as any
      setSession(prev => prev ? { ...prev, workflow_state: u.workflow_state, agent_outputs: u.agent_outputs, jira_backlog: u.jira_backlog } : prev)
      if (u.agent_outputs?.ba)       setEditBA(u.agent_outputs.ba)
      if (u.agent_outputs?.sa)       setEditSA(u.agent_outputs.sa)
      if (u.agent_outputs?.dev_lead) setEditDevLead(u.agent_outputs.dev_lead)
    } catch { }
  }

  const handleApproveBA = async () => {
    setBusy(true)
    try { await api.sdlc.approveBa(sessionId, editBA); print('📧 BA approved. Activating SA...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  const handleApproveSA = async () => {
    setBusy(true)
    try { await api.sdlc.approveSa(sessionId, editSA); print('📧 SA approved. Activating Dev Lead...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  const handleApproveDevLead = async () => {
    setBusy(true)
    try { await api.sdlc.approveDevLead(sessionId, editDevLead); print('📧 Dev Lead approved. Activating DEV/SEC/QA/SRE...'); await refreshSDLC() }
    catch (e: any) { print(`❌ ${e.message}`) } finally { setBusy(false) }
  }

  // ─── RAG ask (streaming) ─────────────────────────────────────────────────────

  const sendAsk = async (question: string, free = false) => {
    setChatHistory(prev => [...prev, { role: 'user', text: question }])
    setChatHistory(prev => [...prev, { role: 'assistant', text: '' }])
    setBusy(true)
    setRightTab('rag')

    let accumulated = ''
    try {
      for await (const chunk of api.askStream(
        sessionId, question,
        ideFile || undefined,
        ideContent ? ideContent.slice(0, 3000) : undefined,
        free,
      )) {
        if (chunk === '[DONE]') break
        if (chunk.startsWith('[ERROR]')) {
          setChatHistory(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'system', text: `❌ ${chunk.slice(8)}` }
            return next
          })
          return
        }
        if (chunk.startsWith('[TRACE] ')) {
          try {
            const trace = JSON.parse(chunk.slice(8))
            setChatHistory(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, trace }
              return next
            })
          } catch { }
          continue
        }
        accumulated += chunk
        setChatHistory(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', text: accumulated }
          return next
        })
      }
    } catch (e: any) {
      setChatHistory(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'system', text: `❌ ${e.message}` }
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  // ─── Session delete (direct — not routed through terminal) ──────────────────

  const deleteSession = async (targetId: string) => {
    try {
      await api.sessions.delete(targetId)
      await fetchSessions()
      showToast('🗑 Session deleted.')
      if (targetId === sessionId) {
        const fresh = await api.sessions.create() as Session
        await fetchSessions()
        router.replace(`/workspace/${fresh.id}`)
      }
    } catch (e: any) {
      showToast(`❌ ${e.message}`)
    }
  }

  // ─── Command handler ─────────────────────────────────────────────────────────

  const handleCmd = async (force?: string) => {
    const raw = (force || cmd).trim()
    if (!raw || busy) return
    setCmd('')
    print(`> ${raw}`, 'user')
    const args    = raw.split(' ')
    const command = args[0].toLowerCase()

    try {
      switch (command) {
        case '/help':
          print(
            'Available commands:\n' +
            '  /setup <url> [token]     — Configure GitHub repo\n' +
            '  /scan                    — Scan & index codebase\n' +
            '  /ask <question>          — RAG chat with AI (requires scan)\n' +
            '  /btw <question>          — Chat with AI freely (no scan needed)\n' +
            '  /cr <requirement>        — Start SDLC brainstorm\n' +
            '  /provider                — Show current AI provider\n' +
            '  /provider <name>         — Switch provider (gemini/openai/ollama/copilot/bedrock)\n' +
            '  /provider <name> <key>   — Switch provider and set API key in one step\n' +
            '  /new                     — Create new workspace\n' +
            '  /healthcheck             — Ping AI model connection\n' +
            '  /info                    — Show system info'
          )
          break

        case '/setup': {
          const url = args[1]
          if (!url) throw new Error('GitHub URL required. Example: /setup https://github.com/owner/repo')
          await api.config.setup(url, args[2] || '', 10000)
          await fetchStatus()
          print(`✅ Repo configured: ${url}`)
          break
        }

        case '/scan': {
          if (!status?.repo) throw new Error('No repo configured. Run /setup first.')
          setBusy(true)
          try { await api.kb.scan() } catch (e: any) { setBusy(false); throw e }
          setScanStatus({ running: true, text: 'Starting scan...', progress: 0 })
          print('🔍 Starting codebase scan...')
          setRightTab('ide')
          startScanPoll()
          setBusy(false)
          break
        }

        case '/ask': {
          const q = args.slice(1).join(' ')
          if (!q) throw new Error('Question required. Example: /ask Explain the auth flow?')
          if (!status?.kb_has_summary) throw new Error('KB not scanned yet. Run /scan first.')
          setLeftTab('chat')
          await sendAsk(q)
          break
        }

        case '/btw': {
          const q = args.slice(1).join(' ')
          if (!q) throw new Error('Question required. Example: /btw What is a JWT token?')
          setLeftTab('chat')
          await sendAsk(q, true)
          break
        }

        case '/cr': {
          const req = args.slice(1).join(' ')
          if (!req) throw new Error('Requirement required. Example: /cr Add PDF export module')
          if (!status?.kb_has_summary) throw new Error('KB not scanned yet. Run /scan first.')
          setBusy(true)
          await api.sdlc.start(sessionId, req)
          print('[BA] Analyzing requirement...')
          setRightTab('sdlc'); setLeftTab('tracing')
          await fetchMetrics()
          const poll = setInterval(async () => {
            const s = await api.sdlc.state(sessionId) as any
            if (s.workflow_state !== 'running_ba') {
              clearInterval(poll)
              await refreshSDLC()
              print('⚠️ BA done. Waiting for approval...')
              setBusy(false)
            }
          }, 2000)
          break
        }

        case '/provider': {
          const VALID_PROVIDERS = ['gemini', 'openai', 'ollama', 'copilot', 'bedrock']
          const providerArg = args[1]?.toLowerCase()
          const keyArg = args.slice(2).join(' ')

          // No args — show current status
          if (!providerArg) {
            print(
              `Current provider: ${status?.ai_provider ?? '—'}\n` +
              `Available: ${VALID_PROVIDERS.join(' · ')}\n\n` +
              `Usage:\n` +
              `  /provider gemini AIza...     — set key + activate\n` +
              `  /provider openai sk-...      — set key + activate\n` +
              `  /provider ollama             — activate (no key needed)\n` +
              `  /provider copilot ghp_...    — set token + activate\n` +
              `  /provider bedrock            — activate (set creds in ⚙ Settings)`
            )
            break
          }

          if (!VALID_PROVIDERS.includes(providerArg)) {
            throw new Error(`Unknown provider "${providerArg}". Valid: ${VALID_PROVIDERS.join(', ')}`)
          }

          setBusy(true)
          try {
            if (keyArg) {
              if (providerArg === 'gemini')       await api.config.setGeminiKey(keyArg)
              else if (providerArg === 'openai')  await api.config.setOpenAI(keyArg)
              else if (providerArg === 'copilot') await api.config.setCopilot(keyArg)
              else print(`ℹ Bedrock/Ollama credentials can't be set via command — use ⚙ Settings.`)
            }
            await api.config.setProvider(providerArg as any)
            await fetchStatus()
            print(`✅ Provider switched to ${providerArg}${keyArg ? ' with new API key' : ''}.`)
            print(`⟳ Running healthcheck...`)
            const hc = await api.health.model() as any
            if (hc.status === 'ok') {
              print(`✅ ${providerArg} OK — model: ${hc.model}, latency: ${hc.latency_ms}ms`)
            } else {
              print(`⚠ ${providerArg} error: ${hc.error}\n  Check your key in ⚙ Settings.`)
            }
          } finally {
            setBusy(false)
          }
          break
        }

        case '/new': {
          const s = await api.sessions.create() as Session
          await fetchSessions()
          router.push(`/workspace/${s.id}`)
          break
        }

        case '/delete':
          throw new Error('Use the Sessions panel (⬡ Session tab) to delete workspaces.')

        case '/healthcheck': {
          print('⟳ Pinging AI model...')
          setBusy(true)
          const hc = await api.health.model() as any
          setBusy(false)
          if (hc.status === 'ok') {
            print(`✅ Model OK\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Latency  : ${hc.latency_ms}ms`)
          } else {
            print(`❌ Model FAILED\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Error    : ${hc.error}`)
          }
          break
        }

        case '/info': {
          if (status) print(
            `System Info:\n` +
            `- Repo     : ${status.repo ? `${status.repo.owner}/${status.repo.repo}` : 'not set'}\n` +
            `- AI       : ${status.ai_provider}\n` +
            `- KB       : ${status.kb_files} files, ${status.kb_insights} chunks\n` +
            `- Sessions : ${status.total_sessions}  Cost: $${status.total_cost_usd.toFixed(5)}`
          )
          break
        }

        case '/dark':
        case '/light':
        case '/dracula':
        case '/yummy':
        case '/angry':
        case '/idea': {
          const themeId = command.slice(1) as ThemeId
          const theme = THEMES[themeId]
          applyTheme(themeId)
          print(`${theme.emoji} Theme → "${theme.name}" (${theme.mood} mode). Type /dark to reset.`)
          break
        }

        default:
          throw new Error(`Unknown command: ${command}. Type /help.`)
      }
    } catch (e: any) { print(`❌ ${e.message}`); setBusy(false) }
  }

  // ─── Tab button helpers ───────────────────────────────────────────────────────

  const LTAB = (key: LeftTab, label: string) => (
    <button key={key} onClick={() => setLeftTab(key)}
      className="flex-1 cursor-pointer bg-transparent border-none uppercase tracking-wide font-mono"
      style={{
        padding: '.5rem .3rem',
        borderBottom: leftTab === key ? '2px solid var(--green)' : '2px solid transparent',
        color: leftTab === key ? 'var(--green)' : 'var(--text-3)',
        fontSize: '.7rem', letterSpacing: '.05em',
      }}>
      {label}
    </button>
  )

  const RTAB = (key: RightTab, label: string, color = 'var(--text-2)') => (
    <button key={key} onClick={() => setRightTab(key)}
      className="whitespace-nowrap cursor-pointer font-mono text-xs bg-transparent border-none"
      style={{
        padding: '.45rem .9rem',
        borderBottom: rightTab === key ? `2px solid ${color}` : '2px solid transparent',
        color: rightTab === key ? color : 'var(--text-3)',
      }}>
      {label}
    </button>
  )

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  const isRunning = session.workflow_state?.includes('running') || !!scanStatus?.running

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden font-mono" style={{ background: 'var(--bg)' }}>

      {/* ══════════════════ LEFT PANEL ══════════════════ */}
      <div className="flex flex-col flex-shrink-0 border-r"
        style={{ width: `${leftW}%`, minWidth: 300, background: 'var(--bg-1)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <span className="font-display font-extrabold text-lg" style={{ color: 'var(--green)' }}>
            YUMMY <span className="text-2xs font-normal" style={{ color: 'var(--text-3)' }}>.better than your ex</span>
          </span>
          {(isRunning || scanStatus) && (
            <span className="text-2xs" style={{ color: 'var(--amber)', background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.2)', padding: '2px 8px', borderRadius: 20 }}>
              ⟳ {scanStatus?.text?.slice(0, 26) || 'running...'}
            </span>
          )}
        </div>

        {/* Left tabs */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {LTAB('chat',     '⬡ Chat')}
          {LTAB('sessions', '⬡ Session')}
          {LTAB('tracing',  '⬡ Tracing')}
          {LTAB('settings', '⚙ Settings')}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {leftTab === 'chat' && (
            <ChatPanel
              sessionName={session.name}
              termLogs={termLogs}
              chatHistory={chatHistory}
              scanStatus={scanStatus}
              busy={busy}
              cmd={cmd}
              suggestionIdx={suggestionIdx}
              termRef={termRef}
              currentProvider={(status?.ai_provider ?? 'gemini') as any}
              onCmdChange={setCmd}
              onSuggestionIdx={setSuggestionIdx}
              onSubmit={handleCmd}
              onProviderSaved={fetchStatus}
            />
          )}
          {leftTab === 'sessions' && (
            <SessionsPanel
              sessions={sessions}
              currentSessionId={sessionId}
              onNew={async () => {
                const s = await api.sessions.create() as Session
                await fetchSessions()
                router.push(`/workspace/${s.id}`)
              }}
              onDeleteRequest={setDeleteTarget}
            />
          )}
          {leftTab === 'tracing' && (
            <TracingPanel metrics={metrics} onLoad={fetchMetrics} />
          )}
          {leftTab === 'settings' && (
            <SettingsPanel status={status} onStatusRefresh={fetchStatus} />
          )}
        </div>
      </div>

      {/* ══════════════════ RESIZER ══════════════════ */}
      <div
        onMouseDown={() => setDragging(true)}
        className="cursor-col-resize flex-shrink-0 z-50 hover:bg-green-500 transition-colors"
        style={{ width: 4, background: dragging ? 'var(--green)' : 'var(--border)' }}
      />

      {/* ══════════════════ RIGHT PANEL ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg)' }}>

        {/* Right tabs */}
        <div className="flex border-b overflow-x-auto flex-shrink-0 items-end"
          style={{ height: 44, borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
          {RTAB('ide',      '⬡ IDE Simulator',     'var(--text-2)')}
          {RTAB('graph',    '⬡ Node Arch',          'var(--green)')}
          {RTAB('wiki',     '⬡ GitBook Wiki',       '#ff79c6')}
          {RTAB('insights', '⬡ AI Insights',        '#ffb300')}
          {RTAB('rag',      '⬡ RAG Trace',          '#00aaff')}
          {RTAB('sdlc',     '⬡ SDLC Brainstorm',    '#ffb300')}
          {RTAB('backlog',  '⬡ JIRA Kanban',        '#aa88ff')}
          {RTAB('db',       '⬡ Local DB',           '#ff6644')}
        </div>

        <div className="flex-1 overflow-hidden" style={{ background: 'var(--bg-1)' }}>
          {rightTab === 'ide'      && <IdePanel tree={kb?.tree || []} ideFile={ideFile} ideContent={ideContent} ideLoading={ideLoading} onFileOpen={openFile} />}
          {rightTab === 'graph'    && (
            <div className="p-6 h-full flex flex-col">
              <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--green)' }}>⬡ Node Architecture Graph</h2>
              <div className="flex-1 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                <NodeGraph tree={kb?.tree || []} repoInfo={status?.repo ?? null} />
              </div>
            </div>
          )}
          {rightTab === 'wiki'     && <WikiPanel kb={kb} />}
          {rightTab === 'insights' && <InsightsPanel kb={kb} />}
          {rightTab === 'rag'      && <RagPanel chatHistory={chatHistory} />}
          {rightTab === 'sdlc'     && (
            <SdlcPanel
              session={session}
              editBA={editBA} editSA={editSA} editDevLead={editDevLead}
              busy={busy}
              onEditBA={setEditBA} onEditSA={setEditSA} onEditDevLead={setEditDevLead}
              onApproveBA={handleApproveBA} onApproveSA={handleApproveSA} onApproveDevLead={handleApproveDevLead}
            />
          )}
          {rightTab === 'backlog'  && <BacklogPanel backlog={session.jira_backlog || []} />}
          {rightTab === 'db'       && <DbPanel sessions={sessions} currentSessionId={sessionId} status={status} />}
        </div>
      </div>

      {/* ══════════════════ ONBOARDING ══════════════════ */}
      {/* Step 0: Ask if first time */}
      {onboardingState === 'asking' && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl border w-full max-w-sm mx-4 overflow-hidden"
            style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>
            <div className="px-6 pt-6 pb-4">
              <div className="text-3xl mb-3">👋</div>
              <p className="font-display font-extrabold text-xl mb-1" style={{ color: 'var(--green)' }}>Welcome to YUMMY</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Is this your first time here?</p>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setOnboardingState('wizard')}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm cursor-pointer"
                style={{ background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
                Yes, show me around
              </button>
              <button
                onClick={() => { localStorage.setItem('yummy_onboarding', 'done'); setOnboardingState('dismissed') }}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm cursor-pointer"
                style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                No, I know what I'm doing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1–3: Full wizard */}
      {onboardingState === 'wizard' && (
        <OnboardingWizard
          status={status}
          onComplete={() => {
            localStorage.setItem('yummy_onboarding', 'done')
            setOnboardingState('dismissed')
            fetchStatus()
          }}
          onScanStart={() => {
            setScanStatus({ running: true, text: 'Starting scan...', progress: 0 })
            print('🔍 Starting codebase scan...')
            setRightTab('ide')
            startScanPoll()
          }}
        />
      )}

      {/* ══════════════════ DELETE CONFIRM MODAL ══════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteTarget(null)}>
          <div className="border rounded-xl" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-1)', borderColor: '#ff664455', padding: '1.75rem 2rem', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">🗑</span>
              <span className="font-display font-extrabold text-lg" style={{ color: '#ff6644' }}>Delete Session</span>
            </div>
            <p className="text-base leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
              Are you sure you want to delete this workspace?
            </p>
            <p className="text-sm border rounded px-3 py-2 mb-6 font-mono truncate"
              style={{ color: 'var(--text-3)', background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {deleteTarget.name}
            </p>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,100,68,.7)' }}>This action cannot be undone.</p>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="border rounded-lg cursor-pointer font-mono text-base"
                style={{ padding: '.5rem 1.2rem', background: 'none', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                Cancel
              </button>
              <button
                onClick={async () => { const t = deleteTarget; setDeleteTarget(null); await deleteSession(t.id) }}
                className="border-none rounded-lg cursor-pointer font-mono text-base font-bold"
                style={{ padding: '.5rem 1.2rem', background: '#ff6644', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TOAST ══════════════════ */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] border rounded-lg flex items-center gap-2 font-mono text-base"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--green-dim)', padding: '.65rem 1.1rem', color: 'var(--green)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      {/* Global prose styles */}
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
