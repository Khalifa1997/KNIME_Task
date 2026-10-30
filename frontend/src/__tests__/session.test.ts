import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Metadata } from '../api/types'
import type { Layout } from '../layout'
import type { Chain } from '../run'
import { SESSION_KEY, buildSnapshot, isSessionSnapshot, readSession, restoreSession, useSessionSaving } from '../session'

const metadata: Metadata = {
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
  it('brings back Input text, Steps, Field values, positions and viewport in the same layout mode', () => {
    const restored = restoreSession(validSnapshot as never, metadata, 'desktop')
    expect(restored).toEqual({
      inputText: 'hello',
      steps: [{ id: 'a', transformationId: 'replace', values: { search: 'l', times: 2 } }],
      positions: { a: { x: 10, y: 20 } },
      viewport: { x: 1, y: 2, zoom: 0.5 },
    })
  })

  it('lays out afresh when the layout mode differs', () => {
    const restored = restoreSession(validSnapshot as never, metadata, 'phone')
    expect(restored.positions).toEqual({})
    expect(restored.viewport).toBeNull()
    expect(restored.steps).toHaveLength(1)
  })

  it('drops unknown Transformations and gives a Field whose type changed its default', () => {
    const snapshot = {
      ...validSnapshot,
      steps: [
        { id: 'a', transformationId: 'replace', values: { search: 'l', times: 2 } },
        { id: 'b', transformationId: 'vanished', values: {} },
      ],
      fieldTypes: { replace: { search: 'text', times: 'text' } },
    }
    const restored = restoreSession(snapshot as never, metadata, 'desktop')
    expect(restored.steps).toEqual([{ id: 'a', transformationId: 'replace', values: { search: 'l', times: 1 } }])
  })
})

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
    const chain = reactive<Chain>({ inputText: '', steps: [] })
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

describe('buildSnapshot', () => {
  it('writes a snapshot that passes the guard', () => {
    const chain: Chain = { inputText: 'x', steps: [{ id: 'a', transformationId: 'uppercase', values: {} }] }
    const layout: Layout = { mode: 'phone', positions: {}, viewport: null }
    expect(isSessionSnapshot(buildSnapshot(chain, layout, metadata))).toBe(true)
  })
})
