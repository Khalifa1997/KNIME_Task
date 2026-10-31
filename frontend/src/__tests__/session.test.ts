import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Metadata } from '../api/types'
import type { Layout } from '../layout'
import type { Chain } from '../run'
import { SESSION_KEY, buildSnapshot, isSessionSnapshot, restoreSession, useSessionSaving, type SessionSnapshot } from '../session'

const metadata: Metadata = {
  contentCheck: { available: true },
  limits: { maxInputLength: 1000, maxSteps: 5 },
  transformations: [
    { id: 'uppercase', label: 'Uppercase', description: '', fields: [] },
    {
      id: 'replace', label: 'Replace', description: '',
      fields: [
        { name: 'search', label: 'Search', type: 'text', required: true, defaultValue: '', min: null, max: null, options: null },
        { name: 'times', label: 'Times', type: 'integer', required: false, defaultValue: 1, min: null, max: null, options: null },
      ],
    },
  ],
}

const replace = metadata.transformations[1]!

const validSnapshot = {
  schemaVersion: 1,
  inputText: 'hello',
  steps: [{ id: 'a', transformationId: 'replace', values: { search: 'l', times: 2 } }],
  fieldTypes: { replace: { search: 'text', times: 'integer' } },
  layout: { mode: 'desktop', positions: { a: { x: 10, y: 20 } }, viewport: { x: 1, y: 2, zoom: 0.5 } },
}

describe('isSessionSnapshot', () => {
  it('accepts a well-formed snapshot, with or without a viewport', () => {
    expect(isSessionSnapshot(validSnapshot)).toBe(true)
    expect(isSessionSnapshot({ ...validSnapshot, layout: { ...validSnapshot.layout, viewport: null } })).toBe(true)
  })

  it.each([
    ['not an object', 'untouched saved work'],
    ['null', null],
    ['another schema version', { ...validSnapshot, schemaVersion: 2 }],
    ['non-string input text', { ...validSnapshot, inputText: 4 }],
    ['steps that are not an array', { ...validSnapshot, steps: {} }],
    ['a Step without values', { ...validSnapshot, steps: [{ id: 'a', transformationId: 'replace' }] }],
    ['a Field value that is an object', { ...validSnapshot, steps: [{ id: 'a', transformationId: 'replace', values: { search: {} } }] }],
    ['an unknown Field type', { ...validSnapshot, fieldTypes: { replace: { search: 'date' } } }],
    ['an unknown layout mode', { ...validSnapshot, layout: { ...validSnapshot.layout, mode: 'tablet' } }],
    ['a position without y', { ...validSnapshot, layout: { ...validSnapshot.layout, positions: { a: { x: 1 } } } }],
    ['a viewport with zero zoom', { ...validSnapshot, layout: { ...validSnapshot.layout, viewport: { x: 0, y: 0, zoom: 0 } } }],
  ])('rejects %s', (_name, value) => {
    expect(isSessionSnapshot(value)).toBe(false)
  })
})

describe('restoreSession', () => {
  const stored = (snapshot: unknown) => JSON.stringify(snapshot)

  it('has nothing to restore when nothing is stored', () => {
    expect(restoreSession(null, metadata, 'desktop')).toEqual({ status: 'none' })
  })

  it('brings back Input text, Steps, Field values, positions and viewport in the same layout mode', () => {
    expect(restoreSession(stored(validSnapshot), metadata, 'desktop')).toEqual({
      status: 'restored',
      inputText: 'hello',
      contentCheck: false,
      steps: [{ id: 'a', transformationId: 'replace', values: { search: 'l', times: 2 } }],
      positions: { a: { x: 10, y: 20 } },
      viewport: { x: 1, y: 2, zoom: 0.5 },
      adjustments: [],
    })
  })

  it('lays out afresh when the layout mode differs', () => {
    const restored = restoreSession(stored(validSnapshot), metadata, 'phone')
    expect(restored).toMatchObject({ status: 'restored', positions: {}, viewport: null })
  })

  it('gives an added Field its default, or leaves it unset without one, and lists it', () => {
    const current: Metadata = {
      ...metadata,
      transformations: [{
        ...replace,
        fields: [
          ...replace.fields,
          { name: 'note', label: 'Note', type: 'text', required: false, defaultValue: 'hi', min: null, max: null, options: null },
          { name: 'limit', label: 'Limit', type: 'integer', required: false, defaultValue: null, min: null, max: null, options: null },
        ],
      }],
    }
    expect(restoreSession(stored(validSnapshot), current, 'desktop')).toMatchObject({
      status: 'restored',
      steps: [{ id: 'a', values: { search: 'l', times: 2, note: 'hi', limit: null } }],
      adjustments: ['Replace: added Note and Limit.'],
    })
  })

  it('drops a removed Field, treats a renamed Field as a removal plus an addition, and lists both', () => {
    const current: Metadata = {
      ...metadata,
      transformations: [{
        ...replace,
        fields: [
          { name: 'find', label: 'Find', type: 'text', required: true, defaultValue: '', min: null, max: null, options: null },
        ],
      }],
    }
    const restored = restoreSession(stored(validSnapshot), current, 'desktop')
    expect(restored).toMatchObject({ status: 'restored', adjustments: ['Replace: added Find; removed search and times.'] })
    expect(restored.status === 'restored' && restored.steps[0]?.values).toEqual({ find: '' })
  })

  it('keeps a value that no longer fits the rules, including a removed Choice', () => {
    const current: Metadata = {
      ...metadata,
      transformations: [{
        id: 'pick', label: 'Pick', description: '',
        fields: [
          { name: 'size', label: 'Size', type: 'integer', required: true, defaultValue: 1, min: 5, max: null, options: null },
          { name: 'mode', label: 'Mode', type: 'select', required: true, defaultValue: 'a', min: null, max: null, options: [{ value: 'a', label: 'A' }] },
        ],
      }],
    }
    const snapshot = {
      ...validSnapshot,
      steps: [{ id: 'a', transformationId: 'pick', values: { size: 2, mode: 'gone' } }],
      fieldTypes: { pick: { size: 'integer', mode: 'select' } },
    }
    expect(restoreSession(stored(snapshot), current, 'desktop')).toMatchObject({
      status: 'restored',
      steps: [{ id: 'a', values: { size: 2, mode: 'gone' } }],
      adjustments: [],
    })
  })

  it('restores a session over the current limits in full', () => {
    const steps = Array.from({ length: 7 }, (_, index) => ({ id: `s${index}`, transformationId: 'uppercase', values: {} }))
    const snapshot = { ...validSnapshot, inputText: 'x'.repeat(1500), steps, fieldTypes: { uppercase: {} } }
    const restored = restoreSession(stored(snapshot), metadata, 'desktop')
    expect(restored).toMatchObject({ status: 'restored', inputText: 'x'.repeat(1500) })
    expect(restored.status === 'restored' && restored.steps).toHaveLength(7)
  })

  it('is blocked by a missing Transformation, naming it', () => {
    const snapshot = {
      ...validSnapshot,
      steps: [...validSnapshot.steps, { id: 'b', transformationId: 'vanished', values: {} }],
      fieldTypes: { ...validSnapshot.fieldTypes, vanished: {} },
    }
    expect(restoreSession(stored(snapshot), metadata, 'desktop')).toEqual({
      status: 'blocked',
      reason: 'Your saved Chain uses the Transformation “vanished”, which is no longer available.',
    })
  })

  it('is blocked by a Field whose type changed', () => {
    const snapshot = { ...validSnapshot, fieldTypes: { replace: { search: 'text', times: 'text' } } }
    expect(restoreSession(stored(snapshot), metadata, 'desktop')).toEqual({
      status: 'blocked',
      reason: 'The Field “Times” of Replace changed from text to integer since you saved.',
    })
  })

  it.each([
    ['unreadable JSON', 'untouched saved work'],
    ['a snapshot that fails the guard', stored({ ...validSnapshot, inputText: 4 })],
    ['a Step without its Field types', stored({ ...validSnapshot, fieldTypes: {} })],
    ['duplicate Step ids', stored({ ...validSnapshot, steps: [validSnapshot.steps[0], validSnapshot.steps[0]] })],
  ])('is blocked by %s', (_name, value) => {
    expect(restoreSession(value, metadata, 'desktop')).toEqual({
      status: 'blocked',
      reason: 'The saved session is damaged and can’t be read.',
    })
  })

  it('is blocked by an unknown schema version', () => {
    expect(restoreSession(stored({ ...validSnapshot, schemaVersion: 2 }), metadata, 'desktop')).toEqual({
      status: 'blocked',
      reason: 'The saved session comes from another version of the app (schema version 2).',
    })
  })
})

const readSession = () => JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as SessionSnapshot | null

describe('saving the session', () => {
  let store: Record<string, string>
  let setItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    store = {}
    setItem = vi.fn((key: string, value: string) => { store[key] = value })
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => store[key] ?? null, setItem })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function setup() {
    const chain = reactive<Chain>({ inputText: '', contentCheck: false, steps: [] })
    const layout = reactive<Layout>({ mode: 'desktop', positions: {}, viewport: null })
    const phase = ref('loading')
    const metadataRef = ref<typeof metadata | null>(metadata)
    const { saveFailed } = useSessionSaving({ chain, layout, metadata: metadataRef, phase })
    const settle = () => vi.advanceTimersByTimeAsync(0)
    return { chain, layout, phase, saveFailed, settle }
  }

  it('saves nothing before ready, however the Chain changes', async () => {
    const { chain, layout, settle } = setup()
    chain.inputText = 'typed'
    chain.steps.push({ id: 'a', transformationId: 'uppercase', values: {} })
    layout.positions = { a: { x: 1, y: 1 } }
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('saves once on reaching ready', async () => {
    const { phase, settle } = setup()
    phase.value = 'ready'
    await settle()
    await vi.advanceTimersByTimeAsync(1000)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(readSession()).toMatchObject({ schemaVersion: 1, inputText: '', steps: [] })
  })

  it('saves Step changes and layout at once', async () => {
    const { chain, layout, phase, settle } = setup()
    phase.value = 'ready'
    await settle()
    setItem.mockClear()

    chain.steps.push({ id: 'a', transformationId: 'uppercase', values: {} })
    await settle()
    expect(readSession()?.steps.map((step) => step.id)).toEqual(['a'])

    layout.positions = { a: { x: 5, y: 6 } }
    await settle()
    expect(readSession()?.layout.positions).toEqual({ a: { x: 5, y: 6 } })
  })

  it('saves typing only after 300 ms of quiet', async () => {
    const { chain, phase, settle } = setup()
    phase.value = 'ready'
    await settle()
    setItem.mockClear()

    chain.inputText = 'h'
    await vi.advanceTimersByTimeAsync(299)
    expect(setItem).not.toHaveBeenCalled()
    chain.inputText = 'he'
    await vi.advanceTimersByTimeAsync(299)
    expect(setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(readSession()?.inputText).toBe('he')
  })

  it('saves Field values after 300 ms, and the Field types of only the Transformations in use', async () => {
    const { chain, phase, settle } = setup()
    chain.steps.push({ id: 'a', transformationId: 'replace', values: { search: '', times: 1 } })
    phase.value = 'ready'
    await settle()
    setItem.mockClear()

    chain.steps[0]!.values.search = 'x'
    await vi.advanceTimersByTimeAsync(299)
    expect(setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(readSession()?.steps[0]?.values.search).toBe('x')
    expect(readSession()?.fieldTypes).toEqual({ replace: { search: 'text', times: 'integer' } })
  })

  it('flushes a pending typing save when the page is hidden', async () => {
    const { chain, phase, settle } = setup()
    phase.value = 'ready'
    await settle()
    chain.inputText = 'pending'
    await settle()
    expect(readSession()?.inputText).toBe('')

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(readSession()?.inputText).toBe('pending')
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('flushes a pending typing save on pagehide', async () => {
    const { chain, phase, settle } = setup()
    phase.value = 'ready'
    await settle()
    chain.inputText = 'leaving'
    await settle()

    window.dispatchEvent(new Event('pagehide'))
    expect(readSession()?.inputText).toBe('leaving')
  })
  it('reports a failed write and keeps saving once writes work again', async () => {
    const { chain, phase, saveFailed, settle } = setup()
    setItem.mockImplementationOnce(() => { throw new DOMException('full', 'QuotaExceededError') })
    phase.value = 'ready'
    await settle()
    expect(saveFailed.value).toBe(true)

    chain.steps.push({ id: 'a', transformationId: 'uppercase', values: {} })
    await settle()
    expect(saveFailed.value).toBe(false)
    expect(store[SESSION_KEY]).toBeDefined()
  })
})

describe('Content check in the Saved session', () => {
  it('saves and restores the switch when available, but disables it without a key', () => {
    const chain: Chain = { inputText: 'hello', contentCheck: true, steps: [] }
    const layout: Layout = { mode: 'desktop', positions: {}, viewport: null }
    const snapshot = buildSnapshot(chain, layout, metadata)
    expect(snapshot.contentCheck).toBe(true)
    expect(restoreSession(JSON.stringify(snapshot), metadata, 'desktop'))
      .toMatchObject({ status: 'restored', contentCheck: true })
    expect(restoreSession(JSON.stringify(snapshot), { ...metadata, contentCheck: { available: false } }, 'desktop'))
      .toMatchObject({ status: 'restored', contentCheck: false })
  })

  it('defaults older Saved sessions to off and rejects a malformed switch', () => {
    expect(restoreSession(JSON.stringify(validSnapshot), metadata, 'desktop'))
      .toMatchObject({ status: 'restored', contentCheck: false })
    expect(isSessionSnapshot({ ...validSnapshot, contentCheck: 'true' })).toBe(false)
  })
})

describe('buildSnapshot', () => {
  it('writes a snapshot that passes the guard', () => {
    const chain: Chain = { inputText: 'x', contentCheck: false, steps: [{ id: 'a', transformationId: 'uppercase', values: {} }] }
    const layout: Layout = { mode: 'phone', positions: {}, viewport: null }
    expect(isSessionSnapshot(buildSnapshot(chain, layout, metadata))).toBe(true)
  })
})
