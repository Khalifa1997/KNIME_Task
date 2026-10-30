import { RunFailure, RunRejected } from '../api/run'
import fixture from '../../../contract/post-chain-run.two-broken-steps.422.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunRequest, RunResponse } from '../api/types'
import { createRunState, executeRun, requestOf, runStatus, type Chain } from '../run'

const UPPER = '3f2b8c1e-6a4d-4e0b-9d57-1c2a7e5f9b01'
const LOWER = '8d1e4a7c-2b95-4c36-a0f8-5e9d3b6c7a02'

const problem = {
  ...fixture, type: 'about:blank', status: 422, title: 'Chain could not run',
  errors: fixture.errors.map((error, index) => ({ ...error, stepId: index === 0 ? UPPER : LOWER })),
} as const

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

it('drops deleted ids from a pending response while retaining live results and Output', async () => {
  const run = createRunState()
  const chain = chainOf()
  let finish!: (value: RunResponse) => void
  const pending = executeRun(run, chain, () => new Promise((resolve) => { finish = resolve }))
  chain.steps.splice(0, 1)
  finish(response)
  await pending
  expect(run.results).toEqual({ [LOWER]: 'hello world' })
  expect(run.output).toBe('hello world')
  expect(status(run, chain)).toBe('Changed since the last run')
})

it('keeps pending results keyed by id through reorder and restores current status on undo', async () => {
  const run = createRunState()
  const chain = chainOf()
  let finish!: (value: RunResponse) => void
  const pending = executeRun(run, chain, () => new Promise((resolve) => { finish = resolve }))
  chain.steps.reverse()
  finish(response)
  await pending
  expect(run.results).toEqual({ [UPPER]: 'HELLO WORLD', [LOWER]: 'hello world' })
  expect(status(run, chain)).toBe('Changed since the last run')
  chain.steps.reverse()
  expect(status(run, chain)).toBe('Up to date')
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
    expect(run.output).toBeUndefined()
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

it('prunes deleted Step errors from a pending rejection but retains Input and live Step errors through reorder', async () => {
  const run = createRunState()
  const chain = chainOf()
  const inputError = { stepId: null, field: null, code: 'input-too-long', detail: 'Input is too long.' }
  let reject!: (reason: RunRejected) => void
  const pending = executeRun(run, chain, () => new Promise((_resolve, fail) => { reject = fail }))
  chain.steps.reverse()
  chain.steps = chain.steps.filter((step) => step.id !== UPPER)
  reject(new RunRejected({ ...problem, errors: [...problem.errors, inputError] }))
  await pending
  expect(run.errors).toEqual([problem.errors[1], inputError])
  expect(run.sentRequest).toBe(JSON.stringify(requestOf(chainOf())))
  expect(run.detail).toBe(problem.detail)
})

it.each(['before', 'after'])('keeps Output unavailable when the last errored Step is deleted %s rejection', async (timing) => {
  const run = createRunState()
  const chain: Chain = {
    inputText: 'a',
    steps: [{ id: UPPER, transformationId: 'replace', values: { search: '', replacement: '' } }],
  }
  // A rejected run must also discard Output from a previous successful run.
  await executeRun(run, chain, async () => response)
  let reject!: (reason: RunRejected) => void
  const pending = executeRun(run, chain, () => new Promise((_resolve, fail) => { reject = fail }))
  const deleteStep = () => {
    chain.steps = []
    run.errors = run.errors.filter((error) => error.stepId !== UPPER)
  }
  if (timing === 'before') deleteStep()
  reject(new RunRejected({ ...problem, errors: [problem.errors[0]!] }))
  await pending
  if (timing === 'after') deleteStep()
  expect(run.errors).toEqual([])
  expect(run.output).toBeUndefined()
})

it('distinguishes a successful empty Output from unavailable Output', async () => {
  const run = createRunState()
  expect(run.output).toBeUndefined()
  await executeRun(run, { inputText: '', steps: [] }, async () => ({ output: '', steps: [] }))
  expect(run.output).toBe('')
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

describe('which edges flash after a run', () => {
  const INPUT_TO_UPPER = 'input->' + UPPER
  const UPPER_TO_LOWER = `${UPPER}->${LOWER}`
  const LOWER_TO_OUTPUT = `${LOWER}->output`
  const stepError = (stepId: string | null) => ({ stepId, field: null, code: 'x', detail: 'bad' })
  const reject = (...errors: ReturnType<typeof stepError>[]) => async () => {
    throw new RunRejected({ ...problem, errors })
  }

  it('flashes nothing before a run and nothing while running', async () => {
    const run = createRunState()
    expect(run.flash).toBeNull()
    await executeRun(run, chainOf(), async () => response)
    const pending = executeRun(run, chainOf(), () => new Promise(() => {}))
    expect(run.flash).toBeNull()
    void pending
  })

  it('flashes every edge on success', async () => {
    const run = createRunState()
    await executeRun(run, chainOf(), async () => response)
    expect(run.flash).toEqual({ kind: 'success', edgeIds: [INPUT_TO_UPPER, UPPER_TO_LOWER, LOWER_TO_OUTPUT] })
  })

  it('flashes red from Input text up to the edge entering the first failing Step', async () => {
    const run = createRunState()
    await executeRun(run, chainOf(), reject(stepError(LOWER)))
    expect(run.flash).toEqual({ kind: 'danger', edgeIds: [INPUT_TO_UPPER, UPPER_TO_LOWER] })
    await executeRun(run, chainOf(), reject(stepError(LOWER), stepError(UPPER)))
    expect(run.flash).toEqual({ kind: 'danger', edgeIds: [INPUT_TO_UPPER] })
  })

  it('ignores a failing Step that was deleted while the run was pending', async () => {
    const run = createRunState()
    const chain = chainOf()
    let fail!: (reason: RunRejected) => void
    const pending = executeRun(run, chain, () => new Promise((_resolve, rejectRun) => { fail = rejectRun }))
    chain.steps.splice(0, 1)
    fail(new RunRejected({ ...problem, errors: [stepError(UPPER), stepError(LOWER)] }))
    await pending
    expect(run.flash).toEqual({ kind: 'danger', edgeIds: [`input->${LOWER}`] })
  })

  it('makes the fill vanish with no red for Input errors alone and for Run failures', async () => {
    const run = createRunState()
    await executeRun(run, chainOf(), reject(stepError(null)))
    expect(run.flash).toBeNull()
    await executeRun(run, chainOf(), async () => { throw new RunFailure('network') })
    expect(run.flash).toBeNull()
    await executeRun(run, chainOf(), async () => response)
    await executeRun(run, chainOf(), async () => { throw new RunFailure('network') })
    expect(run.flash).toBeNull()
  })

  it('restarts the flash on each run by clearing it while running', async () => {
    const run = createRunState()
    await executeRun(run, chainOf(), async () => response)
    const first = run.flash
    await executeRun(run, chainOf(), async () => response)
    expect(run.flash).not.toBe(first)
    expect(run.flash).toEqual(first)
  })
})
