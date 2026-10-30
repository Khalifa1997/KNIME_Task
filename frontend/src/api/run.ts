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

export async function postRun(request: RunRequest): Promise<RunResponse> {
  const response = await fetch('/api/chain/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
  })
  if (response.status === 422) {
    const body: unknown = await response.json()
    if (response.headers.get('content-type')?.split(';')[0] === 'application/problem+json' && isRunProblem(body)) {
      throw new RunRejected(body)
    }
    throw new Error('POST /api/chain/run returned an unexpected body')
  }
  if (!response.ok) {
    throw new Error(`POST /api/chain/run failed with ${response.status}`)
  }
  const body: unknown = await response.json()
  if (!isRunResponse(body)) {
    throw new Error('POST /api/chain/run returned an unexpected body')
  }
  return body
}
