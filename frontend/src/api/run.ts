import type { RunRequest, RunResponse } from './types'

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

export async function postRun(request: RunRequest): Promise<RunResponse> {
  const response = await fetch('/api/chain/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`POST /api/chain/run failed with ${response.status}`)
  }
  const body: unknown = await response.json()
  if (!isRunResponse(body)) {
    throw new Error('POST /api/chain/run returned an unexpected body')
  }
  return body
}
