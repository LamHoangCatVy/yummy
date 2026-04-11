'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

interface Props {
  sessionId: string
  chatHistory: ChatMessage[]
  onHistoryUpdate: (msgs: ChatMessage[]) => void
  hasKB: boolean
}

export default function ChatPanel({ sessionId, chatHistory, onHistoryUpdate, hasKB }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, loading])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = { role: 'user', text: q }
    onHistoryUpdate([...chatHistory, userMsg])

    try {
      const res = await api.ask(sessionId, q) as any
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        text: res.answer,
        trace: res.trace,
      }
      onHistoryUpdate([...chatHistory, userMsg, assistantMsg])
    } catch (e: any) {
      const errMsg: ChatMessage = { role: 'system', text: `❌ ${e.message}` }
      onHistoryUpdate([...chatHistory, userMsg, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {chatHistory.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'var(--text-3)', fontSize: '0.8rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', opacity: 0.4 }}>◎</div>
            {hasKB ? 'Ask anything about the codebase' : 'Scan the repo first to enable chat'}
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className="fade-in" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '0.2rem',
            }}>
              <div style={{
                fontSize: '0.68rem',
                color: 'var(--text-3)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {msg.role === 'user' ? 'you' : msg.role === 'assistant' ? 'expert agent' : 'system'}
              </div>
              <div style={{
                maxWidth: '90%',
                padding: '0.5rem 0.8rem',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                ...(msg.role === 'user' ? {
                  background: 'var(--green-mute)',
                  border: '1px solid var(--green-dim)',
                  color: 'var(--green)',
                  borderBottomRightRadius: 'var(--radius)',
                } : msg.role === 'assistant' ? {
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderBottomLeftRadius: 'var(--radius)',
                } : {
                  background: 'rgba(255,68,68,0.06)',
                  border: '1px solid var(--red-dim)',
                  color: 'var(--red)',
                  width: '100%',
                }),
              }}>
                {msg.role === 'assistant' ? (
                  <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(msg.text) }} />
                ) : (
                  msg.text
                )}
              </div>

              {/* RAG Trace */}
              {msg.trace && (
                <details style={{ maxWidth: '90%', width: '100%' }}>
                  <summary style={{
                    fontSize: '0.68rem', color: 'var(--text-3)', cursor: 'pointer',
                    listStyle: 'none', display: 'flex', gap: '0.3rem', alignItems: 'center',
                  }}>
                    <span>⬡</span> RAG trace · {msg.trace.source_chunks.length} chunks
                  </summary>
                  <div style={{
                    marginTop: '0.3rem',
                    padding: '0.5rem',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.7rem',
                    color: 'var(--text-3)',
                  }}>
                    {msg.trace.source_chunks.map((c, j) => (
                      <div key={j} style={{ marginBottom: '0.4rem' }}>
                        <div style={{ color: 'var(--amber)', marginBottom: '0.1rem' }}>
                          {c.files.slice(0, 3).join(' · ')}
                        </div>
                        <div style={{ color: 'var(--text-3)' }}>{c.summary_preview}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))
        )}

        {loading && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-3)', fontSize: '0.78rem' }}>
            <span className="blink" style={{ color: 'var(--green)' }}>▊</span>
            Expert agent thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
        <textarea
          className="input"
          rows={2}
          placeholder={hasKB ? 'Ask about the codebase... (Enter to send)' : 'Scan repo first'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!hasKB || loading}
          style={{ resize: 'none', flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={!hasKB || loading || !input.trim()}
          style={{ alignSelf: 'flex-end', padding: '0.45rem 0.9rem' }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function mdToHtml(md: string): string {
  return md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
}
