'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { loadSavedTheme } from '@/lib/theme'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [dots, setDots] = useState('')

  useEffect(() => { loadSavedTheme() }, [])
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-bg font-mono">
      {/* ASCII-style logo */}
      <pre
        className="text-green text-[0.7rem] leading-[1.3] text-center select-none"
        style={{ textShadow: '0 0 20px rgba(0,255,136,0.4)', overflow: 'visible' }}
      >{`██╗   ██╗██╗   ██╗███╗   ███╗███╗   ███╗██╗   ██╗
╚██╗ ██╔╝██║   ██║████╗ ████║████╗ ████║╚██╗ ██╔╝
 ╚████╔╝ ██║   ██║██╔████╔██║██╔████╔██║ ╚████╔╝ 
  ╚██╔╝  ██║   ██║██║╚██╔╝██║██║╚██╔╝██║  ╚██╔╝  
   ██║   ╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║   ██║   
   ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝   ╚═╝   `}</pre>

      <div className="text-center text-text-2 text-[0.8rem]">
        <div className="text-green mb-2 text-[0.9rem]">
          AI-powered Multi-Agent SDLC Platform
        </div>
        <div>Initializing workspace{dots}</div>
      </div>

      {status === 'ready' && (
        <div className="text-center text-red text-[0.8rem]">
          ⚠ Cannot connect to backend (localhost:8000)<br/>
          <span className="text-text-2">Run: <code className="text-amber">uvicorn main:app --reload</code> in yummy-core</span>
        </div>
      )}

      <div className="fixed bottom-6 text-text-3 text-xs tracking-[0.08em]">
        YUMMY v2.0 · better than your ex
      </div>
    </div>
  )
}
