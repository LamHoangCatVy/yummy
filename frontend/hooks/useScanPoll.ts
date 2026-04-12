import { useRef } from 'react'
import { api } from '@/lib/api'
import type { ScanStatus } from '@/lib/types'

interface UseScanPollOptions {
  onStatusUpdate: (s: ScanStatus) => void
  onMessage: (text: string) => void
  onComplete: () => void
}

/**
 * Returns a `startScanPoll` function that polls GET /kb/scan/status every 1.5s,
 * streams status messages to the terminal, and calls `onComplete` when done.
 */
export function useScanPoll({ onStatusUpdate, onMessage, onComplete }: UseScanPollOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startScanPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    let lastText = ''

    pollRef.current = setInterval(async () => {
      try {
        const s = await api.kb.scanStatus() as ScanStatus
        onStatusUpdate(s)

        if (s.text && s.text !== lastText) {
          lastText = s.text
          onMessage(`⟳ ${s.text}`)
        }

        if (!s.running) {
          clearInterval(pollRef.current!)
          onStatusUpdate({ running: false, text: '', progress: 0 })
          if (s.error) {
            onMessage(`❌ Scan failed: ${s.text}`)
          } else {
            onComplete()
          }
        }
      } catch { /* network hiccup — keep polling */ }
    }, 1500)
  }

  const stopScanPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }

  return { startScanPoll, stopScanPoll }
}
