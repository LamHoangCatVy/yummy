'use client'

import React, { useRef, useState } from 'react'
import { mdToHtml } from '@/lib/mdToHtml'
import { api } from '@/lib/api'
import type { ChatMessage, ScanStatus } from '@/lib/types'

const TermLogRow = React.memo(function TermLogRow({ role, text }: { role: string; text: string }) {
  return (
    <div className="flex gap-2" style={{ color: role === 'user' ? 'var(--green)' : 'var(--text-2)' }}>
      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{role === 'user' ? '❯' : '⚡'}</span>
      <span className="whitespace-pre-wrap">{text}</span>
    </div>
  )
})

const ChatMessageRow = React.memo(function ChatMessageRow({ message }: { message: ChatMessage }) {
  const html = React.useMemo(() => {
    if (message.role === 'user') return ''
    return mdToHtml(message.text)
  }, [message.role, message.text])

  return (
    <div className="flex gap-2" style={{ color: message.role === 'user' ? 'var(--green)' : 'var(--text)' }}>
      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>{message.role === 'user' ? '❯' : '🤖'}</span>
      {message.role === 'user' ? (
        <span className="font-semibold">{message.text}</span>
      ) : (
        <div className="flex-1 border rounded-lg p-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
          {message.trace && (
            <details className="mt-2">
              <summary className="text-2xs cursor-pointer" style={{ color: 'var(--text-3)' }}>
                ⬡ RAG trace · {message.trace.source_chunks?.length || 0} chunks
              </summary>
              <div className="mt-1.5 p-2 border rounded text-xs" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                {message.trace.source_chunks?.map((c: any, j: number) => (
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
  )
})

export const COMMANDS = [
  { cmd: '/setup',       args: '<github_url> [token]', desc: 'Configure GitHub repo' },
  { cmd: '/scan',        args: '',                     desc: 'Scan & index codebase' },
  { cmd: '/ask',         args: '<question>',           desc: 'RAG chat with AI about code' },
  { cmd: '/btw',         args: '<question>',           desc: 'Chat with AI (no scan needed)' },
  { cmd: '/cr',          args: '<requirement>',        desc: 'Start SDLC brainstorm' },
  { cmd: '/provider',    args: '[name] [api_key]',     desc: 'Switch AI provider or view current' },
  { cmd: '/new',         args: '',                     desc: 'Create new workspace' },
  { cmd: '/healthcheck', args: '',                     desc: 'Ping AI model connection' },
  { cmd: '/info',        args: '',                     desc: 'Show system info' },
  { cmd: '/help',        args: '',                     desc: 'List all commands' },
  // ── Themes ──
  { cmd: '/yummy',   args: '', desc: '🩷 Bubblegum pink theme (love mood)' },
  { cmd: '/dark',    args: '', desc: '🖥  Phosphor terminal theme (default)' },
  { cmd: '/light',   args: '', desc: '☀️  Clean light studio theme' },
  { cmd: '/dracula', args: '', desc: '🧛 Purple/pink Dracula theme' },
  { cmd: '/angry',   args: '', desc: '🔥 Hot red/orange theme' },
  { cmd: '/idea',    args: '', desc: '💡 Golden yellow + cyan theme' },
]

// Detect if a string looks like an API key / token
const KEY_PATTERNS = [
  /^AIza[0-9A-Za-z_-]{35,}/,          // Gemini
  /^sk-[A-Za-z0-9]{20,}/,             // OpenAI
  /^ghp_[A-Za-z0-9]{36,}/,            // GitHub PAT
  /^gho_[A-Za-z0-9]{36,}/,            // GitHub OAuth
  /^AKIA[0-9A-Z]{16}/,                // AWS Access Key
  /^[A-Za-z0-9+/]{40,}={0,2}$/,       // Generic base64-ish secret
]

function looksLikeKey(text: string): boolean {
  const t = text.trim()
  return KEY_PATTERNS.some(r => r.test(t))
}

type Provider = 'gemini' | 'openai' | 'bedrock' | 'copilot' | 'ollama'

const PROVIDER_KEY_LABELS: Record<Provider, string> = {
  gemini:  'Gemini API Key (AIza...)',
  openai:  'OpenAI API Key (sk-...)',
  copilot: 'GitHub Token (ghp_...)',
  bedrock: 'AWS Access Key ID (AKIA...)',
  ollama:  'Ollama Base URL',
}

interface ChatPanelProps {
  sessionName: string
  termLogs: { role: string; text: string }[]
  chatHistory: ChatMessage[]
  scanStatus: ScanStatus | null
  busy: boolean
  termRef: React.RefObject<HTMLDivElement | null>
  currentProvider: Provider
  onSubmit: (raw: string) => void
  onProviderSaved: () => void
}

export default function ChatPanel({
  sessionName, termLogs, chatHistory, scanStatus, busy,
  termRef,
  currentProvider,
  onSubmit, onProviderSaved,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cmd, setCmd] = useState('')
  const [suggestionIdx, setSuggestionIdx] = useState(0)

  // API key modal state
  const [keyModal, setKeyModal] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [keyProvider, setKeyProvider] = useState<Provider>(currentProvider)
  const [keySaving, setKeySaving] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keySuccess, setKeySuccess] = useState(false)

  const isScanning = !!scanStatus?.running
  const isBlocked  = busy || isScanning

  const activeSuggestions = React.useMemo(() => {
    if (!cmd.startsWith('/')) return []
    return COMMANDS.filter(c => c.cmd.startsWith(cmd.split(' ')[0]))
  }, [cmd])

  const submitCmd = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setCmd('')
    setSuggestionIdx(0)
    onSubmit(trimmed)
  }

  // ── Key modal save ────────────────────────────────────────────────────────
  const saveKey = async () => {
    if (!keyValue.trim()) return
    setKeySaving(true); setKeyError(''); setKeySuccess(false)
    try {
      switch (keyProvider) {
        case 'gemini':  await api.config.setGeminiKey(keyValue.trim()); break
        case 'openai':  await api.config.setOpenAI(keyValue.trim()); break
        case 'copilot': await api.config.setCopilot(keyValue.trim()); break
        case 'bedrock': await api.config.setBedrock(keyValue.trim(), ''); break
        case 'ollama':  await api.config.setOllama(keyValue.trim(), 'llama3'); break
      }
      await api.config.setProvider(keyProvider)
      setKeySuccess(true)
      onProviderSaved()
      setTimeout(() => { setKeyModal(false); setKeyValue(''); setKeySuccess(false) }, 1200)
    } catch (e: any) {
      setKeyError(e.message)
    } finally {
      setKeySaving(false)
    }
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isBlocked) { e.preventDefault(); return }

    if (activeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestionIdx(Math.min(suggestionIdx + 1, activeSuggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionIdx(Math.max(suggestionIdx - 1, 0))
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const s = activeSuggestions[suggestionIdx]
        if (!s.args) { submitCmd(s.cmd) } else { setCmd(s.cmd + ' ') }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const s = activeSuggestions[suggestionIdx]
        const parts = cmd.trim().split(' ')
        const hasArgs = parts.length > 1 && parts[1] !== ''
        if (hasArgs) {
          submitCmd(cmd)
        } else if (!s.args) {
          submitCmd(s.cmd)
        } else {
          setCmd(s.cmd + ' ')
        }
        return
      }
    }

    if (e.key === 'Enter') {
      // Plain text that looks like an API key → open modal instead of submitting
      if (!cmd.startsWith('/') && looksLikeKey(cmd)) {
        e.preventDefault()
        setKeyValue(cmd.trim())
        setKeyProvider(currentProvider)
        setKeyModal(true)
        setCmd('')
        return
      }
      submitCmd(cmd)
    }
    if (e.key === 'Escape') { setCmd(''); setSuggestionIdx(0) }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlocked) return
    const v = e.target.value
    setCmd(v)
    setSuggestionIdx(0)
    // If user pastes something that looks like a key, open modal immediately
    if (!v.startsWith('/') && looksLikeKey(v)) {
      setKeyValue(v.trim())
      setKeyProvider(currentProvider)
      setKeyModal(true)
      setCmd('')
    }
  }

  const selectSuggestion = (s: typeof COMMANDS[number], i: number) => {
    setSuggestionIdx(i)
    if (!s.args) { submitCmd(s.cmd) } else { setCmd(s.cmd + ' '); inputRef.current?.focus() }
  }

  const PROVIDER_OPTIONS: Provider[] = ['gemini', 'openai', 'copilot', 'bedrock', 'ollama']

  return (
    <div className="flex flex-col h-full">
      {/* Session name bar */}
      <div className="border-b flex-shrink-0 text-center uppercase tracking-widest text-2xs px-4 py-1"
        style={{ background: 'var(--green-mute)', borderColor: 'var(--border)', color: 'var(--green)', letterSpacing: '.08em' }}>
        {sessionName}
      </div>

      {/* Message feed — termLogs first, then chatHistory below */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 text-base leading-relaxed">

        {termLogs.map((log, i) => <TermLogRow key={`t${i}`} role={log.role} text={log.text} />)}
        {chatHistory.map((m, i) => <ChatMessageRow key={`c${i}`} message={m} />)}

        {/* Busy / scan progress */}
        {busy && (
          <div className="flex gap-2 items-center text-sm border rounded px-3 py-2"
            style={{ color: 'var(--amber)', background: 'rgba(255,179,0,.05)', borderColor: 'rgba(255,179,0,.15)' }}>
            <span>⟳</span> {scanStatus?.text || 'AI is processing...'}
          </div>
        )}
        {scanStatus?.running && !busy && (
          <div className="flex flex-col gap-1.5 border rounded px-3 py-2.5"
            style={{ color: 'var(--amber)', background: 'rgba(255,179,0,.05)', borderColor: 'rgba(255,179,0,.15)' }}>
            <div className="flex items-center gap-2 text-sm">
              <span>⟳</span>
              <span className="flex-1 truncate">{scanStatus.text}</span>
              <span className="text-2xs flex-shrink-0" style={{ color: 'var(--text-3)' }}>{scanStatus.progress}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,179,0,.15)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${scanStatus.progress}%`, background: 'var(--amber)' }} />
            </div>
          </div>
        )}

        <div ref={termRef} />
      </div>

      {/* Quick command chips */}
      <div className="px-3 flex gap-1 overflow-x-auto pb-1.5 flex-shrink-0">
        {['/scan', '/ask Explain the auth flow?', '/btw', '/provider', '/help'].map((h, i) => (
          <button key={i} onClick={() => !isBlocked && submitCmd(h)} disabled={isBlocked}
            className="whitespace-nowrap border rounded-full text-2xs cursor-pointer flex-shrink-0"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)', padding: '3px 10px', opacity: isBlocked ? .4 : 1 }}>
            ⚡ {h}
          </button>
        ))}
      </div>

      {/* Autocomplete suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="mx-3 mb-1 border rounded-lg overflow-hidden flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {activeSuggestions.map((s, i) => (
            <div key={s.cmd}
              onMouseEnter={() => setSuggestionIdx(i)}
              onClick={() => selectSuggestion(s, i)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              style={{
                background: i === suggestionIdx ? 'var(--green-glow)' : 'transparent',
                borderLeft: `2px solid ${i === suggestionIdx ? 'var(--green)' : 'transparent'}`,
              }}>
              <span className="font-mono text-sm font-bold flex-shrink-0"
                style={{ color: i === suggestionIdx ? 'var(--green)' : 'var(--text-2)' }}>
                {s.cmd}
              </span>
              {s.args && (
                <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--amber)' }}>
                  {s.args}
                </span>
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--text-3)' }}>{s.desc}</span>
              {i === suggestionIdx && (
                <span className="text-2xs flex-shrink-0 px-1 rounded"
                  style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                  ↵ select
                </span>
              )}
            </div>
          ))}
          <div className="px-3 py-1 border-t text-2xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)' }}>
            ↑↓ navigate · ↵ or Tab to select · Esc to close
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 py-2.5 border-t flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        {isScanning && (
          <div className="mb-2 px-3 py-1.5 rounded text-xs text-center"
            style={{ background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.2)', color: 'var(--amber)' }}>
            ⟳ Scanning in progress — input disabled until complete
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={cmd}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isScanning ? 'Scanning codebase, please wait...' : 'Type / for commands, or ask anything...'}
            disabled={isBlocked}
            autoFocus
            className="flex-1 border rounded font-mono text-base outline-none"
            style={{
              background: isBlocked ? 'var(--bg)' : 'var(--bg-2)',
              borderColor: 'var(--border)',
              color: isBlocked ? 'var(--text-3)' : 'var(--text)',
              padding: '.5rem .75rem',
              fontSize: '.82rem',
              cursor: isBlocked ? 'not-allowed' : 'text',
            }}
          />
          <button onClick={() => submitCmd(cmd)} disabled={isBlocked || !cmd.trim()}
            className="border-none rounded cursor-pointer font-bold text-md"
            style={{
              background: 'var(--green)', color: 'var(--bg)', padding: '.5rem .9rem',
              opacity: (isBlocked || !cmd.trim()) ? .4 : 1,
              cursor: isBlocked ? 'not-allowed' : 'pointer',
            }}>
            ↑
          </button>
        </div>
      </div>

      {/* ── API Key Modal ── */}
      {keyModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => { setKeyModal(false); setKeyValue(''); setKeyError('') }}>
          <div className="rounded-xl border w-full max-w-sm mx-4 overflow-hidden"
            style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }}
            onClick={e => e.stopPropagation()}>

            <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text)' }}>Set API Key</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Looks like you pasted a key. Choose the provider and save it securely.
              </p>
            </div>

            <div className="p-5 flex flex-col gap-3">
              {/* Provider selector */}
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>Provider</span>
                <select
                  className="text-sm rounded px-3 py-2 font-mono w-full outline-none cursor-pointer"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
                  value={keyProvider}
                  onChange={e => setKeyProvider(e.target.value as Provider)}>
                  {PROVIDER_OPTIONS.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </label>

              {/* Key input */}
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{PROVIDER_KEY_LABELS[keyProvider]}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="text-sm rounded px-3 py-2 font-mono w-full outline-none"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)', caretColor: 'var(--green)' }}
                  value={keyValue}
                  onChange={e => setKeyValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveKey(); if (e.key === 'Escape') { setKeyModal(false); setKeyValue('') } }}
                  autoFocus
                />
              </label>

              {keyError && (
                <p className="text-xs px-3 py-2 rounded border"
                  style={{ color: 'var(--red)', background: 'rgba(255,68,68,.08)', borderColor: 'rgba(255,68,68,.2)' }}>
                  ✕ {keyError}
                </p>
              )}
              {keySuccess && (
                <p className="text-xs px-3 py-2 rounded border"
                  style={{ color: 'var(--green)', background: 'var(--green-mute)', borderColor: 'var(--green-dim)' }}>
                  ✓ Saved and activated!
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setKeyModal(false); setKeyValue(''); setKeyError('') }}
                  className="border rounded-lg cursor-pointer font-mono text-sm px-4 py-2"
                  style={{ background: 'none', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                  Cancel
                </button>
                <button
                  onClick={saveKey}
                  disabled={keySaving || !keyValue.trim()}
                  className="flex-1 rounded-lg cursor-pointer font-bold text-sm py-2"
                  style={{
                    background: 'var(--green-mute)', color: 'var(--green)',
                    border: '1px solid var(--green-dim)',
                    opacity: (keySaving || !keyValue.trim()) ? .5 : 1,
                  }}>
                  {keySaving ? '⟳ Saving...' : '✓ Save & Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
