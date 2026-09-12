import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FRAME, PART_REGISTRY, mm, type PartId } from './parts'
import { PART_MESHES } from './partMeshes'
import { useHardwareStore } from '@/store/hardware'
import { LABEL_H, LABEL_SHOW, LABEL_W, type LabelHandles, type LabelRefs } from './labels'

const easeOut = (x: number) => 1 - Math.pow(1 - x, 4)
const localT = (t: number, delay: number) => THREE.MathUtils.clamp((t - delay) / (1 - delay), 0, 1)
const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const SMOOTH_RATE = 7
const SETTLE_EPS = 1e-3
/** Hovered parts lift 1.2 mm so the feedback is felt, not shouted. */
const HOVER_LIFT = mm(1.2)
const COL_GAP = 56
const ROW_GAP = 44
const MARGIN = 16
const SIDE_HYSTERESIS = 40
const TOOLTIP_GAP = 28
const TOOLTIP_RISE = 10

interface ControlsLike { target: THREE.Vector3; update: () => void }

const v = new THREE.Vector3()

export function NodeModel({ interactive, handles }: { interactive: boolean; handles: LabelHandles }) {
  const root = useRef<THREE.Group>(null)
  const smooth = useRef(useHardwareStore.getState().explode)
  const lifts = useRef<Partial<Record<PartId, number>>>({})
  const sides = useRef<Partial<Record<PartId, -1 | 1>>>({})
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  const staticTarget = useRef(new THREE.Vector3(0, FRAME.targetY.rest, 0))

  useEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true }
    })
  }, [])

  useFrame((state, dt) => {
    const { explode: target, reducedMotion, hoverPartId, selectedPartId } = useHardwareStore.getState()
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * SMOOTH_RATE)
    smooth.current += (target - smooth.current) * k
    if (Math.abs(target - smooth.current) < SETTLE_EPS) smooth.current = target
    const t = smooth.current
    handles.explode = t
    let busy = false

    for (const p of PART_REGISTRY) {
      const g = handles.groups[p.id]
      if (!g) continue
      const e = easeOut(localT(t, p.delay))
      const wantLift = (hoverPartId === p.id || selectedPartId === p.id) ? HOVER_LIFT : 0
      const cur = lifts.current[p.id] ?? 0
      const lift = reducedMotion ? wantLift : cur + (wantLift - cur) * k
      lifts.current[p.id] = lift
      g.position.set(mm(p.rest[0]), mm(p.rest[1]) + p.lift * e + lift, mm(p.rest[2]))
      if (Math.abs(wantLift - lift) > SETTLE_EPS * 0.1) busy = true
    }

    // Camera: the target climbs and the camera backs off as the stack opens, keeping the orbit direction.
    const cam = state.camera
    const focus = controls ? controls.target : staticTarget.current
    // The camera follows the same curve as the top of the stack so nothing leaves the frame mid-explode.
    const tc = easeOut(t)
    const ty = THREE.MathUtils.lerp(FRAME.targetY.rest, FRAME.targetY.exploded, tc)
    // Narrow stages (a phone in portrait) back the camera off so the whole stack still fits.
    const aspect = state.size.width / Math.max(1, state.size.height)
    const dist = THREE.MathUtils.lerp(FRAME.distance.rest, FRAME.distance.exploded, tc) * Math.max(1, FRAME.aspect / aspect)
    if (controls) v.copy(cam.position).sub(focus).setLength(dist)
    else v.set(...FRAME.dir).setLength(dist)
    focus.y = ty
    cam.position.copy(focus).add(v)
    if (controls) controls.update()
    else cam.lookAt(focus)

    projectLabels(state.camera, state.size.width, state.size.height, t, hoverPartId, selectedPartId, handles, sides.current)
    if (busy || target !== smooth.current) state.invalidate()
  })

  return (
    <group ref={root}>
      {PART_REGISTRY.map((p) => {
        const Mesh = PART_MESHES[p.id]
        return (
          <group key={p.id} ref={(el) => { handles.groups[p.id] = el }} position={[mm(p.rest[0]), mm(p.rest[1]), mm(p.rest[2])]}>
            <Mesh part={p} interactive={interactive} />
          </group>
        )
      })}
    </group>
  )
}

interface Projected { id: PartId; sx: number; sy: number; opacity: number; hot: boolean }

/** Places each label in a left or right column beside the model, rows spaced so leaders never cross. */
function projectLabels(
  camera: THREE.Camera, width: number, height: number, explode: number,
  hover: PartId | null, selected: PartId | null, handles: LabelHandles, sides: Partial<Record<PartId, -1 | 1>>,
) {
  const base = smoothstep(LABEL_SHOW.from, LABEL_SHOW.to, explode)
  const items: Projected[] = []
  let minX = Infinity
  let maxX = -Infinity
  let sumX = 0
  for (const p of PART_REGISTRY) {
    const g = handles.groups[p.id]
    const r = handles.refs[p.id]
    if (!g || !r?.label?.isConnected) continue
    v.set(mm(p.anchor[0]), mm(p.anchor[1]), mm(p.anchor[2])).add(g.position).project(camera)
    const sx = ((v.x + 1) / 2) * width
    const sy = ((1 - v.y) / 2) * height
    const hot = hover === p.id || selected === p.id
    const opacity = hot ? 1 : p.index > 0 ? base : 0
    items.push({ id: p.id, sx, sy, opacity, hot })
    if (p.index > 0) { minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); sumX += sx }
  }
  const labelled = PART_REGISTRY.filter((p) => p.index > 0).length
  const centerX = sumX / Math.max(1, labelled)
  const leftEdge = Math.max(MARGIN + LABEL_W, minX - COL_GAP)
  const rightEdge = Math.min(width - MARGIN - LABEL_W, maxX + COL_GAP)

  const cols: Record<'-1' | '1', Projected[]> = { '-1': [], '1': [] }
  for (const it of items) {
    const prev = sides[it.id] ?? (PART_REGISTRY.find((p) => p.id === it.id)!.rest[0] < 0 ? -1 : 1)
    let side = prev
    if (prev === -1 && it.sx > centerX + SIDE_HYSTERESIS) side = 1
    if (prev === 1 && it.sx < centerX - SIDE_HYSTERESIS) side = -1
    sides[it.id] = side
    cols[side === -1 ? '-1' : '1'].push(it)
  }

  // Assembled: a hovered part gets a short tooltip-style leader beside it instead of a column slot.
  const tooltipMode = base < 0.01
  for (const key of ['-1', '1'] as const) {
    const col = cols[key].filter((it) => it.opacity > 0.001).sort((a, b) => a.sy - b.sy)
    if (tooltipMode) {
      for (const it of col) {
        const r = handles.refs[it.id]!
        const right = it.sx + TOOLTIP_GAP + LABEL_W <= width - MARGIN
        const edge = right ? it.sx + TOOLTIP_GAP : it.sx - TOOLTIP_GAP
        const x = right ? edge : edge - LABEL_W
        const y = it.sy - TOOLTIP_RISE
        placeLabel(r, it, x, y, edge, right ? 'left' : 'right', true)
      }
      continue
    }
    const ys = col.map((it) => it.sy)
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + ROW_GAP)
    const bottom = height - MARGIN - LABEL_H / 2
    for (let i = ys.length - 1; i >= 0; i--) {
      ys[i] = Math.min(ys[i], i === ys.length - 1 ? bottom : ys[i + 1] - ROW_GAP)
    }
    const top = MARGIN + LABEL_H / 2
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i === 0 ? top : ys[i - 1] + ROW_GAP)
    col.forEach((it, i) => {
      const edge = key === '-1' ? leftEdge : rightEdge
      placeLabel(handles.refs[it.id]!, it, key === '-1' ? edge - LABEL_W : edge, ys[i], edge, key === '-1' ? 'right' : 'left', false)
    })
  }
  // Anything filtered out this frame (hidden structural parts) stays at opacity 0.
  for (const it of items) {
    if (it.opacity > 0.001) continue
    const r = handles.refs[it.id]!
    if (r.label) { r.label.style.opacity = '0'; r.label.style.pointerEvents = 'none' }
    r.line?.setAttribute('opacity', '0')
    r.dot?.setAttribute('opacity', '0')
  }
}

/** Writes one label's transform and its leader; `edge` is the label side the line meets, `align` the text alignment. */
function placeLabel(r: LabelRefs, it: Projected, x: number, y: number, edge: number, align: 'left' | 'right', overModel: boolean) {
  const el = r.label!
  // A faint backdrop only when the label sits over the model (assembled hover); column labels sit on bare canvas.
  el.style.backgroundColor = overModel ? 'rgba(11, 10, 9, 0.6)' : 'transparent'
  el.style.backdropFilter = overModel ? 'blur(3px)' : 'none'
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - LABEL_H / 2).toFixed(1)}px, 0)`
  el.style.opacity = it.opacity.toFixed(3)
  el.style.pointerEvents = it.opacity > 0.5 ? 'auto' : 'none'
  el.style.textAlign = align
  el.style.alignItems = align === 'right' ? 'flex-end' : 'flex-start'
  const stroke = it.hot ? 'var(--color-accent)' : ''
  if (r.line) {
    r.line.setAttribute('x1', it.sx.toFixed(1)); r.line.setAttribute('y1', it.sy.toFixed(1))
    r.line.setAttribute('x2', edge.toFixed(1)); r.line.setAttribute('y2', y.toFixed(1))
    r.line.setAttribute('opacity', it.opacity.toFixed(3)); r.line.style.stroke = stroke
  }
  if (r.dot) {
    r.dot.setAttribute('cx', it.sx.toFixed(1)); r.dot.setAttribute('cy', it.sy.toFixed(1))
    r.dot.setAttribute('opacity', it.opacity.toFixed(3)); r.dot.style.stroke = stroke
  }
}
