'use client'

import React, { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { SystemStatus, KeySource } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

type Provider = 'gemini' | 'ollama' | 'copilot' | 'openai' | 'bedrock'

interface SettingsPanelProps {
  status: SystemStatus | null
  onStatusRefresh: () => Promise<void>
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: { id: Provider; icon: string; label: string; color: string; border: string; bg: string }[] = [
  { id: 'gemini',  icon: '✦', label: 'Google Gemini',  color: 'var(--green)',  border: 'var(--green-dim)',        bg: 'var(--green-mute)' },
  { id: 'openai',  icon: '◈', label: 'OpenAI',         color: '#10b981',       border: 'rgba(16,185,129,.4)',     bg: 'rgba(16,185,129,.1)' },
  { id: 'bedrock', icon: '⬟', label: 'AWS Bedrock',    color: '#fb923c',       border: 'rgba(251,146,60,.4)',     bg: 'rgba(251,146,60,.1)' },
  { id: 'copilot', icon: '⊕', label: 'GitHub Copilot', color: '#64a0ff',       border: 'rgba(100,160,255,.4)',    bg: 'rgba(100,160,255,.1)' },
  { id: 'ollama',  icon: '⬡', label: 'Ollama (Local)', color: 'var(--amber)',  border: 'var(--amber-dim)',        bg: 'rgba(255,179,0,.1)' },
]

// ─── Small shared primitives ──────────────────────────────────────────────────

const inputCls = 'text-xs rounded px-2 py-1.5 font-mono w-full outline-none'
const inputStyle = (caret = 'var(--green)'): React.CSSProperties => ({
  background: 'var(--bg-2)', border: '1px solid var(--border-2)',
  color: 'var(--text)', caretColor: caret,
})
const selectStyle: React.CSSProperties = {
  background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{children}</span>
}

/** Shows whether a credential was loaded from ENV or set via the UI. */
function KeySourceBadge({ source }: { source: KeySource }) {
  if (source === 'none') return null
  return (
    <span
      className="text-2xs px-1.5 py-px rounded font-bold"
      style={
        source === 'env'
          ? { background: 'rgba(0,170,255,.12)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)' }
          : { background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }
      }
    >
      {source === 'env' ? '⬡ from ENV' : '✓ saved'}
    </span>
  )
}

/** Hint shown when a key is already loaded from the environment. */
function EnvHint({ varName }: { varName: string }) {
  return (
    <p className="text-2xs" style={{ color: '#00aaff' }}>
      ⬡ Loaded from{' '}
      <code className="px-1 rounded" style={{ background: 'rgba(0,170,255,.1)', color: '#00aaff' }}>
        {varName}
      </code>{' '}
      — leave blank to keep it, or paste a new key to override.
    </p>
  )
}

// ─── Provider forms ───────────────────────────────────────────────────────────

function GeminiForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState(status?.gemini_model ?? '')
  const fromEnv = status?.gemini_key_source === 'env'
  const hasKey  = status?.has_gemini_key

  return (
    <div className="flex flex-col gap-3">
      {fromEnv && <EnvHint varName="GEMINI_API_KEY" />}
      <label className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FieldLabel>API Key</FieldLabel>
          <KeySourceBadge source={status?.gemini_key_source ?? 'none'} />
        </div>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('var(--green)')}
          value={key} onChange={e => setKey(e.target.value)}
          placeholder={hasKey ? '••••••••  (set — leave blank to keep)' : 'AIza...'}
        />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Model</FieldLabel>
        <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={selectStyle}
          value={model} onChange={e => setModel(e.target.value)}>
          <option value="gemini-2.5-flash">gemini-2.5-flash — Recommended</option>
          <option value="gemini-2.5-pro">gemini-2.5-pro — Best quality</option>
          <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite — Budget · Fast</option>
          <option value="gemini-3.1-flash-preview">gemini-3.1-flash-preview — Latest</option>
        </select>
      </label>
      <SaveButton
        color="var(--green)" bg="var(--green-mute)" border="var(--green-dim)"
        disabled={!key && !hasKey} saving={saving}
        onClick={() => onSave(async () => {
          if (key) await api.config.setGeminiKey(key, model || undefined)
          else if (model) await api.config.setGeminiKey('', model)
          await api.config.setProvider('gemini')
        })}
      />
    </div>
  )
}

function OpenAIForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState(status?.openai_model ?? '')
  const fromEnv = status?.openai_key_source === 'env'
  const hasKey  = status?.has_openai_key

  return (
    <div className="flex flex-col gap-3">
      {fromEnv && <EnvHint varName="OPENAI_API_KEY" />}
      <label className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FieldLabel>API Key</FieldLabel>
          <KeySourceBadge source={status?.openai_key_source ?? 'none'} />
        </div>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('#10b981')}
          value={key} onChange={e => setKey(e.target.value)}
          placeholder={hasKey ? '••••••••  (set — leave blank to keep)' : 'sk-...'}
        />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Model</FieldLabel>
        <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={selectStyle}
          value={model} onChange={e => setModel(e.target.value)}>
          <optgroup label="GPT-5 family">
            <option value="gpt-5.2">gpt-5.2 — Flagship</option>
            <option value="gpt-5.1">gpt-5.1 — Recommended</option>
            <option value="gpt-5">gpt-5 — Stable</option>
            <option value="gpt-5-mini">gpt-5-mini — Fast · Budget</option>
            <option value="gpt-5-nano">gpt-5-nano — Cheapest</option>
          </optgroup>
          <optgroup label="GPT-4.1 (long context)">
            <option value="gpt-4.1">gpt-4.1 — 1M ctx</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini — 1M ctx · Budget</option>
            <option value="gpt-4.1-nano">gpt-4.1-nano — 1M ctx · Cheapest</option>
          </optgroup>
          <optgroup label="Reasoning (o-series)">
            <option value="o4-mini">o4-mini — Latest reasoning</option>
            <option value="o3">o3 — Reasoning</option>
            <option value="o3-mini">o3-mini — Reasoning · Budget</option>
            <option value="o1">o1 — Deep reasoning</option>
          </optgroup>
          <optgroup label="Legacy">
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
          </optgroup>
        </select>
      </label>
      <SaveButton
        color="#10b981" bg="rgba(16,185,129,.1)" border="rgba(16,185,129,.35)"
        disabled={!key && !hasKey} saving={saving}
        onClick={() => onSave(async () => {
          if (key) await api.config.setOpenAI(key, model || undefined)
          await api.config.setProvider('openai')
        })}
      />
    </div>
  )
}

function BedrockForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [access, setAccess] = useState('')
  const [secret, setSecret] = useState('')
  const [region, setRegion] = useState(status?.bedrock_region ?? 'us-east-1')
  const [model,  setModel]  = useState(status?.bedrock_model ?? '')
  const fromEnv = status?.bedrock_key_source === 'env'
  const hasKey  = status?.has_bedrock_key

  return (
    <div className="flex flex-col gap-3">
      {fromEnv && <EnvHint varName="AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY" />}
      <label className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FieldLabel>Access Key ID</FieldLabel>
          <KeySourceBadge source={status?.bedrock_key_source ?? 'none'} />
        </div>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('#fb923c')}
          value={access} onChange={e => setAccess(e.target.value)}
          placeholder={hasKey ? '••••••••  (set — leave blank to keep)' : 'AKIA...'}
        />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Secret Access Key</FieldLabel>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('#fb923c')}
          value={secret} onChange={e => setSecret(e.target.value)}
          placeholder={hasKey ? '••••••••  (set — leave blank to keep)' : ''}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <FieldLabel>Region</FieldLabel>
          <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={selectStyle}
            value={region} onChange={e => setRegion(e.target.value)}>
            <option value="us-east-1">us-east-1</option>
            <option value="us-west-2">us-west-2</option>
            <option value="eu-west-1">eu-west-1</option>
            <option value="ap-southeast-1">ap-southeast-1</option>
            <option value="ap-northeast-1">ap-northeast-1</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Model</FieldLabel>
          <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={selectStyle}
            value={model} onChange={e => setModel(e.target.value)}>
            <optgroup label="Anthropic Claude">
              <option value="anthropic.claude-opus-4-6-v1:0">claude-opus-4-6 — Best quality</option>
              <option value="anthropic.claude-sonnet-4-5-v1:0">claude-sonnet-4-5 — Recommended</option>
              <option value="anthropic.claude-3-5-sonnet-20241022-v2:0">claude-3-5-sonnet-v2 — Stable</option>
              <option value="anthropic.claude-3-5-haiku-20241022-v1:0">claude-3-5-haiku — Fast · Budget</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">claude-3-haiku — Cheapest</option>
            </optgroup>
            <optgroup label="Amazon Nova">
              <option value="amazon.nova-premier-v1:0">nova-premier — 1M ctx · Top reasoning</option>
              <option value="amazon.nova-pro-v1:0">nova-pro — Agents · RAG</option>
              <option value="amazon.nova-lite-v1:0">nova-lite — Multimodal · Budget</option>
              <option value="amazon.nova-micro-v1:0">nova-micro — Cheapest</option>
            </optgroup>
            <optgroup label="Meta Llama">
              <option value="meta.llama4-maverick-17b-instruct-v1:0">llama4-maverick-17b — Fast</option>
              <option value="meta.llama4-scout-17b-instruct-v1:0">llama4-scout-17b — Budget</option>
              <option value="meta.llama3-70b-instruct-v1:0">llama3-70b — Stable</option>
            </optgroup>
            <optgroup label="Mistral">
              <option value="mistral.mistral-large-2-v1:0">mistral-large-2 — Strong coding</option>
            </optgroup>
          </select>
        </label>
      </div>
      <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
        IAM user needs{' '}
        <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: '#fb923c' }}>bedrock:InvokeModel</code>{' '}
        permission. Enable model access in the AWS console first.
      </p>
      <SaveButton
        color="#fb923c" bg="rgba(251,146,60,.1)" border="rgba(251,146,60,.35)"
        disabled={(!access || !secret) && !hasKey} saving={saving}
        onClick={() => onSave(async () => {
          if (access && secret) await api.config.setBedrock(access, secret, region, model || undefined)
          else if (model) await api.config.setBedrock('', '', region, model)
          await api.config.setProvider('bedrock')
        })}
      />
    </div>
  )
}

function CopilotForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [token, setToken] = useState('')
  const [model, setModel] = useState(status?.copilot_model ?? '')
  const fromEnv = status?.copilot_key_source === 'env'
  const hasKey  = status?.has_copilot_token

  return (
    <div className="flex flex-col gap-3">
      {fromEnv && <EnvHint varName="COPILOT_GITHUB_TOKEN" />}
      <label className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FieldLabel>GitHub Token</FieldLabel>
          <KeySourceBadge source={status?.copilot_key_source ?? 'none'} />
        </div>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('#64a0ff')}
          value={token} onChange={e => setToken(e.target.value)}
          placeholder={hasKey ? '••••••••  (set — leave blank to keep)' : 'ghp_... or gho_...'}
        />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Model</FieldLabel>
        <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={selectStyle}
          value={model} onChange={e => setModel(e.target.value)}>
          <option value="gpt-5.1">gpt-5.1 — Recommended</option>
          <option value="gpt-5">gpt-5 — Flagship</option>
          <option value="gpt-5-codex">gpt-5-codex — Coding optimized</option>
          <option value="gpt-4o">gpt-4o — Stable</option>
          <option value="claude-opus-4-6">claude-opus-4-6 — Best reasoning</option>
          <option value="claude-sonnet-4-5">claude-sonnet-4-5 — Fast · Smart</option>
          <option value="o3-mini">o3-mini — Reasoning</option>
          <option value="o4-mini">o4-mini — Reasoning · Latest</option>
          <option value="gemini-2.5-pro">gemini-2.5-pro — Google</option>
        </select>
      </label>
      <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
        Requires an active GitHub Copilot subscription. Token needs{' '}
        <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: '#64a0ff' }}>copilot</code> scope.
      </p>
      <SaveButton
        color="#64a0ff" bg="rgba(100,160,255,.1)" border="rgba(100,160,255,.35)"
        disabled={!token && !hasKey} saving={saving}
        onClick={() => onSave(async () => {
          if (token) await api.config.setCopilot(token, model || undefined)
          await api.config.setProvider('copilot')
        })}
      />
    </div>
  )
}

function OllamaForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [url,   setUrl]   = useState(status?.ollama_url ?? '')
  const [model, setModel] = useState(status?.ollama_model ?? '')

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <FieldLabel>Base URL</FieldLabel>
        <input className={inputCls} style={inputStyle('var(--amber)')}
          value={url} onChange={e => setUrl(e.target.value)}
          placeholder="http://localhost:11434" />
      </label>
      <label className="flex flex-col gap-1">
        <FieldLabel>Model</FieldLabel>
        <input className={inputCls} style={inputStyle('var(--amber)')}
          value={model} onChange={e => setModel(e.target.value)}
          placeholder="llama3 / codellama / deepseek-coder" />
      </label>
      <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
        Run{' '}
        <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>ollama serve</code>
        {' '}&amp; pull a model first. No API key needed.
      </p>
      <SaveButton
        color="var(--amber)" bg="rgba(255,179,0,.1)" border="var(--amber-dim)"
        disabled={false} saving={saving}
        onClick={() => onSave(async () => {
          await api.config.setOllama(url || 'http://localhost:11434', model || 'llama3')
          await api.config.setProvider('ollama')
        })}
      />
    </div>
  )
}

// ─── GitHub Token form (separate concern from AI provider) ───────────────────

function GitHubForm({ status, onSave, saving }: { status: SystemStatus | null; onSave: (fn: () => Promise<void>) => void; saving: boolean }) {
  const [token, setToken] = useState('')
  const hasToken = status?.has_github_token

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FieldLabel>Personal Access Token</FieldLabel>
          {hasToken && <KeySourceBadge source="ui" />}
        </div>
        <input
          type="password" autoComplete="new-password" className={inputCls}
          style={inputStyle('#00aaff')}
          value={token} onChange={e => setToken(e.target.value)}
          placeholder={hasToken ? '••••••••  (set — leave blank to keep)' : 'ghp_...'}
        />
      </label>
      <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
        Required for private repos. Needs{' '}
        <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>Contents: Read</code> scope.
      </p>
      {!status?.repo && (
        <p className="text-2xs" style={{ color: 'var(--amber)' }}>
          ⚠ Run <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>/setup</code> first to configure a repo.
        </p>
      )}
      <SaveButton
        color="#00aaff" bg="rgba(0,170,255,.08)" border="rgba(0,170,255,.3)"
        disabled={!token} saving={saving}
        onClick={() => onSave(async () => {
          await api.config.setup(
            status?.repo ? `https://github.com/${status.repo.owner}/${status.repo.repo}` : '',
            token, 10000
          )
        })}
      />
    </div>
  )
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ color, bg, border, disabled, saving, onClick }: {
  color: string; bg: string; border: string
  disabled: boolean; saving: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="w-full py-2 rounded text-xs font-bold cursor-pointer transition-all"
      style={{ background: bg, color, border: `1px solid ${border}`, opacity: (saving || disabled) ? .45 : 1 }}
    >
      {saving ? '⟳ Saving...' : '✓ Save & Activate'}
    </button>
  )
}

export default function SettingsPanel({ status, onStatusRefresh }: SettingsPanelProps) {
  const [activeProvider, setActiveProvider] = useState<Provider>(
    (status?.ai_provider as Provider) ?? 'gemini'
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Keep dropdown in sync when status loads for the first time
  useEffect(() => {
    if (status?.ai_provider) setActiveProvider(status.ai_provider as Provider)
  }, [status?.ai_provider])

  const handleSave = async (fn: () => Promise<void>) => {
    setSaving(true); setMsg(null)
    try {
      await fn()
      await onStatusRefresh()
      setMsg({ ok: true, text: `${activeProvider} activated.` })
    } catch (e: any) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const meta = PROVIDERS.find(p => p.id === activeProvider)!

  return (
    <div className="flex flex-col h-full">

      {/* ── Status bar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Active</span>
        <span className="text-2xs font-bold px-2 py-0.5 rounded"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
          {meta.icon} {status?.ai_provider?.toUpperCase() ?? '—'}
        </span>
        {msg && (
          <span className="text-2xs px-2 py-0.5 rounded"
            style={{
              color: msg.ok ? 'var(--green)' : 'var(--red)',
              background: msg.ok ? 'var(--green-mute)' : 'rgba(255,68,68,.1)',
              border: `1px solid ${msg.ok ? 'var(--green-dim)' : 'var(--red-dim)'}`,
            }}>
            {msg.ok ? '✓' : '✕'} {msg.text}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-3 overflow-auto flex-1">

        {/* ── Provider picker ── */}
        <div className="flex flex-col gap-1.5">
          <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>AI Provider</span>
          <select
            value={activeProvider}
            onChange={e => { setActiveProvider(e.target.value as Provider); setMsg(null) }}
            className="cursor-pointer text-sm rounded px-3 py-2 font-mono w-full outline-none font-bold"
            style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id} style={{ background: 'var(--bg-2)', color: 'var(--text)' }}>
                {p.icon}  {p.label}
              </option>
            ))}
          </select>
          <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
            Fill in the credentials below, then click <strong style={{ color: 'var(--text-2)' }}>Save &amp; Activate</strong> — this sets the key and switches the active provider in one step.
          </p>
        </div>

        {/* ── Active provider form ── */}
        <section className="rounded-lg border overflow-hidden"
          style={{ borderColor: meta.border }}>
          <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: meta.color }}>
            {meta.icon} {meta.label}
          </div>
          <div className="p-3" style={{ background: 'var(--bg-1)' }}>
            {activeProvider === 'gemini'  && <GeminiForm  status={status} onSave={handleSave} saving={saving} />}
            {activeProvider === 'openai'  && <OpenAIForm  status={status} onSave={handleSave} saving={saving} />}
            {activeProvider === 'bedrock' && <BedrockForm status={status} onSave={handleSave} saving={saving} />}
            {activeProvider === 'copilot' && <CopilotForm status={status} onSave={handleSave} saving={saving} />}
            {activeProvider === 'ollama'  && <OllamaForm  status={status} onSave={handleSave} saving={saving} />}
          </div>
        </section>

        {/* ── GitHub Token (always visible, separate from AI provider) ── */}
        <section className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            ⬡ GitHub Token
            {status?.has_github_token && (
              <span className="text-2xs px-1.5 rounded"
                style={{ background: 'rgba(0,170,255,.1)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)' }}>
                set
              </span>
            )}
          </div>
          <div className="p-3" style={{ background: 'var(--bg-1)' }}>
            <GitHubForm status={status} onSave={handleSave} saving={saving} />
          </div>
        </section>

      </div>
    </div>
  )
}
