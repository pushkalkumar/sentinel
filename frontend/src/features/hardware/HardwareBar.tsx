import { Link } from 'react-router'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/admin', label: 'Admin' },
  { to: '/responder', label: 'Responder' },
]

/** 56px bar: brand left, nav right. The kicker is gone (DESIGN_V2 §4). */
export function HardwareBar() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-canvas border-b border-line">
      <div className="h-full max-w-[1600px] mx-auto px-6 flex items-center">
        <Link to="/" className="display-h2 text-md text-ink shrink-0">Sentinel</Link>
        <nav className="ml-auto flex items-center gap-6 text-sm">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="text-ink-2 hover:text-ink transition-colors duration-[120ms]">{n.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
