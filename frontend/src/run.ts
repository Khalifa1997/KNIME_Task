import { RunFailure, RunRejected } from './api/run'
// Running a Chain, as plain state that App.vue holds and these functions update.
import type { FieldValue, RunError, RunRequest, RunResponse } from './api/types'

export interface Chain {
  inputText: string
  steps: { id: string; transformationId: string; values: Record<string, FieldValue> }[]
}

export interface RunState {
  status: 'idle' | 'running' | 'ok' | 'rejected' | 'failed'
  slow: boolean
  output: string
  results: Record<string, string>
  errors: RunError[]
  detail: string
  // The serialized request of the last run that was sent; "Changed" compares against it.
  sentRequest: string | null
  // Counts runs, so the response of a superseded run is dropped.
  sequence: number
}

export function createRunState(): RunState {
  return { status: 'idle', slow: false, output: '', results: {}, errors: [], detail: '', sentRequest: null, sequence: 0 }
}

export function requestOf(chain: Chain): RunRequest {
  return {
    inputText: chain.inputText,
    steps: chain.steps.map(({ id, transformationId, values }) => ({
      id,
      transformationId,
      values: { ...values },
    })),
  }
}

export function runStatus(run: RunState, current: RunRequest): { text: string; dimmed: boolean } {
  if (run.status === 'running') return { text: run.slow ? 'Still running…' : 'Running…', dimmed: true }
  if (run.status === 'idle') return { text: 'Not run yet', dimmed: false }
  if (run.status === 'rejected') return { text: run.detail, dimmed: false }
  if (run.status === 'failed') return { text: run.detail + ' Try again', dimmed: true }
  const changed = JSON.stringify(current) !== run.sentRequest
  return changed
    ? { text: 'Changed since the last run', dimmed: true }
    : { text: 'Up to date', dimmed: false }
}

export async function executeRun(
  run: RunState,
  chain: Chain,
  send: (request: RunRequest) => Promise<RunResponse>,
): Promise<void> {
  if (run.status === 'running') return
  const request = requestOf(chain)
  const sequence = ++run.sequence
  run.status = 'running'
  run.slow = false
  const slowTimer = setTimeout(() => {
    if (sequence === run.sequence && run.status === 'running') run.slow = true
  }, 5_000)
  try {
    const response = await send(request)
    if (sequence !== run.sequence) return
    run.status = 'ok'
    run.output = response.output
    run.results = Object.fromEntries(response.steps.map((step) => [step.id, step.output]))
    run.sentRequest = JSON.stringify(request)
    run.detail = ''
    run.errors = []
  } catch (error) {
    if (sequence !== run.sequence) return
    if (error instanceof RunRejected) {
      run.status = 'rejected'
      run.errors = error.problem.errors
      run.detail = error.problem.detail
      run.output = ''
      run.results = {}
      run.sentRequest = JSON.stringify(request)
      return
    }
    run.status = 'failed'
    run.detail = error instanceof RunFailure ? error.message : 'Something went wrong.'
  } finally {
    clearTimeout(slowTimer)
    if (sequence === run.sequence) run.slow = false
  }
}
