import { Position } from '@xyflow/vue'

export type LayoutMode = 'desktop' | 'phone'

export interface Point {
  x: number
  y: number
}

export interface Viewport extends Point {
  zoom: number
}

export interface Layout {
  mode: LayoutMode
  // Only nodes the user has dragged are here; every other node sits in its slot.
  positions: Record<string, Point>
  viewport: Viewport | null
}

// Below this width the Chain runs top to bottom instead of left to right.
export const PHONE_QUERY = '(max-width: 799px)'

const GAP: Record<LayoutMode, number> = { desktop: 330, phone: 300 }

export const INPUT_ID = 'input'
export const OUTPUT_ID = 'output'

// The id of the heading that names a node, for aria-labelledby on Vue Flow's node wrapper.
export const titleIdOf = (nodeId: string) => `node-${nodeId}-title`

// Where the node at `index` in Chain order sits by default.
export function slot(index: number, mode: LayoutMode): Point {
  const offset = index * GAP[mode]
  return mode === 'phone' ? { x: 0, y: offset } : { x: offset, y: 0 }
}

export function handlePositions(mode: LayoutMode) {
  return mode === 'phone'
    ? { target: Position.Top, source: Position.Bottom }
    : { target: Position.Left, source: Position.Right }
}
