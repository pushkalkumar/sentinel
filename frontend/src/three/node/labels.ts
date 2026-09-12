// Shared handles between the DOM label overlay (outside the Canvas) and the projector that positions it every frame.
import type * as THREE from 'three'
import type { PartId } from './parts'

export interface LabelRefs {
  label: HTMLDivElement | null
  line: SVGLineElement | null
  dot: SVGCircleElement | null
}

export interface LabelHandles {
  /** One entry per part, filled by the overlay as it mounts. */
  refs: Partial<Record<PartId, LabelRefs>>
  /** Part groups, filled by the model. */
  groups: Partial<Record<PartId, THREE.Group | null>>
  /** Smoothed explode factor, written by the model each frame. */
  explode: number
}

export const createLabelHandles = (): LabelHandles => ({ refs: {}, groups: {}, explode: 0 })

export const LABEL_W = 184
export const LABEL_H = 34
/** Labels fade in over this explode range; hovered and selected parts always show theirs. */
export const LABEL_SHOW = { from: 0.5, to: 0.66 } as const
