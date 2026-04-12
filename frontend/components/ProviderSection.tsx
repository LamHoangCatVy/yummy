import React from 'react'

type Provider = 'gemini' | 'ollama' | 'copilot'

type ProviderSectionProps = {
  cfgProvider: Provider
  cfgSaving: boolean
  onProviderChange: (provider: Provider) => void
  onApplyProvider: () => void
}

const PROVIDERS = [
  { id: 'gemini', label: '✦ Gemini', active: 'var(--green-mute)', color: 'var(--green)', border: 'var(--green-dim)' },
  { id: 'ollama', label: '⬡ Ollama', active: 'rgba(255,179,0,.12)', color: 'var(--amber)', border: 'var(--amber-dim)' },
  { id: 'copilot', label: '⊕ Copilot', active: 'rgba(100,160,255,.12)', color: '#64a0ff', border: 'rgba(100,160,255,.4)' },
] as const

export default function ProviderSection({
  cfgProvider,
  cfgSaving,
  onProviderChange,
  onApplyProvider,
}: ProviderSectionProps) {
  return (
    <section
      className="rounded-lg border overflow-visible relative z-10"
      style={{ borderColor: 'var(--border)' }}
      data-testid="provider-section"
    >
      <div
        className="px-3 py-2 border-b text-2xs uppercase tracking-widest font-bold"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
      >
        AI Provider
      </div>

      <div
        className="p-3 flex flex-wrap gap-2"
        style={{ background: 'var(--bg-1)' }}
        data-testid="provider-options"
      >
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onProviderChange(provider.id)}
            className="py-2 rounded text-xs font-bold uppercase tracking-wide cursor-pointer border transition-colors"
            style={{
              flex: '1 1 120px',
              minWidth: 0,
              background: cfgProvider === provider.id ? provider.active : 'var(--bg-2)',
              color: cfgProvider === provider.id ? provider.color : 'var(--text-3)',
              borderColor: cfgProvider === provider.id ? provider.border : 'var(--border)',
            }}
          >
            {provider.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-3" style={{ background: 'var(--bg-1)' }}>
        <button
          type="button"
          onClick={onApplyProvider}
          disabled={cfgSaving}
          className="w-full py-1.5 rounded text-xs font-bold cursor-pointer transition-colors"
          style={{
            background: 'var(--green-mute)',
            color: 'var(--green)',
            border: '1px solid var(--green-dim)',
            opacity: cfgSaving ? 0.5 : 1,
          }}
        >
          {cfgSaving ? '⟳ Saving...' : 'Apply Provider'}
        </button>
      </div>
    </section>
  )
}
