// The Saved session: what survives a reload, kept in sessionStorage as snapshot v1.
import { ref, watch, type Ref } from 'vue'
import { watchDebounced, useEventListener } from '@vueuse/core'
import type { FieldType, FieldValue, Metadata } from './api/types'
import type { Layout, LayoutMode, Point, Viewport } from './layout'
import type { Chain } from './run'

export const SESSION_KEY = 'text-transformer.session'
export const TYPING_SAVE_DELAY_MS = 300

export interface SessionSnapshot {
  schemaVersion: 1
  inputText: string
  steps: { id: string; transformationId: string; values: Record<string, FieldValue> }[]
  // The Field types the values were written under, so a changed Field drops its stale value on restore.
  fieldTypes: Record<string, Record<string, FieldType>>
  // The viewport is null until the user has panned or zoomed; restore then frames the Chain afresh.
  layout: { mode: LayoutMode; positions: Record<string, Point>; viewport: Viewport | null }
}

const FIELD_TYPES: readonly string[] = ['text', 'integer', 'boolean', 'select']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isFieldValue = (value: unknown): value is FieldValue =>
  value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'

const isPoint = (value: unknown): value is Point =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)

const isViewport = (value: unknown): value is Viewport =>
  isPoint(value) && isFiniteNumber((value as unknown as Viewport).zoom) && (value as unknown as Viewport).zoom > 0

export function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.inputText !== 'string') return false
  const { steps, fieldTypes, layout } = value
  if (!Array.isArray(steps) || !steps.every((step) =>
    isRecord(step) && typeof step.id === 'string' && typeof step.transformationId === 'string' &&
    isRecord(step.values) && Object.values(step.values).every(isFieldValue))) return false
  if (!isRecord(fieldTypes) || !Object.values(fieldTypes).every((fields) =>
    isRecord(fields) && Object.values(fields).every((type) => typeof type === 'string' && FIELD_TYPES.includes(type)))) return false
  return isRecord(layout) && (layout.mode === 'desktop' || layout.mode === 'phone') &&
    isRecord(layout.positions) && Object.values(layout.positions).every(isPoint) &&
    (layout.viewport === null || isViewport(layout.viewport))
}

export function hasStoredSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null
  } catch {
    return false
  }
}

export function readSession(): SessionSnapshot | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored === null) return null
    const parsed: unknown = JSON.parse(stored)
    return isSessionSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function buildSnapshot(chain: Chain, layout: Layout, metadata: Metadata): SessionSnapshot {
  const fieldTypes: SessionSnapshot['fieldTypes'] = {}
  for (const step of chain.steps) {
    const transformation = metadata.transformations.find((item) => item.id === step.transformationId)
    if (transformation) {
      fieldTypes[transformation.id] = Object.fromEntries(transformation.fields.map((field) => [field.name, field.type]))
    }
  }
  return {
    schemaVersion: 1,
    inputText: chain.inputText,
    steps: chain.steps.map(({ id, transformationId, values }) => ({ id, transformationId, values: { ...values } })),
    fieldTypes,
    layout: {
      mode: layout.mode,
      positions: Object.fromEntries(Object.entries(layout.positions).map(([id, { x, y }]) => [id, { x, y }])),
      viewport: layout.viewport && { x: layout.viewport.x, y: layout.viewport.y, zoom: layout.viewport.zoom },
    },
  }
}

function fits(type: FieldType, value: FieldValue) {
  if (value === null) return true
  return type === 'integer' ? typeof value === 'number' : type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string'
}

// Fits a snapshot to the metadata just loaded: unknown Transformations are dropped, and a Field whose
// type changed gets its default. Positions and viewport come back only in the same layout mode.
export function restoreSession(snapshot: SessionSnapshot, metadata: Metadata, mode: LayoutMode) {
  const seen = new Set<string>()
  const steps: Chain['steps'] = []
  for (const saved of snapshot.steps) {
    const transformation = metadata.transformations.find((item) => item.id === saved.transformationId)
    if (!transformation || seen.has(saved.id) || steps.length >= metadata.limits.maxSteps) continue
    seen.add(saved.id)
    const values = Object.fromEntries(transformation.fields.map((field) => {
      const value = saved.values[field.name]
      const usable = value !== undefined && snapshot.fieldTypes[transformation.id]?.[field.name] === field.type && fits(field.type, value)
      return [field.name, usable ? value : field.defaultValue]
    }))
    steps.push({ id: saved.id, transformationId: saved.transformationId, values })
  }
  const sameMode = snapshot.layout.mode === mode
  const liveIds = new Set(['input', 'output', ...steps.map((step) => step.id)])
  return {
    inputText: snapshot.inputText,
    steps,
    positions: sameMode
      ? Object.fromEntries(Object.entries(snapshot.layout.positions).filter(([id]) => liveIds.has(id)))
      : {},
    viewport: sameMode ? snapshot.layout.viewport : null,
  }
}

interface SessionSavingSources {
  chain: Chain
  layout: Layout
  metadata: Ref<Metadata | null>
  phase: Ref<string>
}

// Saves nothing until `phase` is 'ready', then once on reaching it. Step ids/order and layout save at
// once; Input text and Field values after a pause in typing. Hiding the page saves whatever is pending.
export function useSessionSaving({ chain, layout, metadata, phase }: SessionSavingSources) {
  const saveFailed = ref(false)
  let lastWritten: string | null = null

  function save() {
    if (phase.value !== 'ready' || !metadata.value) return
    const serialized = JSON.stringify(buildSnapshot(chain, layout, metadata.value))
    if (serialized === lastWritten) return
    try {
      sessionStorage.setItem(SESSION_KEY, serialized)
      lastWritten = serialized
      saveFailed.value = false
    } catch {
      saveFailed.value = true
    }
  }

  watch(phase, save)
  watch(() => chain.steps.map((step) => step.id).join('|'), save)
  watch(layout, save, { deep: true })
  watchDebounced(
    () => [chain.inputText, chain.steps.map((step) => step.values)],
    save,
    { debounce: TYPING_SAVE_DELAY_MS, deep: true },
  )
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') save()
  })
  useEventListener(window, 'pagehide', save)

  return { saveFailed }
}
