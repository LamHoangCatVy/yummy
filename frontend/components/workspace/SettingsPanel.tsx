'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { SystemStatus } from '@/lib/types'

interface Props {
  status: SystemStatus | null
  onStatusRefresh: () => Promise<void>
}

const inputCls = 'text-xs rounded px-2 py-1.5 font-mono w-full outline-none'
const inp = (caret = '#fb923c'): React.CSSProperties => ({
  background: 'var(--bg-2)', border: '1px solid var(--border-2)',
  color: 'var(--text)', caretColor: caret,
})
const sel: React.CSSProperties = {
  background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text)',
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-2xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{children}</span>
}

function Badge({ set, fromEnv }: { set: boolean; fromEnv: boolean }) {
  if (!set) return null
  return (
    <span className="text-2xs px-1.5 py-px rounded font-bold"
      style={fromEnv
        ? { background: 'rgba(0,170,255,.12)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)' }
        : { background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
      {fromEnv ? '⬡ ENV' : '✓ saved'}
    </span>
  )
}

export default function SettingsPanel({ status, onStatusRefresh }: Props) {
  // Bedrock fields
  const [access, setAccess] = useState('')
  const [secret, setSecret] = useState('')
  const [region, setRegion] = useState(status?.bedrock_region ?? 'us-east-1')
  const [model,  setModel]  = useState(status?.bedrock_model  ?? 'amazon.nova-micro-v1:0')

  // GitHub token
  const [ghToken, setGhToken] = useState('')

  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey   = !!status?.has_bedrock_key
  const fromEnv  = status?.bedrock_key_source === 'env'
  const hasGh    = !!status?.has_github_token

  useEffect(() => {
    if (status?.bedrock_region) setRegion(status.bedrock_region)
    if (status?.bedrock_model)  setModel(status.bedrock_model)
  }, [status?.bedrock_region, status?.bedrock_model])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      if (access && secret)
        await api.config.setBedrock(access, secret, region, model)
      else if (model || region)
        await api.config.setBedrock('', '', region, model)

      await api.config.setProvider('bedrock')

      if (ghToken)
        await api.config.setup(
          status?.repo ? `https://github.com/${status.repo.owner}/${status.repo.repo}` : '',
          ghToken, 100
        )

      await onStatusRefresh()
      setMsg({ ok: true, text: 'Saved & activated.' })
      setAccess(''); setSecret(''); setGhToken('')
    } catch (e: any) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true); setMsg(null)
    try {
      const hc = await api.health.model() as any
      if (hc.status === 'ok')
        setMsg({ ok: true, text: `✓ Connected — ${hc.model} (${hc.latency_ms}ms)` })
      else
        setMsg({ ok: false, text: hc.error || 'Connection failed' })
    } catch (e: any) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <span className="text-2xs font-bold px-2 py-0.5 rounded"
          style={{ background: 'rgba(251,146,60,.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,.4)' }}>
          ⬟ {status?.ai_provider?.toUpperCase() ?? 'BEDROCK'} · {status?.bedrock_model?.split('.').pop()?.replace(/-v\d.*/, '') ?? 'nova-micro'}
        </span>
        {msg && (
          <span className="text-2xs px-2 py-0.5 rounded"
            style={{
              color: msg.ok ? 'var(--green)' : 'var(--red)',
              background: msg.ok ? 'var(--green-mute)' : 'rgba(255,68,68,.1)',
              border: `1px solid ${msg.ok ? 'var(--green-dim)' : 'var(--red-dim)'}`,
            }}>
            {msg.text}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-3 overflow-auto flex-1">

        {/* ── AWS Bedrock ── */}
        <section className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(251,146,60,.4)' }}>
          <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: '#fb923c' }}>
            ⬟ AWS Bedrock
            <Badge set={hasKey} fromEnv={fromEnv} />
          </div>
          <div className="p-3 flex flex-col gap-3" style={{ background: 'var(--bg-1)' }}>

            {fromEnv && (
              <p className="text-2xs" style={{ color: '#00aaff' }}>
                ⬡ Credentials loaded from <code style={{ color: '#00aaff' }}>AWS_ACCESS_KEY_ID</code> env — leave blank to keep.
              </p>
            )}

            <label className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Label>Access Key ID</Label>
                <Badge set={hasKey} fromEnv={fromEnv} />
              </div>
              <input type="password" autoComplete="new-password" className={inputCls} style={inp()}
                value={access} onChange={e => setAccess(e.target.value)}
                placeholder={hasKey ? '•••• (set — leave blank to keep)' : 'AKIA...'} />
            </label>

            <label className="flex flex-col gap-1">
              <Label>Secret Access Key</Label>
              <input type="password" autoComplete="new-password" className={inputCls} style={inp()}
                value={secret} onChange={e => setSecret(e.target.value)}
                placeholder={hasKey ? '•••• (set — leave blank to keep)' : ''} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <Label>Region</Label>
                <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={sel}
                  value={region} onChange={e => setRegion(e.target.value)}>
                  <option value="us-east-1">us-east-1</option>
                  <option value="us-west-2">us-west-2</option>
                  <option value="eu-west-1">eu-west-1</option>
                  <option value="ap-southeast-1">ap-southeast-1</option>
                  <option value="ap-northeast-1">ap-northeast-1</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <Label>Model</Label>
                <select className="cursor-pointer text-xs rounded px-2 py-1.5 font-mono w-full outline-none" style={sel}
                  value={model} onChange={e => setModel(e.target.value)}>
                  <optgroup label="Amazon Nova (cheapest)">
                    <option value="amazon.nova-micro-v1:0">Nova Micro — $0.035/1M ⭐</option>
                    <option value="amazon.nova-lite-v1:0">Nova Lite — $0.06/1M</option>
                    <option value="amazon.nova-pro-v1:0">Nova Pro — $0.80/1M</option>
                    <option value="amazon.nova-premier-v1:0">Nova Premier — $2/1M</option>
                  </optgroup>
                  <optgroup label="Anthropic Claude">
                    <option value="anthropic.claude-3-5-haiku-20241022-v1:0">Claude 3.5 Haiku — $0.80/1M</option>
                    <option value="anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet — $3/1M</option>
                    <option value="anthropic.claude-sonnet-4-5-v1:0">Claude Sonnet 4.5 — $3/1M</option>
                    <option value="anthropic.claude-opus-4-6-v1:0">Claude Opus 4.6 — $15/1M</option>
                  </optgroup>
                  <optgroup label="Meta Llama">
                    <option value="meta.llama4-scout-17b-instruct-v1:0">Llama 4 Scout 17B</option>
                    <option value="meta.llama3-70b-instruct-v1:0">Llama 3 70B</option>
                  </optgroup>
                </select>
              </label>
            </div>

            <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
              IAM user cần quyền{' '}
              <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: '#fb923c' }}>
                bedrock:InvokeModel
              </code>
              {' '}và{' '}
              <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: '#fb923c' }}>
                bedrock:InvokeModelWithResponseStream
              </code>
            </p>

            <div className="flex gap-2">
              <button onClick={testConnection} disabled={testing || !hasKey}
                className="flex-1 py-1.5 rounded text-xs font-bold cursor-pointer"
                style={{ background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border-2)', opacity: (!hasKey || testing) ? .45 : 1 }}>
                {testing ? '⟳ Testing...' : '⚡ Test Connection'}
              </button>
              <button onClick={save} disabled={saving || ((!access || !secret) && !hasKey)}
                className="flex-1 py-1.5 rounded text-xs font-bold cursor-pointer"
                style={{ background: 'rgba(251,146,60,.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,.4)', opacity: (saving || ((!access || !secret) && !hasKey)) ? .45 : 1 }}>
                {saving ? '⟳ Saving...' : '✓ Save & Activate'}
              </button>
            </div>
          </div>
        </section>

        {/* ── GitHub Token ── */}
        <section className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold flex items-center gap-2"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            ⬡ GitHub Token
            {hasGh && <span className="text-2xs px-1.5 rounded"
              style={{ background: 'rgba(0,170,255,.1)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)' }}>set</span>}
          </div>
          <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--bg-1)' }}>
            <input type="password" autoComplete="new-password" className={inputCls} style={inp('#00aaff')}
              value={ghToken} onChange={e => setGhToken(e.target.value)}
              placeholder={hasGh ? '•••• (set — leave blank to keep)' : 'ghp_... (for private repos)'} />
            <p className="text-2xs" style={{ color: 'var(--text-3)' }}>
              Chỉ cần cho private repo. Cần scope{' '}
              <code className="px-1 rounded" style={{ background: 'var(--bg-3)', color: 'var(--amber)' }}>Contents: Read</code>
            </p>
            <button onClick={save} disabled={saving || !ghToken}
              className="w-full py-1.5 rounded text-xs font-bold cursor-pointer"
              style={{ background: 'rgba(0,170,255,.08)', color: '#00aaff', border: '1px solid rgba(0,170,255,.3)', opacity: (saving || !ghToken) ? .45 : 1 }}>
              {saving ? '⟳ Saving...' : '✓ Save Token'}
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
