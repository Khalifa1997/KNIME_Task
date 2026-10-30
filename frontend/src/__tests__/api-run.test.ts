import { afterEach, describe, expect, it, vi } from 'vitest'
import { postRun, RunFailure, RunRejected } from '../api/run'
import problem from '../../../contract/post-chain-run.two-broken-steps.422.json'
import request from '../../../contract/post-chain-run.two-broken-steps.request.json'
import success from '../../../contract/post-chain-run.200.json'

afterEach(() => vi.unstubAllGlobals())
function respond(body: unknown, status = 422, contentType = 'application/problem+json') {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': contentType },
  }))))
}

describe('POST Chain contract', () => {
  it('distinguishes a validated shared 422 fixture without logging an error', async () => {
    respond(problem)
    await expect(postRun(request)).rejects.toMatchObject({ problem })
    await expect(postRun(request)).rejects.toBeInstanceOf(RunRejected)
  })
  it.each([
    { ...problem, errors: [] },
    { ...problem, status: 400 },
    { ...problem, errors: [{ ...problem.errors[0], field: 2 }] },
    { ...problem, errors: [{ ...problem.errors[0], stepId: null }] },
    { ...problem, errors: [{ ...problem.errors[0], detail: null }] },
    { ...problem, errors: [{ ...problem.errors[0], code: null }] },
  ])('does not trust a malformed 422: %j', async (body) => {
    respond(body)
    await expect(postRun(request)).rejects.not.toBeInstanceOf(RunRejected)
  })
  it('requires problem media type', async () => {
    respond(problem, 422, 'application/json')
    await expect(postRun(request)).rejects.not.toBeInstanceOf(RunRejected)
  })
  it('keeps unknown string codes', async () => {
    respond({ ...problem, errors: [{ ...problem.errors[0], code: 'future-code' }] })
    await expect(postRun(request)).rejects.toMatchObject({ problem: { errors: [{ code: 'future-code' }] } })
  })
  it('keeps the success contract', async () => {
    respond(success, 200, 'application/json')
    await expect(postRun(request)).resolves.toEqual(success)
  })
  it('rejects unexpected success bodies and non-422 responses', async () => {
    respond({}, 200, 'application/json')
    await expect(postRun(request)).rejects.toThrow('Something went wrong.')
    respond({}, 500)
    await expect(postRun(request)).rejects.not.toBeInstanceOf(RunRejected)
  })
})


describe('Run failure classification and success guard', () => {
  it.each([
    null, [], {}, { output: 1, steps: [] }, { output: '', steps: null },
    ...[null, 1, 'step', {}, { id: 1, output: '' }, { id: '', output: null }, { output: '' }, { id: '' }].map(step => ({ output: '', steps: [step] })),
  ])('rejects malformed 200 %j', async (body) => {
    respond(body, 200)
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'unexpected', message: 'Something went wrong.' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('accepts empty strings and empty Steps', async () => {
    respond({ output: '', steps: [] }, 200)
    await expect(postRun(request)).resolves.toEqual({ output: '', steps: [] })
    respond({ output: '', steps: [{ id: '', output: '' }] }, 200)
    await expect(postRun(request)).resolves.toEqual({ output: '', steps: [{ id: '', output: '' }] })
  })
  it.each([400, 404, 503, 201])('classifies HTTP %s as unexpected', async status => {
    respond({}, status)
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'unexpected' })
  })
  it('classifies 500 without trusting its body', async () => {
    respond('private server detail', 500)
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'server', message: 'The server had a problem.' })
  })
  it.each([new TypeError('offline'), new DOMException('timeout', 'TimeoutError')])('classifies fetch failure as unreachable', async error => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'network', message: "Couldn't reach the server." })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([200, 422])('does not classify malformed JSON on %s as unreachable', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status })))
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'unexpected' })
  })
  it('uses a 90s signal and classifies timeout during body read', async () => {
    const signal = new AbortController().signal
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, json: () => Promise.reject(new DOMException('aborted', 'AbortError')) }))
    await expect(postRun(request)).rejects.toBeInstanceOf(RunFailure)
    await expect(postRun(request)).rejects.toMatchObject({ kind: 'network' })
    expect(timeout).toHaveBeenCalledWith(90_000)
    expect(fetch).toHaveBeenCalledWith('/api/chain/run', expect.objectContaining({ signal }))
    timeout.mockRestore()
  })
})
