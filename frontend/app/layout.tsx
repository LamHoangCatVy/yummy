import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YUMMY — AI SDLC Platform',
  description: 'AI-powered multi-agent SDLC platform for banking & enterprise',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
