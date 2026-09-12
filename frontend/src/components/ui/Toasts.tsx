import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { X } from 'lucide-react'
import { useUiStore } from '@/store/ui'
import { useIncidentStore } from '@/store/incidents'

const TONE_HZ = [880, 1175]
const TONE_MS = 90

/** DESIGN §6.12: two short sine beeps, generated with WebAudio. */
function playPing(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    TONE_HZ.forEach((hz, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz
      const start = ctx.currentTime + (i * (TONE_MS + 30)) / 1000
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + TONE_MS / 1000)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + TONE_MS / 1000 + 0.02)
    })
    setTimeout(() => void ctx.close(), 600)
  } catch {
    /* audio unavailable */
  }
}

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismiss)
  const audioUnlocked = useUiStore((s) => s.audioUnlocked)
  const pingSeq = useIncidentStore((s) => s.pingSeq)
  const { pathname } = useLocation()
  const lastSeq = useRef(pingSeq)

  useEffect(() => {
    if (pingSeq === lastSeq.current) return
    lastSeq.current = pingSeq
    if (audioUnlocked && pathname.startsWith('/responder')) playPing()
  }, [pingSeq, audioUnlocked, pathname])

  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 w-80 max-w-[calc(100vw-32px)]" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-overlay rounded-md px-4 py-3 text-sm text-ink flex items-start gap-3 animate-[toast-in_200ms_var(--ease-enter)]"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
        >
          <span className="flex-1 min-w-0">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink shrink-0">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      ))}
      <style>{'@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}
