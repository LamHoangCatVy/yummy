// YUMMY — Theme System
// Apply via: applyTheme('yummy') or /yummy in chat

export type ThemeId = 'dark' | 'light' | 'dracula' | 'yummy' | 'angry' | 'idea'

export interface Theme {
  id: ThemeId
  name: string
  emoji: string
  mood: string
  vars: Record<string, string>
  scanlines?: string
}

export const THEMES: Record<ThemeId, Theme> = {

  // ── Default: phosphor terminal ─────────────────────────────────────────────
  dark: {
    id: 'dark', name: 'Dark', emoji: '🖥', mood: 'focused',
    vars: {
      '--bg':        '#080c0a',
      '--bg-1':      '#0d1210',
      '--bg-2':      '#111a14',
      '--bg-3':      '#1a2620',
      '--border':    '#1e2e24',
      '--border-2':  '#243628',
      '--green':     '#00ff88',
      '--green-dim': '#00cc66',
      '--green-mute':'#004422',
      '--green-glow':'rgba(0,255,136,0.08)',
      '--amber':     '#ffb300',
      '--amber-dim': '#cc8800',
      '--red':       '#ff4444',
      '--red-dim':   '#991111',
      '--text':      '#c8ddd2',
      '--text-2':    '#7a9e8a',
      '--text-3':    '#3a5a48',
      '--text-inv':  '#080c0a',
    },
    scanlines: 'rgba(0,255,136,0.012)',
  },

  // ── Light: clean dev studio — EXPLAIN mood ─────────────────────────────────
  light: {
    id: 'light', name: 'Light', emoji: '☀️', mood: 'explain',
    vars: {
      '--bg':        '#f5f7f5',
      '--bg-1':      '#ffffff',
      '--bg-2':      '#eef2ee',
      '--bg-3':      '#e2ebe3',
      '--border':    '#d0ddd1',
      '--border-2':  '#bfcfc0',
      '--green':     '#0a7c3e',
      '--green-dim': '#0d9e50',
      '--green-mute':'#d4f0e0',
      '--green-glow':'rgba(10,124,62,0.08)',
      '--amber':     '#b45309',
      '--amber-dim': '#92400e',
      '--red':       '#dc2626',
      '--red-dim':   '#991b1b',
      '--text':      '#1a2e1e',
      '--text-2':    '#3d6b47',
      '--text-3':    '#7aaa84',
      '--text-inv':  '#ffffff',
    },
    scanlines: 'transparent',
  },

  // ── Dracula: purple/pink — NERVOUS mood ────────────────────────────────────
  dracula: {
    id: 'dracula', name: 'Dracula', emoji: '🧛', mood: 'nervous',
    vars: {
      '--bg':        '#0d0d1a',
      '--bg-1':      '#12122a',
      '--bg-2':      '#1a1a35',
      '--bg-3':      '#22224a',
      '--border':    '#2d2d5e',
      '--border-2':  '#3a3a72',
      '--green':     '#bd93f9',
      '--green-dim': '#9d73d9',
      '--green-mute':'#2a1a4a',
      '--green-glow':'rgba(189,147,249,0.08)',
      '--amber':     '#ffb86c',
      '--amber-dim': '#cc8844',
      '--red':       '#ff5555',
      '--red-dim':   '#aa2222',
      '--text':      '#f8f8f2',
      '--text-2':    '#b0a8d8',
      '--text-3':    '#5a5280',
      '--text-inv':  '#0d0d1a',
    },
    scanlines: 'rgba(189,147,249,0.008)',
  },

  // ── Yummy: bubblegum pink + electric violet — LOVE mood ───────────────────
  yummy: {
    id: 'yummy', name: 'Yummy', emoji: '🩷', mood: 'love',
    vars: {
      '--bg':        '#0e0812',
      '--bg-1':      '#150d1c',
      '--bg-2':      '#1e1228',
      '--bg-3':      '#2a1838',
      '--border':    '#3d1f52',
      '--border-2':  '#4e2868',
      '--green':     '#ff6eb4',
      '--green-dim': '#e0509a',
      '--green-mute':'#3d0a28',
      '--green-glow':'rgba(255,110,180,0.10)',
      '--amber':     '#c084fc',
      '--amber-dim': '#9333ea',
      '--red':       '#fb7185',
      '--red-dim':   '#9f1239',
      '--text':      '#fce7f3',
      '--text-2':    '#d8a8c8',
      '--text-3':    '#7a4a6a',
      '--text-inv':  '#0e0812',
    },
    scanlines: 'rgba(255,110,180,0.010)',
  },

  // ── Angry: hot red/orange — ANGRY mood ────────────────────────────────────
  angry: {
    id: 'angry', name: 'Angry', emoji: '🔥', mood: 'angry',
    vars: {
      '--bg':        '#0f0500',
      '--bg-1':      '#1a0800',
      '--bg-2':      '#240c00',
      '--bg-3':      '#331200',
      '--border':    '#4a1800',
      '--border-2':  '#5e2000',
      '--green':     '#ff4500',
      '--green-dim': '#cc3300',
      '--green-mute':'#3d0e00',
      '--green-glow':'rgba(255,69,0,0.10)',
      '--amber':     '#ffa500',
      '--amber-dim': '#cc7700',
      '--red':       '#ff1a1a',
      '--red-dim':   '#aa0000',
      '--text':      '#ffe8d6',
      '--text-2':    '#cc8866',
      '--text-3':    '#6a3322',
      '--text-inv':  '#0f0500',
    },
    scanlines: 'rgba(255,69,0,0.010)',
  },

  // ── Idea: golden yellow + cyan — IDEA mood ────────────────────────────────
  idea: {
    id: 'idea', name: 'Idea', emoji: '💡', mood: 'idea',
    vars: {
      '--bg':        '#080a0f',
      '--bg-1':      '#0d1018',
      '--bg-2':      '#121520',
      '--bg-3':      '#1a1e2e',
      '--border':    '#1e2840',
      '--border-2':  '#263252',
      '--green':     '#ffd700',
      '--green-dim': '#ccaa00',
      '--green-mute':'#2a2200',
      '--green-glow':'rgba(255,215,0,0.08)',
      '--amber':     '#00d4ff',
      '--amber-dim': '#0099cc',
      '--red':       '#ff6b6b',
      '--red-dim':   '#aa2222',
      '--text':      '#f0ead6',
      '--text-2':    '#a89a6a',
      '--text-3':    '#4a4228',
      '--text-inv':  '#080a0f',
    },
    scanlines: 'rgba(255,215,0,0.008)',
  },
}

const STORAGE_KEY = 'yummy_theme'

export function applyTheme(id: ThemeId): void {
  const theme = THEMES[id]
  if (!theme) return
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))

  // Update scanline body background
  const scanColor = theme.scanlines ?? 'transparent'
  if (scanColor === 'transparent') {
    document.body.style.backgroundImage = 'none'
  } else {
    document.body.style.backgroundImage = `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        ${scanColor} 2px,
        ${scanColor} 4px
      )`
  }

  // Persist
  localStorage.setItem(STORAGE_KEY, id)
  // Set data attribute for potential CSS targeting
  root.setAttribute('data-theme', id)
}

export function loadSavedTheme(): void {
  if (typeof window === 'undefined') return
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
  if (saved && THEMES[saved]) applyTheme(saved)
}

export function getCurrentTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem(STORAGE_KEY) as ThemeId) ?? 'dark'
}
