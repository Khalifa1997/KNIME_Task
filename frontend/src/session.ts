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
  // Missing in Saved sessions from before the Content check, which restore as off.
  contentCheck?: boolean
  steps: { id: string; transformationId: string; values: Record<string, FieldValue> }[]
  // The Fields and types the values were written under, so restore can find added, removed and changed-type Fields.
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
  if (value.contentCheck !== undefined && typeof value.contentCheck !== 'boolean') return false
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

// The stored text as it is, so a damaged Saved session can be told apart from no Saved session.
export function readStoredSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function discardStoredSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage is unavailable, so there is nothing to remove.
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
    contentCheck: chain.contentCheck,
    steps: chain.steps.map(({ id, transformationId, values }) => ({ id, transformationId, values: { ...values } })),
    fieldTypes,
    layout: {
      mode: layout.mode,
      positions: Object.fromEntries(Object.entries(layout.positions).map(([id, { x, y }]) => [id, { x, y }])),
      viewport: layout.viewport && { x: layout.viewport.x, y: layout.viewport.y, zoom: layout.viewport.zoom },
    },
  }
}

export type RestoreResult =
  | { status: 'none' }
  | { status: 'blocked'; reason: string }
  | {
    status: 'restored'
    inputText: string
    // Off when the server can't run the Content check, so it is never asked to.
    contentCheck: boolean
    steps: Chain['steps']
    positions: Record<string, Point>
    // Null when the layout mode changed: the canvas frames the Chain afresh.
    viewport: Viewport | null
    // One line per Transformation whose Fields were added or removed since the save.
    adjustments: string[]
  }

const DAMAGED = 'The saved session is damaged and can’t be read.'

const blocked = (reason: string): RestoreResult => ({ status: 'blocked', reason })

const listOf = (names: string[]) =>
  names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

// Fits a stored Saved session to the metadata just loaded. A Field still there with the same type keeps
// its value; an added Field takes its default (or stays unset); a removed Field is dropped. Anything that
// can't be adjusted safely blocks the restore, and values that no longer fit the rules are kept as they are.
// Positions and viewport come back only in the same layout mode.
export function restoreSession(stored: string | null, metadata: Metadata, mode: LayoutMode): RestoreResult {
  if (stored === null) return { status: 'none' }
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return blocked(DAMAGED)
  }
  if (isRecord(parsed) && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion !== 1) {
    return blocked(`The saved session comes from another version of the app (schema version ${parsed.schemaVersion}).`)
  }
  if (!isSessionSnapshot(parsed)) return blocked(DAMAGED)
  const snapshot = parsed
  const stepIds = new Set(snapshot.steps.map((step) => step.id))
  if (stepIds.size !== snapshot.steps.length || snapshot.steps.some((step) => !snapshot.fieldTypes[step.transformationId])) {
    return blocked(DAMAGED)
  }

  const transformationsById = new Map(metadata.transformations.map((item) => [item.id, item]))
  const adjustments: string[] = []
  const addedFieldsById = new Map<string, Set<string>>()
  for (const id of new Set(snapshot.steps.map((step) => step.transformationId))) {
    const transformation = transformationsById.get(id)
    if (!transformation) return blocked(`Your saved Chain uses the Transformation “${id}”, which is no longer available.`)
    const savedTypes = snapshot.fieldTypes[id]!
    for (const field of transformation.fields) {
      const savedType = savedTypes[field.name]
      if (savedType !== undefined && savedType !== field.type) {
        return blocked(`The Field “${field.label}” of ${transformation.label} changed from ${savedType} to ${field.type} since you saved.`)
      }
    }
    const added = transformation.fields.filter((field) => savedTypes[field.name] === undefined)
    const currentNames = new Set(transformation.fields.map((field) => field.name))
    const removed = Object.keys(savedTypes).filter((name) => !currentNames.has(name))
    const changes = [
      added.length ? `added ${listOf(added.map((field) => field.label))}` : '',
      removed.length ? `removed ${listOf(removed)}` : '',
    ].filter(Boolean)
    if (changes.length) adjustments.push(`${transformation.label}: ${changes.join('; ')}.`)
    addedFieldsById.set(id, new Set(added.map((field) => field.name)))
  }

  const steps: Chain['steps'] = snapshot.steps.map((saved) => {
    const transformation = transformationsById.get(saved.transformationId)!
    const addedNames = addedFieldsById.get(saved.transformationId)!
    const values = Object.fromEntries(transformation.fields.map((field) => [
      field.name,
      addedNames.has(field.name) ? field.defaultValue : (saved.values[field.name] ?? null),
    ]))
    return { id: saved.id, transformationId: saved.transformationId, values }
  })
  const sameMode = snapshot.layout.mode === mode
  const liveIds = new Set(['input', 'output', ...stepIds])
  return {
    status: 'restored',
    inputText: snapshot.inputText,
    contentCheck: snapshot.contentCheck === true && metadata.contentCheck.available,
    steps,
    positions: sameMode
      ? Object.fromEntries(Object.entries(snapshot.layout.positions).filter(([id]) => liveIds.has(id)))
      : {},
    viewport: sameMode ? snapshot.layout.viewport : null,
    adjustments,
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
    () => [chain.inputText, chain.contentCheck, chain.steps.map((step) => step.values)],
    save,
    { debounce: TYPING_SAVE_DELAY_MS, deep: true },
  )
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') save()
  })
  useEventListener(window, 'pagehide', save)

  return { saveFailed }
}
