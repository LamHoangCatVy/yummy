'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { SystemStatus } from '@/lib/types'

const COPILOT_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-5', 'o3-mini', 'claude-sonnet-4-5', 'claude-opus-4-5']

interface Props {
  status: SystemStatus | null
  onRefresh: () => void
}

export default function SetupPanel({ status, onRefresh }: Props) {
  const [tab, setTab] = useState<'ai' | 'github'>('ai')
  const [provider, setProvider] = useState<'gemini' | 'ollama' | 'copilot'>(status?.ai_provider || 'gemini')
  const [geminiKey, setGeminiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('codellama')
  const [copilotToken, setCopilotToken] = useState('')
  const [copilotModel, setCopilotModel] = useState('gpt-4o')
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
      } else if (provider === 'copilot') {
        if (!copilotToken) return flash('err', 'Nhập GitHub Copilot token')
        await api.config.setCopilot(copilotToken, copilotModel)
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
    <div className="flex flex-col gap-[0.3rem]">
      <label className="text-text-2 text-xs uppercase tracking-[0.06em]">
        {label}
      </label>
      {children}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      {status && (
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-border text-[0.75rem]">
          {[
            ['AI Key', status.has_gemini_key || status.ai_provider === 'ollama'],
            ['GitHub Token', status.has_github_token],
            ['Repo', !!status.repo],
            ['KB Ready', status.kb_has_summary],
          ].map(([label, ok]) => (
            <div key={label as string} className="flex gap-[0.4rem] items-center">
              <span className={ok ? 'text-green' : 'text-text-3'}>
                {ok ? '◉' : '○'}
              </span>
              <span className={ok ? 'text-text' : 'text-text-3'}>{label as string}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['ai', 'github'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={[
            'flex-1 py-[0.55rem] bg-transparent border-0 font-mono text-[0.75rem] cursor-pointer uppercase tracking-[0.06em] transition-colors duration-150',
            tab === t
              ? 'border-b-2 border-green text-green'
              : 'border-b-2 border-transparent text-text-3',
          ].join(' ')}>
            {t === 'ai' ? '⚡ AI Provider' : '🐙 GitHub'}
          </button>
        ))}
      </div>

      <div className="overflow-auto p-[0.9rem] flex flex-col gap-[0.9rem]">

        {tab === 'ai' && (
          <>
            {row('Provider', (
              <div className="flex gap-2">
                {([
                  { id: 'gemini', label: '☁ Gemini' },
                  { id: 'ollama', label: '🦙 Ollama' },
                  { id: 'copilot', label: '🤖 Copilot' },
                ] as const).map(p => (
                  <button key={p.id} onClick={() => setProvider(p.id)} className={`btn flex-1 ${provider === p.id ? 'btn-primary' : 'btn-ghost'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            ))}

            {provider === 'gemini' && (
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
                <div className="text-xs text-text-3 leading-[1.5]">
                  Lấy key tại{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                    className="text-green">
                    aistudio.google.com
                  </a>
                  <br />Model: Gemini 2.5 Flash · ~$0.075/1M tokens in
                </div>
              </>
            )}

            {provider === 'ollama' && (
              <>
                {row('Ollama Base URL', (
                  <input className="input" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
                ))}
                {row('Model', (
                  <select className="input cursor-pointer" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}>
                    <option value="codellama">codellama (recommended for code)</option>
                    <option value="llama3">llama3 (general)</option>
                    <option value="deepseek-coder">deepseek-coder</option>
                    <option value="mistral">mistral</option>
                    <option value="phi3">phi3 (lightweight)</option>
                  </select>
                ))}
                <div className="text-xs text-text-3 leading-[1.7] bg-bg-2 p-[0.6rem] rounded border border-border">
                  <div className="text-amber mb-[0.3rem]">Setup Ollama:</div>
                  {['brew install ollama (Mac)', 'ollama serve', `ollama pull ${ollamaModel}`].map(cmd => (
                    <div key={cmd} className="text-green font-mono">$ {cmd}</div>
                  ))}
                </div>
              </>
            )}

            {provider === 'copilot' && (
              <>
                {row('GitHub Token', (
                  <input
                    className="input"
                    type="password"
                    placeholder="github_pat_... or ghp_..."
                    value={copilotToken}
                    onChange={e => setCopilotToken(e.target.value)}
                  />
                ))}
                {row('Model', (
                  <select className="input cursor-pointer" value={copilotModel} onChange={e => setCopilotModel(e.target.value)}>
                    {COPILOT_MODELS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ))}
                <div className="text-xs text-text-3 leading-[1.7] bg-bg-2 p-[0.6rem] rounded border border-border">
                  <div className="text-[#64a0ff] mb-[0.3rem]">GitHub Copilot requirements:</div>
                  <div>· Active GitHub Copilot subscription</div>
                  <div>· Token scopes: <span className="text-green font-mono">read:user</span></div>
                </div>
              </>
            )}

            <button className="btn btn-primary w-full justify-center" onClick={handleSaveAI} disabled={loading}>
              {loading ? 'Saving...' : 'Save AI Config'}
            </button>
          </>
        )}

        {tab === 'github' && (
          <>
            {status?.repo && (
              <div className="p-[0.6rem] bg-green-mute border border-green-dim rounded text-sm">
                <span className="text-green">◉ </span>
                {status.repo.owner}/{status.repo.repo}
                {status.repo.branch && <span className="text-text-2"> @ {status.repo.branch}</span>}
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

            <div className="text-xs text-text-3 leading-[1.6] bg-bg-2 p-[0.6rem] rounded border border-border">
              <div className="text-amber mb-[0.3rem]">Lấy GitHub Token:</div>
              <div>1. github.com/settings/tokens</div>
              <div>2. Fine-grained token → Contents: Read</div>
              <div>3. Cần cho private repo / tránh rate limit</div>
            </div>

            <button className="btn btn-primary w-full justify-center" onClick={handleSetupRepo} disabled={loading}>
              {loading ? 'Connecting...' : 'Setup Repository'}
            </button>
          </>
        )}
      </div>

      {/* Flash message */}
      {msg && (
        <div className={[
          'mx-[0.9rem] mb-[0.9rem] px-[0.8rem] py-2 rounded text-sm',
          msg.type === 'ok'
            ? 'bg-green-mute border border-green-dim text-green'
            : 'bg-[rgba(255,68,68,0.08)] border border-red-dim text-red',
        ].join(' ')}>
          {msg.text}
        </div>
      )}
    </div>
  )
}
