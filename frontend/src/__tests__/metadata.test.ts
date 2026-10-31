import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../contract/get-transformations.200.json'
import { fetchMetadata } from '../api/metadata'

function respond(body: unknown = fixture, status = 200) {
  const fetch = vi.fn().mockResolvedValue({ status, json: async () => body })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchMetadata', () => {
  it('accepts the contract and creates a fresh ten-second signal for each call', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetch = respond()
    await expect(fetchMetadata()).resolves.toEqual(fixture)
    await fetchMetadata()
    expect(timeout.mock.calls).toEqual([[10_000], [10_000]])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[1].signal).not.toBe(fetch.mock.calls[1]?.[1].signal)
  })

  it('omits whole Transformations with unfamiliar string Field types, preserving order', async () => {
    const body = structuredClone(fixture)
    const future = { ...body.transformations[0]!, id: 'future', fields: [{
      name: 'future', label: 'Future', type: 'future', required: false,
      defaultValue: null, min: null, max: null, options: null,
    }] }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    respond({ ...body, transformations: [body.transformations[0], future, ...body.transformations.slice(1)] })
    await expect(fetchMetadata()).resolves.toEqual(fixture)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('future'))
    respond({ ...body, transformations: [future] })
    await expect(fetchMetadata()).resolves.toMatchObject({ transformations: [] })
  })

  it.each([null, [], {}, { ...fixture, limits: { maxInputLength: -1, maxSteps: 1 } },
    { ...fixture, limits: { maxInputLength: 1, maxSteps: Infinity } },
    { ...fixture, limits: { maxInputLength: 1.5, maxSteps: 1 } },
    { ...fixture, transformations: [null] },
    ...['name', 'label', 'type', 'required', 'defaultValue', 'min', 'max', 'options'].map((key) => ({
      ...fixture, transformations: [{ id: 'bad', label: 'Bad', description: '', fields: [{
        name: 'name', label: 'Label', type: 'text', required: true,
        defaultValue: null, min: null, max: null, options: null, [key]: {},
      }] }],
    })),
    { ...fixture, transformations: [{ id: 'bad', label: 'Bad', description: '', fields: [{
      name: 'name', label: 'Label', type: 'select', required: true,
      defaultValue: null, min: null, max: null, options: [{ value: 1, label: 'Bad' }],
    }] }] },
  ])('rejects malformed structure safely: %j', async (body) => {
    respond(body)
    await expect(fetchMetadata()).rejects.toThrow('Something went wrong.')
  })

  it.each([201, 204, 400, 404, 503, 500])('maps HTTP %s without reading raw errors', async (status) => {
    respond('secret backend details', status)
    await expect(fetchMetadata()).rejects.toThrow(status === 500 ? 'The server had a problem.' : 'Something went wrong.')
  })

  it.each([new TypeError('network'), new DOMException('timeout', 'TimeoutError')])('maps fetch rejection', async (error) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    await expect(fetchMetadata()).rejects.toThrow("Couldn't reach the server.")
  })

  it('distinguishes invalid JSON from a timed-out body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: () => Promise.reject(new SyntaxError('secret')) }))
    await expect(fetchMetadata()).rejects.toThrow('Something went wrong.')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: () => Promise.reject(new DOMException('timeout', 'AbortError')) }))
    await expect(fetchMetadata()).rejects.toThrow("Couldn't reach the server.")
  })

  it('maps a disconnected response body to the network reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: () => Promise.reject(new TypeError('connection closed')) }))
    await expect(fetchMetadata()).rejects.toThrow("Couldn't reach the server.")
  })

  it('tolerates additional properties', async () => {
    respond({ ...fixture, future: true })
    await expect(fetchMetadata()).resolves.toEqual(fixture)
  })
})

describe('the Content check in the metadata', () => {
  it('reads whether the server can run the Content check', async () => {
    respond({ ...fixture, contentCheck: { available: true } })
    await expect(fetchMetadata()).resolves.toMatchObject({ contentCheck: { available: true } })
  })

  it('treats a server that does not say as unable to run it', async () => {
    const withoutIt: Partial<typeof fixture> = structuredClone(fixture)
    delete withoutIt.contentCheck
    respond(withoutIt)
    await expect(fetchMetadata()).resolves.toMatchObject({ contentCheck: { available: false } })
  })
})
