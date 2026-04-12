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

    setProvider: (provider: 'gemini' | 'ollama' | 'copilot') =>
      request('/config/provider', { method: 'POST', body: JSON.stringify({ provider }) }),

    setup: (github_url: string, token: string, max_scan_limit: number) =>
      request('/config/setup', {
        method: 'POST',
        body: JSON.stringify({ github_url, token, max_scan_limit }),
      }),

    setCopilot: (token: string, model?: string) =>
      request('/config/copilot', { method: 'POST', body: JSON.stringify({ token, model }) }),

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
  ask: (session_id: string, question: string, ide_file?: string, ide_content?: string) =>
    request('/ask', {
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
