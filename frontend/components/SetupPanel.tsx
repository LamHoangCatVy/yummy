'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { SystemStatus } from '@/lib/types'

interface Props {
  status: SystemStatus | null
  onRefresh: () => void
}

export default function SetupPanel({ status, onRefresh }: Props) {
  const [tab, setTab] = useState<'ai' | 'github'>('ai')
  const [provider, setProvider] = useState<'gemini' | 'ollama'>(status?.ai_provider || 'gemini')
  const [geminiKey, setGeminiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('codellama')
  const [githubUrl, setGithubUrl] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [maxFiles, setMaxFiles] = useState('100')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const handleSaveAI = async () => {
    setLoading(true)
    try {
      if (provider === 'gemini') {
        if (!geminiKey) return flash('err', 'Nhập Gemini API key')
        await api.config.setGeminiKey(geminiKey)
      } else {
        await api.config.setOllama(ollamaUrl, ollamaModel)
      }
      await api.config.setProvider(provider)
      flash('ok', `✓ AI provider set: ${provider}`)
      onRefresh()
    } catch (e: any) {
      flash('err', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetupRepo = async () => {
    if (!githubUrl) return flash('err', 'Nhập GitHub URL')
    setLoading(true)
    try {
      await api.config.setup(githubUrl, githubToken, parseInt(maxFiles) || 100)
      flash('ok', '✓ Repo configured')
      onRefresh()
    } catch (e: any) {
      flash('err', e.message)
    } finally {
      setLoading(false)
    }
  }

  const row = (label: string, children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ color: 'var(--text-2)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status bar */}
      {status && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          padding: '0.75rem',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.75rem',
        }}>
          {[
            ['AI Key', status.has_gemini_key || status.ai_provider === 'ollama'],
            ['GitHub Token', status.has_github_token],
            ['Repo', !!status.repo],
            ['KB Ready', status.kb_has_summary],
          ].map(([label, ok]) => (
            <div key={label as string} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: ok ? 'var(--green)' : 'var(--text-3)' }}>
                {ok ? '◉' : '○'}
              </span>
              <span style={{ color: ok ? 'var(--text)' : 'var(--text-3)' }}>{label as string}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['ai', 'github'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1,
            padding: '0.55rem',
            background: 'none',
            border: 'none',
            borderBottom: tab === t ? '2px solid var(--green)' : '2px solid transparent',
            color: tab === t ? 'var(--green)' : 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            transition: 'color 0.15s',
          }}>
            {t === 'ai' ? '⚡ AI Provider' : '🐙 GitHub'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

        {tab === 'ai' && (
          <>
            {row('Provider', (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['gemini', 'ollama'] as const).map(p => (
                  <button key={p} onClick={() => setProvider(p)} className={`btn ${provider === p ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}>
                    {p === 'gemini' ? '☁ Gemini' : '🦙 Ollama'}
                  </button>
                ))}
              </div>
            ))}

            {provider === 'gemini' ? (
              <>
                {row('Gemini API Key', (
                  <input
                    className="input"
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                  />
                ))}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
                  Lấy key tại{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                    style={{ color: 'var(--green)' }}>
                    aistudio.google.com
                  </a>
                  <br />Model: Gemini 2.5 Flash · ~$0.075/1M tokens in
                </div>
              </>
            ) : (
              <>
                {row('Ollama Base URL', (
                  <input className="input" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
                ))}
                {row('Model', (
                  <select className="input" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                    style={{ cursor: 'pointer' }}>
                    <option value="codellama">codellama (recommended for code)</option>
                    <option value="llama3">llama3 (general)</option>
                    <option value="deepseek-coder">deepseek-coder</option>
                    <option value="mistral">mistral</option>
                    <option value="phi3">phi3 (lightweight)</option>
                  </select>
                ))}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.7, background: 'var(--bg-2)', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--amber)', marginBottom: '0.3rem' }}>Setup Ollama:</div>
                  {['brew install ollama (Mac)', 'ollama serve', `ollama pull ${ollamaModel}`].map(cmd => (
                    <div key={cmd} style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>$ {cmd}</div>
                  ))}
                </div>
              </>
            )}

            <button className="btn btn-primary" onClick={handleSaveAI} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Saving...' : 'Save AI Config'}
            </button>
          </>
        )}

        {tab === 'github' && (
          <>
            {status?.repo && (
              <div style={{ padding: '0.6rem', background: 'var(--green-glow)', border: '1px solid var(--green-mute)', borderRadius: 'var(--radius)', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--green)' }}>◉ </span>
                {status.repo.owner}/{status.repo.repo}
                {status.repo.branch && <span style={{ color: 'var(--text-2)' }}> @ {status.repo.branch}</span>}
              </div>
            )}

            {row('GitHub URL', (
              <input
                className="input"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
              />
            ))}

            {row('Personal Access Token (optional)', (
              <input
                className="input"
                type="password"
                placeholder="github_pat_... (private repo)"
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
              />
            ))}

            {row('Max files to scan', (
              <input
                className="input"
                type="number"
                value={maxFiles}
                onChange={e => setMaxFiles(e.target.value)}
                min="10"
                max="10000"
              />
            ))}

            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.6, background: 'var(--bg-2)', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--amber)', marginBottom: '0.3rem' }}>Lấy GitHub Token:</div>
              <div>1. github.com/settings/tokens</div>
              <div>2. Fine-grained token → Contents: Read</div>
              <div>3. Cần cho private repo / tránh rate limit</div>
            </div>

            <button className="btn btn-primary" onClick={handleSetupRepo} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Connecting...' : 'Setup Repository'}
            </button>
          </>
        )}
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          margin: '0 0.9rem 0.9rem',
          padding: '0.5rem 0.8rem',
          borderRadius: 'var(--radius)',
          fontSize: '0.78rem',
          background: msg.type === 'ok' ? 'var(--green-glow)' : 'rgba(255,68,68,0.08)',
          border: `1px solid ${msg.type === 'ok' ? 'var(--green-mute)' : 'var(--red-dim)'}`,
          color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}
