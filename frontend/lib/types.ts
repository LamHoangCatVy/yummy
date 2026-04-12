// YUMMY Frontend — TypeScript Types

export interface Session {
  id: string
  name: string
  created_at: string
  workflow_state: WorkflowState
  chat_history: ChatMessage[]
  agent_outputs: AgentOutputs
  jira_backlog: JiraEpic[]
  metrics: { tokens: number }
}

export type WorkflowState =
  | 'idle'
  | 'running_ba'
  | 'waiting_ba_approval'
  | 'running_sa'
  | 'waiting_sa_approval'
  | 'running_dev_lead'
  | 'waiting_dev_lead_approval'
  | 'running_rest'
  | 'done'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  text: string
  trace?: RAGTrace
}

export interface RAGTrace {
  intent: string
  retrieval_method: string
  source_chunks: { files: string[]; summary_preview: string }[]
}

export interface AgentOutputs {
  requirement?: string
  ba?: string
  sa?: string
  dev_lead?: string
  dev?: string
  security?: string
  qa?: string
  sre?: string
}

export interface JiraEpic {
  title: string
  tasks: JiraTask[]
}

export interface JiraTask {
  title: string
  type: 'backend' | 'frontend' | 'devops' | 'security' | 'testing'
  story_points?: number
  subtasks: string[]
}

export interface KnowledgeBase {
  file_count: number
  insight_count: number
  has_summary: boolean
  tree: FileNode[]
  insights: Insight[]
  project_summary: string
}

export interface FileNode {
  path: string
  name: string
  status: 'pending' | 'processing' | 'done'
}

export interface Insight {
  id: number
  files: string[]
  summary: string
}

export interface ScanStatus {
  running: boolean
  text: string
  progress: number
  error?: boolean
}

export interface SystemStatus {
  repo: { owner: string; repo: string; branch?: string } | null
  ai_provider: 'gemini' | 'ollama' | 'copilot'
  has_gemini_key: boolean
  gemini_model?: string
  has_github_token: boolean
  ollama_url?: string
  ollama_model?: string
  has_copilot_token?: boolean
  copilot_model?: string
  kb_files: number
  kb_insights: number
  kb_has_summary: boolean
  total_sessions: number
  scan_status: ScanStatus | null
  total_requests: number
  total_cost_usd: number
}

export interface RequestLog {
  id: number
  time: string
  agent: string
  provider: string
  in_tokens: number
  out_tokens: number
  latency: number
  cost: number
}

export interface MetricsData {
  total_requests: number
  total_cost_usd: number
  agent_breakdown: Record<string, { calls: number; cost: number; total_tokens: number }>
  logs: RequestLog[]
}
