import type { RunProblem, RunRequest, RunResponse } from './types'

const RUN_TIMEOUT_MS = 90_000

function isRunResponse(body: unknown): body is RunResponse {
  if (typeof body !== 'object' || body === null) return false
  const { output, steps } = body as Record<string, unknown>
  return (
    typeof output === 'string' &&
    Array.isArray(steps) &&
    steps.every(
      (step) =>
        typeof step === 'object' &&
        step !== null &&
        typeof (step as Record<string, unknown>).id === 'string' &&
        typeof (step as Record<string, unknown>).output === 'string',
    )
  )
}

export class RunRejected extends Error {
  constructor(readonly problem: RunProblem) {
    super(problem.detail)
    this.name = 'RunRejected'
  }
}

function isRunProblem(body: unknown): body is RunProblem {
  if (typeof body !== 'object' || body === null) return false
  const problem = body as Record<string, unknown>
  return problem.type === 'about:blank' && problem.status === 422 &&
    problem.title === 'Chain could not run' && typeof problem.detail === 'string' &&
    Array.isArray(problem.errors) && problem.errors.length > 0 &&
    problem.errors.every((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false
      const error = item as Record<string, unknown>
      return (error.stepId === null || typeof error.stepId === 'string') &&
        (error.field === null || typeof error.field === 'string') &&
        (error.stepId !== null || error.field === null) &&
        typeof error.code === 'string' && typeof error.detail === 'string'
    })
}

export type RunFailureKind = 'network' | 'server' | 'unexpected'

export class RunFailure extends Error {
  constructor(readonly kind: RunFailureKind) {
    super(kind === 'network' ? "Couldn't reach the server." : kind === 'server' ? 'The server had a problem.' : 'Something went wrong.')
    this.name = 'RunFailure'
  }
}

export async function postRun(request: RunRequest): Promise<RunResponse> {
  const signal = AbortSignal.timeout(RUN_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch('/api/chain/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch {
    throw new RunFailure('network')
  }
  if (response.status === 500) throw new RunFailure('server')
  if (response.status !== 200 && response.status !== 422) throw new RunFailure('unexpected')
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    const aborted = signal.aborted || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    throw new RunFailure(aborted ? 'network' : 'unexpected')
  }
  if (response.status === 422) {
    if (response.headers.get('content-type')?.split(';')[0] === 'application/problem+json' && isRunProblem(body)) {
      throw new RunRejected(body)
    }
    throw new RunFailure('unexpected')
  }
  if (!isRunResponse(body)) throw new RunFailure('unexpected')
  return body
}
