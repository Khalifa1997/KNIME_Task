import { afterEach, describe, expect, it, vi } from 'vitest'
import { postRun, RunRejected } from '../api/run'
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
    await expect(postRun(request)).rejects.toThrow('unexpected body')
    respond({}, 500)
    await expect(postRun(request)).rejects.not.toBeInstanceOf(RunRejected)
  })
})
