import { Link } from 'react-router'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/admin', label: 'Admin' },
  { to: '/responder', label: 'Responder' },
]

/** DESIGN §8.8: 56px bar. Brand left, signage kicker centre, nav right. */
export function HardwareBar() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-canvas border-b border-line">
      <div className="h-full max-w-[1600px] mx-auto px-6 flex items-center gap-6">
        <Link to="/" className="display-h2 text-md text-ink shrink-0">Sentinel</Link>
        <span className="label-signage hidden md:inline truncate">Sentinel Node · Rev A · designed, not fabricated</span>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="text-ink-2 hover:text-ink transition-colors duration-[120ms]">{n.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
