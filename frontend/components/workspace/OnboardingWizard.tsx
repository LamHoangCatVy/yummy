'use client'

import React, { useState } from 'react'
import { api } from '@/lib/api'
import type { SystemStatus } from '@/lib/types'

type Provider = 'gemini' | 'openai' | 'bedrock' | 'copilot' | 'ollama'
type Step = 'provider' | 'repo' | 'scan'

interface OnboardingWizardProps {
  status: SystemStatus | null
  onComplete: () => void
  onScanStart: () => void
}

// ── Model catalogs (April 2026) ──────────────────────────────────────────────

interface ModelOption {
  id: string
  label: string
  tag?: string   // e.g. "Recommended", "Fast", "Reasoning", "Budget"
}

const GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',           tag: 'Best quality' },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash',         tag: 'Recommended' },
  { id: 'gemini-2.5-flash-lite',     label: 'Gemini 2.5 Flash-Lite',    tag: 'Budget · Fast' },
  { id: 'gemini-3.1-flash-preview',  label: 'Gemini 3.1 Flash Preview', tag: 'Latest' },
]

const OPENAI_MODELS: ModelOption[] = [
  { id: 'gpt-5.2',       label: 'GPT-5.2',        tag: 'Flagship' },
  { id: 'gpt-5.1',       label: 'GPT-5.1',        tag: 'Recommended' },
  { id: 'gpt-5',         label: 'GPT-5',           tag: 'Stable' },
  { id: 'gpt-5-mini',    label: 'GPT-5 Mini',      tag: 'Fast · Budget' },
  { id: 'gpt-5-nano',    label: 'GPT-5 Nano',      tag: 'Cheapest' },
  { id: 'gpt-4.1',       label: 'GPT-4.1',         tag: '1M ctx · Long docs' },
  { id: 'gpt-4.1-mini',  label: 'GPT-4.1 Mini',    tag: '1M ctx · Budget' },
  { id: 'gpt-4.1-nano',  label: 'GPT-4.1 Nano',    tag: '1M ctx · Cheapest' },
  { id: 'gpt-4o',        label: 'GPT-4o',           tag: 'Legacy' },
  { id: 'o3',            label: 'o3',               tag: 'Reasoning' },
  { id: 'o3-mini',       label: 'o3 Mini',          tag: 'Reasoning · Budget' },
  { id: 'o4-mini',       label: 'o4 Mini',          tag: 'Reasoning · Latest' },
  { id: 'o1',            label: 'o1',               tag: 'Deep reasoning' },
]

const BEDROCK_MODELS: ModelOption[] = [
  // Anthropic Claude
  { id: 'anthropic.claude-opus-4-6-v1:0',              label: 'Claude Opus 4.6',          tag: 'Best quality' },
  { id: 'anthropic.claude-sonnet-4-5-v1:0',            label: 'Claude Sonnet 4.5',        tag: 'Recommended' },
  { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',   label: 'Claude 3.5 Sonnet v2',     tag: 'Stable' },
  { id: 'anthropic.claude-3-5-haiku-20241022-v1:0',    label: 'Claude 3.5 Haiku',         tag: 'Fast · Budget' },
  { id: 'anthropic.claude-3-haiku-20240307-v1:0',      label: 'Claude 3 Haiku',           tag: 'Cheapest Claude' },
  // Amazon Nova
  { id: 'amazon.nova-premier-v1:0',  label: 'Nova Premier',  tag: '1M ctx · Top reasoning' },
  { id: 'amazon.nova-pro-v1:0',      label: 'Nova Pro',      tag: 'Agents · RAG' },
  { id: 'amazon.nova-lite-v1:0',     label: 'Nova Lite',     tag: 'Multimodal · Budget' },
  { id: 'amazon.nova-micro-v1:0',    label: 'Nova Micro',    tag: 'Cheapest' },
  // Meta Llama
  { id: 'meta.llama4-maverick-17b-instruct-v1:0', label: 'Llama 4 Maverick 17B', tag: 'Open · Fast' },
  { id: 'meta.llama4-scout-17b-instruct-v1:0',    label: 'Llama 4 Scout 17B',    tag: 'Open · Budget' },
  { id: 'meta.llama3-70b-instruct-v1:0',          label: 'Llama 3 70B',          tag: 'Open · Stable' },
  // Mistral
  { id: 'mistral.mistral-large-2-v1:0', label: 'Mistral Large 2', tag: 'EU · Strong coding' },
]

const COPILOT_MODELS: ModelOption[] = [
  { id: 'gpt-5.1',              label: 'GPT-5.1',              tag: 'Recommended' },
  { id: 'gpt-5',                label: 'GPT-5',                tag: 'Flagship' },
  { id: 'gpt-5-codex',          label: 'GPT-5 Codex',          tag: 'Coding optimized' },
  { id: 'gpt-4o',               label: 'GPT-4o',               tag: 'Stable' },
  { id: 'claude-opus-4-6',      label: 'Claude Opus 4.6',      tag: 'Best reasoning' },
  { id: 'claude-sonnet-4-5',    label: 'Claude Sonnet 4.5',    tag: 'Fast · Smart' },
  { id: 'o3-mini',              label: 'o3 Mini',              tag: 'Reasoning' },
  { id: 'o4-mini',              label: 'o4 Mini',              tag: 'Reasoning · Latest' },
  { id: 'gemini-2.5-pro',       label: 'Gemini 2.5 Pro',       tag: 'Google' },
]

const PROVIDER_DEFAULT_MODELS: Record<Provider, string> = {
  gemini:  'gemini-2.5-flash',
  openai:  'gpt-5.1',
  bedrock: 'anthropic.claude-sonnet-4-5-v1:0',
  copilot: 'gpt-5.1',
  ollama:  'llama3',
}

// ── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: 'gemini' as Provider,
    icon: '✦', label: 'Google Gemini', sub: 'Free tier · Gemini 2.5 / 3.x',
    color: 'var(--green)', border: 'var(--green-dim)', bg: 'var(--green-mute)',
  },
  {
    id: 'openai' as Provider,
    icon: '◈', label: 'OpenAI', sub: 'GPT-5.x, GPT-4.1, o3, o4-mini',
    color: '#10b981', border: 'rgba(16,185,129,.4)', bg: 'rgba(16,185,129,.1)',
  },
  {
    id: 'ollama' as Provider,
    icon: '⬡', label: 'Ollama (Local)', sub: 'Free · Runs on your machine',
    color: 'var(--amber)', border: 'var(--amber-dim)', bg: 'rgba(255,179,0,.1)',
  },
  {
    id: 'copilot' as Provider,
    icon: '⊕', label: 'GitHub Copilot', sub: 'GPT-5, Claude, Gemini & more',
    color: '#64a0ff', border: 'rgba(100,160,255,.4)', bg: 'rgba(100,160,255,.1)',
  },
  {
    id: 'bedrock' as Provider,
    icon: '⬟', label: 'AWS Bedrock', sub: 'Claude, Nova, Llama, Mistral',
    color: '#fb923c', border: 'rgba(251,146,60,.4)', bg: 'rgba(251,146,60,.1)',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'text-sm rounded px-3 py-2 font-mono w-full outline-none'
const inputStyle = (caret = 'var(--green)'): React.CSSProperties => ({
  background: 'var(--bg-2)', border: '1px solid var(--border-2)',
  color: 'var(--text)', caretColor: caret,
})
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-2)', border: '1px solid var(--border-2)',
  color: 'var(--text)', cursor: 'pointer',
}

function ModelSelect({
  models, value, onChange, color,
}: {
  models: ModelOption[]
  value: string
  onChange: (v: string) => void
  color: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Model</span>
      <select
        className="text-sm rounded px-3 py-2 font-mono w-full outline-none"
        style={{ ...selectStyle, caretColor: color }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {models.map(m => (
          <option key={m.id} value={m.id}>
            {m.label}{m.tag ? `  —  ${m.tag}` : ''}
          </option>
        ))}
      </select>
      <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
        {models.find(m => m.id === value)?.tag ?? ''}
      </p>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete, onScanStart }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('provider')
  const [provider, setProvider] = useState<Provider>('gemini')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Credentials
  const [geminiKey, setGeminiKey]         = useState('')
  const [geminiModel, setGeminiModel]     = useState(PROVIDER_DEFAULT_MODELS.gemini)
  const [openaiKey, setOpenaiKey]         = useState('')
  const [openaiModel, setOpenaiModel]     = useState(PROVIDER_DEFAULT_MODELS.openai)
  const [ollamaUrl, setOllamaUrl]         = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel]     = useState('llama3')
  const [copilotToken, setCopilotToken]   = useState('')
  const [copilotModel, setCopilotModel]   = useState(PROVIDER_DEFAULT_MODELS.copilot)
  const [bedrockAccess, setBedrockAccess] = useState('')
  const [bedrockSecret, setBedrockSecret] = useState('')
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1')
  const [bedrockModel, setBedrockModel]   = useState(PROVIDER_DEFAULT_MODELS.bedrock)

  // Repo
  const [repoUrl, setRepoUrl]         = useState('')
  const [githubToken, setGithubToken] = useState('')

  const meta = PROVIDERS.find(p => p.id === provider)!

  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    setError('')
  }

  // ── Step 1: Save provider ────────────────────────────────────────────────
  const saveProvider = async () => {
    setSaving(true); setError('')
    try {
      switch (provider) {
        case 'gemini':
          if (!geminiKey) throw new Error('Gemini API key is required.')
          await api.config.setGeminiKey(geminiKey, geminiModel)
          break
        case 'openai':
          if (!openaiKey) throw new Error('OpenAI API key is required.')
          await api.config.setOpenAI(openaiKey, openaiModel)
          break
        case 'ollama':
          await api.config.setOllama(ollamaUrl, ollamaModel)
          break
        case 'copilot':
          if (!copilotToken) throw new Error('GitHub token is required.')
          await api.config.setCopilot(copilotToken, copilotModel)
          break
        case 'bedrock':
          if (!bedrockAccess || !bedrockSecret) throw new Error('AWS Access Key and Secret Key are required.')
          await api.config.setBedrock(bedrockAccess, bedrockSecret, bedrockRegion, bedrockModel)
          break
      }
      await api.config.setProvider(provider)
      setStep('repo')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2: Save repo ────────────────────────────────────────────────────
  const saveRepo = async () => {
    setSaving(true); setError('')
    try {
      if (!repoUrl) throw new Error('GitHub repo URL is required.')
      await api.config.setup(repoUrl, githubToken, 10000)
      setStep('scan')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3: Start scan ───────────────────────────────────────────────────
  const startScan = async () => {
    setSaving(true); setError('')
    try {
      await api.kb.scan()
      onScanStart()
      onComplete()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  const STEPS = ['provider', 'repo', 'scan'] as const
  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-2xl border w-full max-w-lg mx-4 overflow-hidden"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-display font-extrabold text-2xl" style={{ color: 'var(--green)' }}>YUMMY</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Setup Wizard</span>
          </div>
          <div className="flex items-center gap-2">
            {(['provider', 'repo', 'scan'] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold"
                    style={{
                      background: i < stepIdx ? 'var(--green)' : i === stepIdx ? meta.bg : 'var(--bg-2)',
                      color: i < stepIdx ? 'var(--bg)' : i === stepIdx ? meta.color : 'var(--text-3)',
                      border: `1px solid ${i === stepIdx ? meta.border : 'var(--border)'}`,
                    }}>
                    {i < stepIdx ? '✓' : i + 1}
                  </div>
                  <span className="text-2xs uppercase tracking-wide"
                    style={{ color: i === stepIdx ? meta.color : 'var(--text-3)' }}>
                    {s === 'provider' ? 'AI Provider' : s === 'repo' ? 'GitHub Repo' : 'Scan'}
                  </span>
                </div>
                {i < 2 && <div className="flex-1 h-px" style={{ background: i < stepIdx ? 'var(--green-dim)' : 'var(--border)' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

          {/* ── Step 1: Provider ── */}
          {step === 'provider' && (
            <>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Choose your AI provider</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>You can change this anytime in Settings.</p>
              </div>

              {/* Provider grid */}
              <div className="grid grid-cols-1 gap-2">
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => handleProviderChange(p.id)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left cursor-pointer transition-all border"
                    style={{
                      background: provider === p.id ? p.bg : 'var(--bg-2)',
                      borderColor: provider === p.id ? p.border : 'var(--border)',
                    }}>
                    <span className="text-lg flex-shrink-0" style={{ color: p.color }}>{p.icon}</span>
                    <div>
                      <div className="text-sm font-bold" style={{ color: provider === p.id ? p.color : 'var(--text)' }}>{p.label}</div>
                      <div className="text-2xs" style={{ color: 'var(--text-3)' }}>{p.sub}</div>
                    </div>
                    {provider === p.id && <span className="ml-auto text-xs" style={{ color: p.color }}>●</span>}
                  </button>
                ))}
              </div>

              {/* Credential + model fields */}
              <div className="flex flex-col gap-3 pt-1">

                {provider === 'gemini' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        API Key — <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                          style={{ color: 'var(--green)' }}>Get one free →</a>
                      </span>
                      <input type="password" autoComplete="new-password" className={inputCls}
                        style={inputStyle('var(--green)')} value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)} placeholder="AIza..." />
                    </label>
                    <ModelSelect models={GEMINI_MODELS} value={geminiModel} onChange={setGeminiModel} color="var(--green)" />
                  </>
                )}

                {provider === 'openai' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        API Key — <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
                          style={{ color: '#10b981' }}>platform.openai.com →</a>
                      </span>
                      <input type="password" autoComplete="new-password" className={inputCls}
                        style={inputStyle('#10b981')} value={openaiKey}
                        onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
                    </label>
                    <ModelSelect models={OPENAI_MODELS} value={openaiModel} onChange={setOpenaiModel} color="#10b981" />
                  </>
                )}

                {provider === 'ollama' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Base URL</span>
                      <input className={inputCls} style={inputStyle('var(--amber)')}
                        value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Model name (from <code style={{ color: 'var(--amber)' }}>ollama list</code>)</span>
                      <input className={inputCls} style={inputStyle('var(--amber)')}
                        value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
                        placeholder="llama3 / codellama / deepseek-coder / mistral" />
                    </label>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      Run <code style={{ color: 'var(--amber)' }}>ollama serve</code> first, then <code style={{ color: 'var(--amber)' }}>ollama pull &lt;model&gt;</code>.
                    </p>
                  </>
                )}

                {provider === 'copilot' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>GitHub Token (needs <code>copilot</code> scope)</span>
                      <input type="password" autoComplete="new-password" className={inputCls}
                        style={inputStyle('#64a0ff')} value={copilotToken}
                        onChange={e => setCopilotToken(e.target.value)} placeholder="ghp_..." />
                    </label>
                    <ModelSelect models={COPILOT_MODELS} value={copilotModel} onChange={setCopilotModel} color="#64a0ff" />
                  </>
                )}

                {provider === 'bedrock' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Access Key ID</span>
                      <input type="password" autoComplete="new-password" className={inputCls}
                        style={inputStyle('#fb923c')} value={bedrockAccess}
                        onChange={e => setBedrockAccess(e.target.value)} placeholder="AKIA..." />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Secret Access Key</span>
                      <input type="password" autoComplete="new-password" className={inputCls}
                        style={inputStyle('#fb923c')} value={bedrockSecret}
                        onChange={e => setBedrockSecret(e.target.value)} placeholder="••••••••" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Region</span>
                      <select className="text-sm rounded px-3 py-2 font-mono w-full outline-none"
                        style={selectStyle} value={bedrockRegion} onChange={e => setBedrockRegion(e.target.value)}>
                        <option value="us-east-1">us-east-1</option>
                        <option value="us-west-2">us-west-2</option>
                        <option value="eu-west-1">eu-west-1</option>
                        <option value="ap-southeast-1">ap-southeast-1</option>
                        <option value="ap-northeast-1">ap-northeast-1</option>
                      </select>
                    </label>
                    <ModelSelect models={BEDROCK_MODELS} value={bedrockModel} onChange={setBedrockModel} color="#fb923c" />
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Step 2: Repo ── */}
          {step === 'repo' && (
            <>
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Connect your GitHub repo</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>YUMMY will scan and index the codebase so the AI can answer questions about it.</p>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>Repository URL</span>
                <input className={inputCls} style={inputStyle()}
                  value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  GitHub Token <span style={{ color: 'var(--text-3)', fontWeight: 'normal' }}>(optional — only needed for private repos)</span>
                </span>
                <input type="password" autoComplete="new-password" className={inputCls}
                  style={inputStyle()} value={githubToken}
                  onChange={e => setGithubToken(e.target.value)} placeholder="ghp_... (leave blank for public repos)" />
              </label>
            </>
          )}

          {/* ── Step 3: Scan ── */}
          {step === 'scan' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="text-5xl">🔍</div>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Ready to scan</p>
              <p className="text-xs max-w-xs" style={{ color: 'var(--text-3)' }}>
                YUMMY will fetch your repo, read every file, and use AI to build a knowledge base.
                This takes 1–5 minutes depending on repo size.
              </p>
              <div className="border rounded-lg px-4 py-2 text-xs font-mono"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', color: 'var(--green)' }}>
                {repoUrl}
              </div>
              <div className="text-xs px-3 py-1.5 rounded border"
                style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}>
                {meta.icon} {meta.label} · {
                  provider === 'gemini' ? geminiModel
                  : provider === 'openai' ? openaiModel
                  : provider === 'copilot' ? copilotModel
                  : provider === 'bedrock' ? BEDROCK_MODELS.find(m => m.id === bedrockModel)?.label ?? bedrockModel
                  : ollamaModel
                }
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs px-3 py-2 rounded border"
              style={{ color: 'var(--red)', background: 'rgba(255,68,68,.08)', borderColor: 'rgba(255,68,68,.2)' }}>
              ✕ {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {step !== 'provider' && (
              <button onClick={() => { setStep(step === 'scan' ? 'repo' : 'provider'); setError('') }}
                className="border rounded-lg cursor-pointer font-mono text-sm px-4 py-2"
                style={{ background: 'none', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                ← Back
              </button>
            )}
            <button
              onClick={step === 'provider' ? saveProvider : step === 'repo' ? saveRepo : startScan}
              disabled={saving}
              className="flex-1 rounded-lg cursor-pointer font-bold text-sm py-2.5 transition-all"
              style={{
                background: meta.bg, color: meta.color,
                border: `1px solid ${meta.border}`,
                opacity: saving ? .6 : 1,
              }}>
              {saving ? '⟳ Saving...' : step === 'provider' ? 'Continue →' : step === 'repo' ? 'Continue →' : '🔍 Start Scan'}
            </button>
          </div>

          {step === 'scan' && (
            <button onClick={onComplete}
              className="text-xs text-center cursor-pointer bg-transparent border-none"
              style={{ color: 'var(--text-3)' }}>
              Skip for now — I'll run /scan manually later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
