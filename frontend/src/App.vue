<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onKeyStroke, useActiveElement, useMediaQuery } from '@vueuse/core'
import { fetchMetadata } from './api/metadata'
import { postRun } from './api/run'
import type { Metadata } from './api/types'
import ChainCanvas from './components/ChainCanvas.vue'
import { INPUT_ID, PHONE_QUERY, slot, type FocusRequest, type Layout } from './layout'
import { createRunState, executeRun, requestOf, runStatus, type Chain } from './run'
import { hasStoredSession, readSession, restoreSession, useSessionSaving } from './session'

const metadata = ref<Metadata | null>(null)
const phase = ref<'loading' | 'metadata-error' | 'ready'>('loading')
const metadataReason = ref('')
const hasSavedSession = ref(false)
const readyMetadata = computed(() => phase.value === 'ready' ? metadata.value : null)
let metadataLoading = false

async function loadMetadata() {
  if (metadataLoading) return
  metadataLoading = true
  phase.value = 'loading'
  metadataReason.value = ''
  const saved = readSession()
  hasSavedSession.value = hasStoredSession()
  try {
    metadata.value = await fetchMetadata()
    // Restoring brings back the work only; the run status stays Not run yet.
    if (saved) {
      const restored = restoreSession(saved, metadata.value, layout.mode)
      chain.inputText = restored.inputText
      chain.steps = restored.steps
      layout.positions = restored.positions
      layout.viewport = restored.viewport
    }
    phase.value = 'ready'
  } catch (error) {
    metadataReason.value = error instanceof Error ? error.message : 'Something went wrong.'
    phase.value = 'metadata-error'
  } finally {
    metadataLoading = false
  }
}
const chain = reactive<Chain>({ inputText: '', steps: [] })
const isPhone = useMediaQuery(PHONE_QUERY)
const layout = reactive<Layout>({
  mode: isPhone.value ? 'phone' : 'desktop',
  positions: {},
  viewport: null,
})
const run = reactive(createRunState())
const { saveFailed } = useSessionSaving({ chain, layout, metadata, phase })
const focusRequest = ref<FocusRequest | null>(null)
const activeElement = useActiveElement()

function focusNode(id: string, nodeOnly = false) {
  nextTick(() => {
    focusRequest.value = { id, nodeOnly }
  })
}

onMounted(loadMetadata)

// Crossing the breakpoint keeps the Chain but lays it out afresh for the new mode.
watch(isPhone, (phone) => {
  layout.mode = phone ? 'phone' : 'desktop'
  layout.positions = {}
  layout.viewport = null
})

const canAddStep = computed(
  () => readyMetadata.value !== null && chain.steps.length < readyMetadata.value.limits.maxSteps,
)

function addStep(transformationId: string) {
  const meta = metadata.value?.transformations.find((t) => t.id === transformationId)
  if (!meta || !canAddStep.value) return
  const values = Object.fromEntries(meta.fields.map((field) => [field.name, field.defaultValue]))
  const id = crypto.randomUUID()
  chain.steps.push({ id, transformationId, values })
  focusNode(id)
}

const announcement = ref('')
let announcementSequence = 0
function announce(text: string) {
  const sequence = ++announcementSequence
  announcement.value = ''
  nextTick(() => {
    if (sequence === announcementSequence) announcement.value = text
  })
}

function stepLabel(step: Chain['steps'][number]) {
  return metadata.value?.transformations.find((item) => item.id === step.transformationId)?.label
    ?? step.transformationId
}

function deleteStep(id: string) {
  const index = chain.steps.findIndex((step) => step.id === id)
  const step = chain.steps[index]
  if (!step) return
  const label = stepLabel(step)
  const previousId = chain.steps[index - 1]?.id ?? INPUT_ID
  chain.steps.splice(index, 1)
  delete layout.positions[id]
  delete run.results[id]
  run.errors = run.errors.filter((error) => error.stepId !== id)
  const previous = chain.steps[index - 1]
  const next = chain.steps[index]
  announce(`Deleted ${label}. ${previous ? `Step ${index}: ${stepLabel(previous)}` : 'Input text'} now leads into ${next ? `Step ${index + 1}: ${stepLabel(next)}` : 'Output'}.`)
  focusNode(previousId, true)
}

function moveStep(id: string, direction: -1 | 1) {
  const index = chain.steps.findIndex((step) => step.id === id)
  const targetIndex = index + direction
  const step = chain.steps[index]
  const neighbor = chain.steps[targetIndex]
  if (!step || !neighbor || (direction !== -1 && direction !== 1)) return
  const position = { ...(layout.positions[id] ?? slot(index + 1, layout.mode)) }
  const neighborPosition = { ...(layout.positions[neighbor.id] ?? slot(targetIndex + 1, layout.mode)) }
  chain.steps[index] = neighbor
  chain.steps[targetIndex] = step
  layout.positions = { ...layout.positions, [id]: neighborPosition, [neighbor.id]: position }
  announce(`Moved ${stepLabel(step)} to position ${targetIndex + 1} of ${chain.steps.length}.`)
  // Keeps focus on the moved Step unless one of its own buttons already has it.
  nextTick(() => {
    const active = activeElement.value
    if (!(active instanceof HTMLButtonElement) || active.disabled) focusRequest.value = { id, nodeOnly: true }
  })
}

const status = computed(() => runStatus(run, requestOf(chain)))
const statusState = computed(() => {
  if (run.status === 'ok') return status.value.dimmed ? 'changed' : 'ok'
  return run.status
})

function startRun() {
  if (phase.value !== 'ready') return
  void executeRun(run, chain, postRun)
}

// Capture before Vue Flow handles node keys, including inside a Step's Fields.
onKeyStroke('Enter', (event) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    startRun()
  }
}, { target: window, capture: true })
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-header__title">
        <span
          class="app-header__logo"
          aria-hidden="true"
        >◆</span>
        Text Transformer
      </h1>
      <section
        v-if="readyMetadata"
        class="palette"
        aria-labelledby="palette-label"
      >
        <h2
          id="palette-label"
          class="palette__label"
        >
          Add Step
        </h2>
        <ul class="palette__list">
          <li
            v-for="transformation in readyMetadata.transformations"
            :key="transformation.id"
          >
            <button
              type="button"
              class="chip"
              :disabled="!canAddStep"
              :aria-describedby="`palette-description-${transformation.id}`"
              @click="addStep(transformation.id)"
            >
              {{ transformation.label }}
            </button>
            <span
              :id="`palette-description-${transformation.id}`"
              class="visually-hidden"
            >{{ transformation.description }}</span>
          </li>
        </ul>
      </section>
      <div
        v-if="readyMetadata"
        class="run-bar"
      >
        <p
          class="status"
          role="status"
          :data-state="statusState"
        >
          <span
            class="status__dot"
            aria-hidden="true"
          />{{ status.text }}
        </p>
        <button
          type="button"
          class="btn btn--primary"
          :aria-disabled="run.status === 'running'"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          @click="startRun"
        >
          Run
        </button>
      </div>
    </header>
    <div
      id="chain-announcement"
      class="visually-hidden"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ announcement }}
    </div>
    <p
      v-if="saveFailed"
      class="banner"
      role="status"
    >
      Your changes couldn't be saved and may not survive a reload. You can keep editing.
    </p>
    <main class="workspace">
      <p
        v-if="phase === 'loading'"
        class="metadata-loading"
        role="status"
      >
        Loading Transformations…
      </p>
      <section
        v-else-if="phase === 'metadata-error'"
        class="metadata-error"
        role="alert"
        aria-labelledby="metadata-error-title"
      >
        <h2 id="metadata-error-title">
          Couldn't load Transformations
        </h2>
        <p>{{ metadataReason }}</p>
        <p v-if="hasSavedSession">
          Your saved work is kept and will come back once this loads.
        </p>
        <button
          type="button"
          class="btn btn--primary"
          @click="loadMetadata"
        >
          Retry
        </button>
      </section>
      <ChainCanvas
        v-if="readyMetadata"
        :focus-request="focusRequest"
        :chain="chain"
        :layout="layout"
        :transformations="readyMetadata.transformations"
        :max-input-length="readyMetadata.limits.maxInputLength"
        :run="run"
        :dimmed="status.dimmed"
        @delete-step="deleteStep"
        @move-step="moveStep"
        @update:input-text="chain.inputText = $event"
        @update-field="(stepId, name, value) => {
          const step = chain.steps.find((candidate) => candidate.id === stepId)
          if (step) step.values[name] = value
        }"
        @update:positions="layout.positions = { ...layout.positions, ...$event }"
        @update:viewport="layout.viewport = $event"
      />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.5rem 1rem;
  background: #000;
  border-bottom: 1px solid var(--line);
}

.app-header__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-lg);
  white-space: nowrap;
}

.app-header__logo {
  color: var(--accent);
}

.palette {
  display: flex;
  align-items: center;
  gap: 0.5rem 0.75rem;
  flex: 1;
  min-width: 0;
}

.palette__label {
  color: var(--muted-on-dark);
  font-size: var(--text-sm);
  font-weight: 400;
  white-space: nowrap;
}

.palette__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.run-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.workspace {
  display: grid;
  flex: 1;
  min-height: 0;
}

.metadata-loading {
  place-self: center;
  margin: 1rem;
}

.metadata-error {
  place-self: center;
  width: min(30rem, calc(100% - 2rem));
  padding: 1.5rem;
  background: var(--card);
  color: var(--text);
  border-radius: 0.5rem;
}

.metadata-error h2 {
  font-size: var(--text-lg);
  text-box: trim-both cap alphabetic;
}

.metadata-error p {
  margin: 1rem 0;
  font-size: var(--text-md);
  text-box: trim-both cap alphabetic;
}

@media (max-width: 799px) {
  .run-bar {
    justify-content: space-between;
    width: 100%;
    margin-left: 0;
  }

  /* The Add Step buttons stay in one row and scroll sideways. */
  .palette {
    flex: 1 1 100%;
  }

  .palette__list {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }
}
</style>
