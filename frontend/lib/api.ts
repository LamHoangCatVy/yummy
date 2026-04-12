// YUMMY Frontend — API Client
// Connects to yummy-core/yummy-backend (FastAPI on port 8000)

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API Error ${res.status}`)
  }
  return res.json()
}

// ── Config ─────────────────────────────────────────────────
export const api = {
  config: {
    setGeminiKey: (api_key: string, model?: string) =>
      request('/config/api-key', { method: 'POST', body: JSON.stringify({ api_key, model }) }),

    setOllama: (base_url: string, model: string) =>
      request('/config/ollama', { method: 'POST', body: JSON.stringify({ base_url, model }) }),

    setProvider: (provider: 'gemini' | 'ollama' | 'copilot' | 'openai' | 'bedrock') =>
      request('/config/provider', { method: 'POST', body: JSON.stringify({ provider }) }),

    setup: (github_url: string, token: string, max_scan_limit: number) =>
      request('/config/setup', {
        method: 'POST',
        body: JSON.stringify({ github_url, token, max_scan_limit }),
      }),

    setCopilot: (token: string, model?: string) =>
      request('/config/copilot', { method: 'POST', body: JSON.stringify({ token, model }) }),

    setOpenAI: (api_key: string, model?: string) =>
      request('/config/openai', { method: 'POST', body: JSON.stringify({ api_key, model }) }),

    setBedrock: (access_key: string, secret_key: string, region?: string, model?: string) =>
      request('/config/bedrock', { method: 'POST', body: JSON.stringify({ access_key, secret_key, region, model }) }),

    status: () => request('/config/status'),
  },

  // ── Sessions ──────────────────────────────────────────────
  sessions: {
    list: () => request('/sessions'),
    create: (name?: string) =>
      request('/sessions', { method: 'POST', body: JSON.stringify({ name }) }),
    get: (id: string) => request(`/sessions/${id}`),
    delete: (id: string) => request(`/sessions/${id}`, { method: 'DELETE' }),
    reset: (id: string) => request(`/sessions/${id}/reset`, { method: 'POST' }),
  },

  // ── Knowledge Base ────────────────────────────────────────
  kb: {
    get: () => request('/kb'),
    scan: () => request('/kb/scan', { method: 'POST' }),
    scanStatus: () => request('/kb/scan/status'),
    file: (path: string) => request(`/kb/file?path=${encodeURIComponent(path)}`),
    clear: () => request('/kb', { method: 'DELETE' }),
  },

  // ── RAG Chat ──────────────────────────────────────────────
  /**
   * Streaming ask — returns an async generator that yields text chunks.
   * Emits special tokens: '[DONE]' and '[TRACE] {...}' at the end.
   */
  askStream: async function* (
    session_id: string,
    question: string,
    ide_file?: string,
    ide_content?: string,
    free?: boolean,   // true = /btw (no KB required)
  ): AsyncGenerator<string> {
    const endpoint = free ? '/ask/free' : '/ask'
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ session_id, question, ide_file, ide_content }),
    })
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `API Error ${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          yield payload.replace(/\\n/g, '\n')
        }
      }
    }
  },

  /** Non-streaming fallback */
  ask: (session_id: string, question: string, ide_file?: string, ide_content?: string) =>
    request('/ask/sync', {
      method: 'POST',
      body: JSON.stringify({ session_id, question, ide_file, ide_content }),
    }),

  // ── SDLC ──────────────────────────────────────────────────
  sdlc: {
    start: (session_id: string, requirement: string) =>
      request('/sdlc/start', { method: 'POST', body: JSON.stringify({ session_id, requirement }) }),

    approveBa: (session_id: string, edited_content?: string) =>
      request('/sdlc/approve-ba', {
        method: 'POST',
        body: JSON.stringify({ session_id, edited_content }),
      }),

    approveSa: (session_id: string, edited_content?: string) =>
      request('/sdlc/approve-sa', {
        method: 'POST',
        body: JSON.stringify({ session_id, edited_content }),
      }),

    approveDevLead: (session_id: string, edited_content?: string) =>
      request('/sdlc/approve-dev-lead', {
        method: 'POST',
        body: JSON.stringify({ session_id, edited_content }),
      }),

    state: (session_id: string) => request(`/sdlc/${session_id}/state`),
  },

  // ── Metrics ───────────────────────────────────────────────
  metrics: () => request('/metrics'),

  // ── Health ────────────────────────────────────────────────
  health: {
    model: () => request('/health/model'),
  },
}
