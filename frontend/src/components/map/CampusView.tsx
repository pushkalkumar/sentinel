import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useReducedMotion } from '@/three/shared/motionPrefs'
import { CampusMap, type CampusMapProps } from './CampusMap'
import { CampusScene } from './CampusScene'
import { supportsWebGL } from '@/three/campus/webgl'

/** Below this the map is too small to read as a model: phones keep the flat SVG. */
const WIDE_QUERY = '(min-width: 768px)'

export interface CampusViewProps extends CampusMapProps {
  /** Slow idle orbit on the 3D scene until the first drag (landing hero only). */
  drift?: boolean
}

/**
 * One map for the whole product: the lit 3D campus where the browser and the panel can carry it,
 * the SVG CampusMap everywhere else (floor plans, small crops, phones, reduced motion, no WebGL).
 * Both renderers take the same props, so callers never branch.
 */
export function CampusView({ drift = false, className, ...props }: CampusViewProps) {
  const three = useCampus3D(props)
  const box = useRef<HTMLDivElement>(null)
  const active = useInView(box, three)

  return (
    <div ref={box} className={clsx('relative min-w-0', className)}>
      {three
        ? <CampusScene {...props} drift={drift} active={active} className="absolute inset-0" />
        : <CampusMap {...props} className="absolute inset-0 w-full h-full" />}
    </div>
  )
}

/**
 * True when this map should render as the 3D scene. Callers that overlay the SVG viewBox
 * (the landing hero's hop dashes) need the same answer the view uses.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared gate, deliberately colocated with the view it decides
export function useCampus3D({ ground, compact = false }: Pick<CampusMapProps, 'ground' | 'compact'>): boolean {
  const [webgl] = useState(supportsWebGL)
  const reduced = useReducedMotion()
  const wide = useMediaQuery(WIDE_QUERY)
  return webgl && wide && !reduced && !compact && ground === 'campus'
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Parks the render loop while the panel is scrolled away; always true when there is no observer. */
function useInView(ref: React.RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, enabled])
  return inView
}
