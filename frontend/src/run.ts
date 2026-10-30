import { INPUT_ID, OUTPUT_ID, edgeIdOf } from './layout'
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
  // Undefined until a successful run, or after a rejection clears previous Output.
  output: string | undefined
  results: Record<string, string>
  errors: RunError[]
  detail: string
  // The serialized request of the last run that was sent; "Changed" compares against it.
  sentRequest: string | null
  // Counts runs, so the response of a superseded run is dropped.
  sequence: number
  // Null while running and after anything but a success or a Step error.
  flash: RunFlash | null
}

// The edges that flash when a run ends: all of them on success, red up to the first failing Step.
export interface RunFlash {
  kind: 'success' | 'danger'
  edgeIds: string[]
}

export function createRunState(): RunState {
  return { status: 'idle', slow: false, output: undefined, results: {}, errors: [], detail: '', sentRequest: null, sequence: 0, flash: null }
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

function edgeIdsOf(stepIds: string[]): string[] {
  const nodeIds = [INPUT_ID, ...stepIds, OUTPUT_ID]
  return nodeIds.slice(1).map((target, index) => edgeIdOf(nodeIds[index] as string, target))
}

// The edges from Input text up to the one entering the first failing Step, or null with no Step error.
function dangerFlash(stepIds: string[], errors: RunError[]): RunFlash | null {
  const failing = new Set(errors.map((error) => error.stepId))
  const firstFailing = stepIds.findIndex((id) => failing.has(id))
  if (firstFailing === -1) return null
  return { kind: 'danger', edgeIds: edgeIdsOf(stepIds).slice(0, firstFailing + 1) }
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
  run.flash = null
  const slowTimer = setTimeout(() => {
    if (sequence === run.sequence && run.status === 'running') run.slow = true
  }, 5_000)
  try {
    const response = await send(request)
    if (sequence !== run.sequence) return
    run.status = 'ok'
    run.output = response.output
    const liveIds = new Set(chain.steps.map((step) => step.id))
    run.results = Object.fromEntries(
      response.steps.filter((step) => liveIds.has(step.id)).map((step) => [step.id, step.output]),
    )
    run.sentRequest = JSON.stringify(request)
    run.detail = ''
    run.errors = []
    run.flash = { kind: 'success', edgeIds: edgeIdsOf(chain.steps.map((step) => step.id)) }
  } catch (error) {
    if (sequence !== run.sequence) return
    if (error instanceof RunRejected) {
      run.status = 'rejected'
      const liveIds = new Set(chain.steps.map((step) => step.id))
      run.errors = error.problem.errors.filter((item) => item.stepId === null || liveIds.has(item.stepId))
      run.detail = error.problem.detail
      run.output = undefined
      run.results = {}
      run.sentRequest = JSON.stringify(request)
      run.flash = dangerFlash(chain.steps.map((step) => step.id), run.errors)
      return
    }
    run.status = 'failed'
    run.detail = error instanceof RunFailure ? error.message : 'Something went wrong.'
  } finally {
    clearTimeout(slowTimer)
    if (sequence === run.sequence) run.slow = false
  }
}
