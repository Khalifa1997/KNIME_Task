// Running a Chain, as plain state that App.vue holds and these functions update.
import type { FieldValue, RunRequest, RunResponse } from './api/types'

export interface Chain {
  inputText: string
  steps: { id: string; transformationId: string; values: Record<string, FieldValue> }[]
}

export interface RunState {
  status: 'idle' | 'running' | 'ok' | 'failed'
  output: string
  results: Record<string, string>
  detail: string
  // The serialized request of the last run that was sent; "Changed" compares against it.
  sentRequest: string | null
  // Counts runs, so the response of a superseded run is dropped.
  sequence: number
}

export function createRunState(): RunState {
  return { status: 'idle', output: '', results: {}, detail: '', sentRequest: null, sequence: 0 }
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
  if (run.status === 'running') return { text: 'Running…', dimmed: true }
  if (run.status === 'idle') return { text: 'Not run yet', dimmed: false }
  if (run.status === 'failed') return { text: run.detail, dimmed: true }
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
  try {
    const response = await send(request)
    if (sequence !== run.sequence) return
    run.status = 'ok'
    run.output = response.output
    run.results = Object.fromEntries(response.steps.map((step) => [step.id, step.output]))
    run.sentRequest = JSON.stringify(request)
    run.detail = ''
  } catch (error) {
    console.error(error)
    if (sequence !== run.sequence) return
    // Failure messages by cause come with the Run failure work; the previous results stay.
    run.status = 'failed'
    run.detail = 'Something went wrong.'
  }
}
