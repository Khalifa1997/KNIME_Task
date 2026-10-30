<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { until, usePreferredReducedMotion } from '@vueuse/core'
import {
  Background,
  Controls,
  VueFlow,
  setupVueFlow,
  useNodesInitialized,
  type Edge,
  type Node,
  type NodeDragEvent,
  type Viewport,
} from '@xyflow/vue'
import type { RunError, FieldValue, TransformationMeta } from '../api/types'
import {
  INPUT_ID,
  OUTPUT_ID,
  handlePositions,
  slot,
  titleIdOf,
  type Layout,
  type Point,
} from '../layout'
import type { Chain, RunState } from '../run'
import InputNode from './InputNode.vue'
import OutputNode from './OutputNode.vue'
import StepNode from './StepNode.vue'

const props = defineProps<{
  chain: Chain
  layout: Layout
  transformations: TransformationMeta[]
  maxInputLength: number
  run: RunState
  dimmed: boolean
}>()

const emit = defineEmits<{
  'update:inputText': [value: string]
  'update:positions': [positions: Record<string, Point>]
  'update:viewport': [viewport: Viewport]
  'update-field': [stepId: string, name: string, value: FieldValue]
}>()

function onUpdateField(stepId: string, name: string, value: FieldValue) {
  emit('update-field', stepId, name, value)
}

const FRAME_PADDING = '48px'

// setupVueFlow creates the store here, for the <VueFlow> below. useVueFlow() would need an ancestor,
// and <VueFlowProvider> casts its absent boolean props to false (no dragging, no focusable nodes).
const { fitView, setViewport, setCenter, getViewport, getNode } = setupVueFlow()
const initialized = useNodesInitialized()
const motionPreference = usePreferredReducedMotion()
const reducedMotion = computed(() => motionPreference.value === 'reduce')

const inputErrors = computed(() => props.run.errors.filter((error) => error.stepId === null).map((error) => error.detail))
const errorsByStepId = computed(() => {
  const byId: Record<string, RunError[]> = {}
  for (const error of props.run.errors) {
    if (error.stepId !== null) (byId[error.stepId] ??= []).push(error)
  }
  return byId
})
const errorPropsByStepId = computed(() => Object.fromEntries(
  Object.entries(errorsByStepId.value).map(([id, errors]) => {
    const fieldErrors: Record<string, string[]> = {}
    for (const error of errors) {
      if (error.field !== null) (fieldErrors[error.field] ??= []).push(error.detail)
    }
    return [id, { invalid: true, fieldErrors, wholeStepErrors: errors.filter((error) => error.field === null).map((error) => error.detail) }]
  }),
))

// Resolve each Step's display props once, rather than searching repeatedly in the slot template.
const stepPropsById = computed(() => {
  const transformationsById = new Map(props.transformations.map((item) => [item.id, item]))
  return Object.fromEntries(props.chain.steps.map((step, index) => {
    const transformation = transformationsById.get(step.transformationId)
    return [step.id, {
      invalid: false,
      fieldErrors: {},
      wholeStepErrors: [],
      ...errorPropsByStepId.value[step.id],
      stepId: step.id,
      index,
      label: transformation?.label ?? step.transformationId,
      fields: transformation?.fields ?? [],
      values: step.values,
    }]
  }))
})

// Chain order: Input text, every Step, Output. The nodes array keeps this order for Tab order.
const ends = computed(() => handlePositions(props.layout.mode))
const ids = computed(() => [INPUT_ID, ...props.chain.steps.map((step) => step.id), OUTPUT_ID])

// `input` and `output` are Vue Flow's built-in node types, so ours use other names.
const typeOf = (id: string) =>
  id === INPUT_ID ? 'inputtext' : id === OUTPUT_ID ? 'outputtext' : 'step'

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

watch(
  [ids, () => props.layout.positions, () => props.layout.mode],
  () => {
    const existing = new Map(nodes.value.map((node) => [node.id, node]))
    nodes.value = ids.value.map(
      (id, index) =>
        ({
          ...existing.get(id),
          id,
          type: typeOf(id),
          position: props.layout.positions[id] ?? slot(index, props.layout.mode),
          sourcePosition: ends.value.source,
          targetPosition: ends.value.target,
          // Vue Flow never applies `ariaRole`, so the role goes in through domAttributes.
          domAttributes: { role: 'group', 'aria-labelledby': titleIdOf(id) },
          data: {},
        }) as Node,
    )
  },
  { immediate: true },
)

// How screen readers name the node at `index` in Chain order; Vue Flow would read out the ids.
const spokenName = (index: number) =>
  index === 0 ? 'Input text' : index === ids.value.length - 1 ? 'Output' : `Step ${index}`

watch(
  [ids, reducedMotion],
  () => {
    edges.value = ids.value.slice(1).map((target, index) => ({
      id: `${ids.value[index]}->${target}`,
      source: ids.value[index] as string,
      target,
      ariaLabel: `${spokenName(index)} to ${spokenName(index + 1)}`,
      animated: !reducedMotion.value,
      selectable: false,
      focusable: false,
      deletable: false,
    }))
  },
  { immediate: true },
)

const duration = () => (reducedMotion.value ? 0 : 150)

function frame() {
  const saved = props.layout.viewport
  if (saved) {
    void setViewport(saved)
  } else if (props.layout.mode === 'phone') {
    // A column fits the width at 100% zoom and scrolls down.
    void setViewport({ x: (window.innerWidth - 260) / 2, y: 16, zoom: 1 })
  } else {
    void fitView({ padding: FRAME_PADDING, maxZoom: 1, duration: duration() })
  }
}

// fitView needs measured nodes, so frame again once they are.
let framed = false
watch(initialized, (ready) => {
  if (ready && !framed) {
    framed = true
    frame()
  }
})

watch(
  () => props.layout.mode,
  () => {
    nextTick(() => frame())
  },
)

function onNodeDragStop({ nodes: dragged }: NodeDragEvent) {
  emit(
    'update:positions',
    Object.fromEntries(dragged.map((node) => [node.id, { x: node.position.x, y: node.position.y }])),
  )
}

function onMoveEnd({ viewport }: { viewport: Viewport }) {
  emit('update:viewport', { x: viewport.x, y: viewport.y, zoom: viewport.zoom })
}

// Pans to a node, keeping the zoom, and moves focus to it.
async function reveal(id: string) {
  // Gives up quietly after half a second; the fallbacks below cover an unmeasured node.
  await until(() => getNode(id)?.measured?.width).toBeTruthy({ timeout: 500 })
  const node = getNode(id)
  if (!node) return
  const width = node.measured?.width ?? 260
  const height = node.measured?.height ?? 120
  await setCenter(node.position.x + width / 2, node.position.y + height / 2, {
    zoom: getViewport().zoom,
    duration: duration(),
  })
  const element = document.querySelector<HTMLElement>(`.vue-flow__node[data-id="${id}"]`)
  const firstField = element?.querySelector<HTMLElement>('.field input, .field select')
  if (firstField) {
    firstField.focus({ preventScroll: true })
  } else {
    element?.focus({ preventScroll: true })
  }
}

defineExpose({ reveal })
</script>

<template>
  <VueFlow
    v-model:nodes="nodes"
    v-model:edges="edges"
    class="chain-canvas"
    :delete-key-code="null"
    :selection-key-code="null"
    :multi-selection-key-code="null"
    :edges-focusable="false"
    :nodes-connectable="false"
    :min-zoom="0.3"
    attribution-position="bottom-left"
    @node-drag-stop="onNodeDragStop"
    @move-end="onMoveEnd"
  >
    <Background
      :gap="22"
      :size="2"
    />
    <Controls
      :show-interactive="false"
      position="bottom-right"
    />

    <template #node-inputtext>
      <InputNode
        :text="chain.inputText"
        :errors="inputErrors"
        :max-input-length="maxInputLength"
        :source-position="ends.source"
        @update:text="emit('update:inputText', $event)"
      />
    </template>

    <template #node-step="{ id }">
      <StepNode
        v-if="stepPropsById[id]"
        v-bind="stepPropsById[id]"
        :result="run.results[id]"
        :dimmed="dimmed"
        :source-position="ends.source"
        :target-position="ends.target"
        @update-field="onUpdateField"
      />
    </template>

    <template #node-outputtext>
      <OutputNode
        :output="run.sentRequest === null || run.errors.length > 0 ? undefined : run.output"
        :dimmed="dimmed"
        :target-position="ends.target"
      />
    </template>
  </VueFlow>
</template>

<style>
/* Themed through Vue Flow's --xy-* variables, not its own dark preset. */
.chain-canvas {
  --xy-background-color: var(--canvas-bg);
  --xy-background-pattern-dots-color: #4a4a57;
  --xy-edge-stroke: var(--muted-on-dark);
  --xy-edge-stroke-width: 2;
  --xy-handle-background-color: var(--muted-on-dark);
  --xy-handle-border-color: var(--canvas-bg);
  --xy-controls-button-background-color: var(--canvas-bg);
  --xy-controls-button-background-color-hover: #2a2a33;
  --xy-controls-button-color: var(--text-on-dark);
  --xy-controls-button-border-color: var(--line);
  --xy-node-border: none;
  --xy-node-background-color: transparent;
  --xy-node-boxshadow-hover: none;
  --xy-node-boxshadow-selected: none;
  --xy-attribution-background-color: transparent;
  min-height: 0;
}

/* A 24px target (WCAG 2.5.8), away from the zoom controls in the other corner. */
.chain-canvas .vue-flow__attribution a {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.25rem;
  color: var(--muted-on-dark);
  font-size: var(--text-sm);
}

/* Our cards draw their own border; Vue Flow's wrapper only positions them. */
.chain-canvas .vue-flow__node-inputtext,
.chain-canvas .vue-flow__node-step,
.chain-canvas .vue-flow__node-outputtext {
  padding: 0;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  box-shadow: none;
  width: auto;
}
</style>
