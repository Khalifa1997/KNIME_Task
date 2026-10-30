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
  // Explicit positions from dragging, keyboard movement or swaps; others sit in their slots.
  positions: Record<string, Point>
  viewport: Viewport | null
}

// Below this width the Chain runs top to bottom instead of left to right.
export const PHONE_QUERY = '(max-width: 799px)'

const GAP: Record<LayoutMode, number> = { desktop: 330, phone: 300 }

export const INPUT_ID = 'input'
export const OUTPUT_ID = 'output'

// The id of the edge from `source` to `target`.
export const edgeIdOf = (source: string, target: string) => `${source}->${target}`

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

// Asks the node `id` to take focus: its first Field, or only the node itself when `nodeOnly`.
export interface FocusRequest {
  id: string
  nodeOnly: boolean
}
