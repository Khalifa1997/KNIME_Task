<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import { fetchMetadata } from './api/metadata'
import { postRun } from './api/run'
import type { Metadata } from './api/types'
import ChainCanvas from './components/ChainCanvas.vue'
import { PHONE_QUERY, type Layout } from './layout'
import { createRunState, executeRun, requestOf, runStatus, type Chain } from './run'

const metadata = ref<Metadata | null>(null)
const chain = reactive<Chain>({ inputText: '', steps: [] })
const isPhone = useMediaQuery(PHONE_QUERY)
const layout = reactive<Layout>({
  mode: isPhone.value ? 'phone' : 'desktop',
  positions: {},
  viewport: null,
})
const run = reactive(createRunState())
const canvas = ref<InstanceType<typeof ChainCanvas> | null>(null)

onMounted(async () => {
  try {
    metadata.value = await fetchMetadata()
  } catch (error) {
    // The loading and error screen comes with the metadata gate.
    console.error(error)
  }
})

// Crossing the breakpoint keeps the Chain but lays it out afresh for the new mode.
watch(isPhone, (phone) => {
  layout.mode = phone ? 'phone' : 'desktop'
  layout.positions = {}
  layout.viewport = null
})

const canAddStep = computed(
  () => metadata.value !== null && chain.steps.length < metadata.value.limits.maxSteps,
)

function addStep(transformationId: string) {
  const meta = metadata.value?.transformations.find((t) => t.id === transformationId)
  if (!meta || !canAddStep.value) return
  const values = Object.fromEntries(meta.fields.map((field) => [field.name, field.defaultValue]))
  const id = crypto.randomUUID()
  chain.steps.push({ id, transformationId, values })
  nextTick(() => canvas.value?.reveal(id))
}

const status = computed(() => runStatus(run, requestOf(chain)))
const statusState = computed(() => {
  if (run.status === 'ok') return status.value.dimmed ? 'changed' : 'ok'
  return run.status
})

function startRun() {
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
        v-if="metadata"
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
            v-for="transformation in metadata.transformations"
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
        v-if="metadata"
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
    <main class="workspace">
      <ChainCanvas
        v-if="metadata"
        ref="canvas"
        :chain="chain"
        :layout="layout"
        :transformations="metadata.transformations"
        :max-input-length="metadata.limits.maxInputLength"
        :run="run"
        :dimmed="status.dimmed"
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
  display: grid;
  grid-template: auto 1fr / minmax(0, 1fr);
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
  min-height: 0;
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
