'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [dots, setDots] = useState('')

  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    // Auto-create or fetch first session then redirect
    const init = async () => {
      try {
        const sessions = await api.sessions.list() as any[]
        if (sessions.length > 0) {
          router.push(`/workspace/${sessions[0].id}`)
        } else {
          const session = await api.sessions.create('Default Workspace') as any
          router.push(`/workspace/${session.id}`)
        }
      } catch {
        setStatus('ready')
      }
    }
    const t = setTimeout(init, 800)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      background: 'var(--bg)',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* ASCII-style logo */}
      <pre style={{ color: 'var(--green)', fontSize: '0.7rem', lineHeight: 1.3, textAlign: 'center', textShadow: '0 0 20px rgba(0,255,136,0.4)' }}>{`
██╗   ██╗██╗   ██╗███╗   ███╗███╗   ███╗██╗   ██╗
╚██╗ ██╔╝██║   ██║████╗ ████║████╗ ████║╚██╗ ██╔╝
 ╚████╔╝ ██║   ██║██╔████╔██║██╔████╔██║ ╚████╔╝ 
  ╚██╔╝  ██║   ██║██║╚██╔╝██║██║╚██╔╝██║  ╚██╔╝  
   ██║   ╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║   ██║   
   ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝   ╚═╝   
`}</pre>

      <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '0.8rem' }}>
        <div style={{ color: 'var(--green)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          AI-powered Multi-Agent SDLC Platform
        </div>
        <div>Initializing workspace{dots}</div>
      </div>

      {status === 'ready' && (
        <div style={{ textAlign: 'center', color: 'var(--red)', fontSize: '0.8rem' }}>
          ⚠ Cannot connect to backend (localhost:8000)<br/>
          <span style={{ color: 'var(--text-2)' }}>Run: <code style={{ color: 'var(--amber)' }}>uvicorn main:app --reload</code> in yummy-core</span>
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        color: 'var(--text-3)',
        fontSize: '0.72rem',
        letterSpacing: '0.08em',
      }}>
        YUMMY v2.0 · better than your ex
      </div>
    </div>
  )
}
