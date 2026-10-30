import { RunFailure, RunRejected } from '../api/run'
import fixture from '../../../contract/post-chain-run.two-broken-steps.422.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunRequest, RunResponse } from '../api/types'
import { createRunState, executeRun, requestOf, runStatus, type Chain } from '../run'

const problem = { ...fixture, type: 'about:blank', status: 422, title: 'Chain could not run' } as const

const UPPER = '3f2b8c1e-6a4d-4e0b-9d57-1c2a7e5f9b01'
const LOWER = '8d1e4a7c-2b95-4c36-a0f8-5e9d3b6c7a02'

function chainOf(inputText = 'Hello World'): Chain {
  return {
    inputText,
    steps: [
      { id: UPPER, transformationId: 'uppercase', values: {} },
      { id: LOWER, transformationId: 'lowercase', values: {} },
    ],
  }
}

const response: RunResponse = {
  output: 'hello world',
  steps: [
    { id: UPPER, output: 'HELLO WORLD' },
    { id: LOWER, output: 'hello world' },
  ],
}

const status = (run: ReturnType<typeof createRunState>, chain: Chain) =>
  runStatus(run, requestOf(chain)).text

describe('running a Chain', () => {
  it('says Not run yet before the first run, even after an edit', () => {
    const run = createRunState()
    const chain = chainOf()
    chain.inputText = 'edited'

    expect(status(run, chain)).toBe('Not run yet')
  })

  it('sends the Chain as the request and keeps the Output and each Step result', async () => {
    const run = createRunState()
    const chain = chainOf()
    const send = vi.fn<(request: RunRequest) => Promise<RunResponse>>().mockResolvedValue(response)

    await executeRun(run, chain, send)

    expect(send).toHaveBeenCalledWith({
      inputText: 'Hello World',
      steps: [
        { id: UPPER, transformationId: 'uppercase', values: {} },
        { id: LOWER, transformationId: 'lowercase', values: {} },
      ],
    })
    expect(run.output).toBe('hello world')
    expect(run.results).toEqual({ [UPPER]: 'HELLO WORLD', [LOWER]: 'hello world' })
    expect(status(run, chain)).toBe('Up to date')
  })

  it('says Running… while a run is pending', async () => {
    const run = createRunState()
    const chain = chainOf()
    let finish: (value: RunResponse) => void = () => {}
    const pending = executeRun(run, chain, () => new Promise((resolve) => (finish = resolve)))

    expect(status(run, chain)).toBe('Running…')

    finish(response)
    await pending
    expect(status(run, chain)).toBe('Up to date')
  })

  it('ignores a second run while one is pending', async () => {
    const run = createRunState()
    const chain = chainOf()
    let finish: (value: RunResponse) => void = () => {}
    const send = vi.fn(() => new Promise<RunResponse>((resolve) => (finish = resolve)))

    const first = executeRun(run, chain, send)
    await executeRun(run, chain, send)
    finish(response)
    await first

    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe('whether the results are current', () => {
  it('says Changed since the last run after an edit, and Up to date again when it is undone', async () => {
    const run = createRunState()
    const chain = chainOf()
    await executeRun(run, chain, async () => response)

    chain.inputText = 'Hello Worlds'
    expect(status(run, chain)).toBe('Changed since the last run')

    chain.inputText = 'Hello World'
    expect(status(run, chain)).toBe('Up to date')
  })

  it('counts adding, removing and reordering Steps as a change', async () => {
    const run = createRunState()
    const chain = chainOf()
    await executeRun(run, chain, async () => response)

    chain.steps.reverse()

    expect(status(run, chain)).toBe('Changed since the last run')
  })

  it('compares what was sent, not what is being edited during the run', async () => {
    const run = createRunState()
    const chain = chainOf()
    let finish: (value: RunResponse) => void = () => {}
    const pending = executeRun(run, chain, () => new Promise((resolve) => (finish = resolve)))

    chain.inputText = 'typed while running'
    finish(response)
    await pending

    expect(status(run, chain)).toBe('Changed since the last run')
  })

  it('dims the results while running and while out of date, but not when current', async () => {
    const run = createRunState()
    const chain = chainOf()
    let finish: (value: RunResponse) => void = () => {}
    const pending = executeRun(run, chain, () => new Promise((resolve) => (finish = resolve)))
    expect(runStatus(run, requestOf(chain)).dimmed).toBe(true)

    finish(response)
    await pending
    expect(runStatus(run, requestOf(chain)).dimmed).toBe(false)

    chain.inputText = 'other'
    expect(runStatus(run, requestOf(chain)).dimmed).toBe(true)
  })
})

describe('when the run cannot be carried out', () => {
  it('keeps the previous results and says so', async () => {
    const run = createRunState()
    const chain = chainOf()
    await executeRun(run, chain, async () => response)

    await executeRun(run, chain, async () => {
      throw new Error('network down')
    })

    expect(run.results).toEqual({ [UPPER]: 'HELLO WORLD', [LOWER]: 'hello world' })
    expect(status(run, chain)).toBe('Something went wrong. Try again')
    expect(runStatus(run, requestOf(chain)).dimmed).toBe(true)
  })
})

describe('Step and Input rejection', () => {
  it('clears previews, replaces errors, records the sent snapshot and announces backend detail verbatim', async () => {
    const run = createRunState()
    const chain = chainOf()
    await executeRun(run, chain, async () => response)
    const logged = vi.spyOn(console, 'error')
    await executeRun(run, chain, async () => { throw new RunRejected(problem) })
    expect(logged).not.toHaveBeenCalled()
    logged.mockRestore()
    expect(run.status).toBe('rejected')
    expect(run.results).toEqual({})
    expect(run.output).toBe('')
    expect(run.errors).toEqual(problem.errors)
    expect(run.sentRequest).toBe(JSON.stringify(requestOf(chain)))
    expect(status(run, chain)).toBe(problem.detail)
    await executeRun(run, chain, async () => response)
    expect(run.errors).toEqual([])
  })
  it('preserves errors and results on a non-422 failure', async () => {
    const run = createRunState()
    await executeRun(run, chainOf(), async () => { throw new RunRejected(problem) })
    await executeRun(run, chainOf(), async () => { throw new Error('offline') })
    expect(run.status).toBe('failed')
    expect(run.errors).toEqual(problem.errors)
    expect(run.results).toEqual({})
  })
  it.each(['success', 'rejection', 'failure'])('ignores superseded %s outcomes', async (outcome) => {
    const run = createRunState()
    let finish!: () => void
    const pending = executeRun(run, chainOf(), () => new Promise((resolve, reject) => {
      finish = () => outcome === 'success' ? resolve(response) : reject(outcome === 'rejection' ? new RunRejected(problem) : new Error('offline'))
    }))
    run.sequence++
    const before = structuredClone(run)
    finish()
    await pending
    expect(run).toEqual(before)
  })
})


afterEach(() => vi.useRealTimers())

describe('Run failure lifecycle', () => {
  it.each(['network', 'server', 'unexpected'] as const)('retains prior data for %s without declaring it current', async (kind) => {
    const run = createRunState()
    const chain = chainOf()
    await executeRun(run, chain, async () => response)
    const snapshot = run.sentRequest
    await executeRun(run, chain, async () => { throw new RunFailure(kind) })
    expect(run.output).toBe(response.output)
    expect(run.results[UPPER]).toBe('HELLO WORLD')
    expect(run.sentRequest).toBe(snapshot)
    expect(status(run, chain)).toBe(new RunFailure(kind).message + ' Try again')
    expect(runStatus(run, requestOf(chain)).dimmed).toBe(true)
    await executeRun(run, chain, async () => { throw new RunRejected(problem) })
    await executeRun(run, chain, async () => { throw new RunFailure(kind) })
    expect(run.errors).toEqual(problem.errors)
    expect(run.status).toBe('failed')
  })

  it('announces slow at exactly five seconds, resets and clears every completed timer', async () => {
    vi.useFakeTimers()
    const run = createRunState()
    let finish!: (value: RunResponse) => void
    const pending = executeRun(run, chainOf(), () => new Promise(resolve => { finish = resolve }))
    vi.advanceTimersByTime(4_999)
    expect(status(run, chainOf())).toBe('Running…')
    vi.advanceTimersByTime(1)
    expect(status(run, chainOf())).toBe('Still running…')
    finish(response)
    await pending
    expect(vi.getTimerCount()).toBe(0)
    const earlyFailure = executeRun(run, chainOf(), async () => { throw new RunFailure('network') })
    expect(status(run, chainOf())).toBe('Running…')
    await earlyFailure
    expect(vi.getTimerCount()).toBe(0)
    await executeRun(run, chainOf(), async () => response)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a superseded timer and finally cannot mutate or cancel the newer timer', async () => {
    vi.useFakeTimers()
    const run = createRunState()
    let finishOld!: (value: RunResponse) => void
    let finishNew!: (value: RunResponse) => void
    const old = executeRun(run, chainOf(), () => new Promise(resolve => { finishOld = resolve }))
    vi.advanceTimersByTime(1_000)
    run.status = 'idle'
    const newer = executeRun(run, chainOf(), () => new Promise(resolve => { finishNew = resolve }))
    vi.advanceTimersByTime(4_000)
    expect(run.slow).toBe(false)
    finishOld(response)
    await old
    expect(run.status).toBe('running')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(1_000)
    expect(run.slow).toBe(true)
    finishNew(response)
    await newer
    expect(run.slow).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
