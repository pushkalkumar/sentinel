import clsx from 'clsx'
import { Volume2, VolumeX } from 'lucide-react'
import { useUiStore } from '@/store/ui'

export interface SoundToggleProps { className?: string }

/**
 * DESIGN §6.12: the ping tone plays only after a user gesture allowed audio.
 * The click is that gesture; the store flag gates playback in <Toasts/>.
 */
export function SoundToggle({ className }: SoundToggleProps) {
  const on = useUiStore((s) => s.audioUnlocked)
  const allow = useUiStore((s) => s.unlockAudio)
  const toggle = () => {
    if (on) useUiStore.setState({ audioUnlocked: false })
    else allow()
  }
  const Icon = on ? Volume2 : VolumeX
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Mute new-incident tone' : 'Play a tone on new incidents'}
      title={on ? 'Tone on. Click to mute.' : 'Tone off. Click to hear new incidents.'}
      className={clsx(
        'inline-flex items-center gap-2 h-9 px-3 rounded-sm text-sm font-medium',
        'transition-[background-color,color] duration-[120ms]',
        on ? 'text-ink bg-raised hairline' : 'text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)]',
        className,
      )}
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden />
      <span>{on ? 'Sound on' : 'Sound off'}</span>
    </button>
  )
}
