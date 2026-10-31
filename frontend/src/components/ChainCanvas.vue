<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { until, useKeyModifier, usePreferredReducedMotion, useWindowSize } from '@vueuse/core'
import {
  Background,
  Controls,
  Panel,
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
  edgeIdOf,
  handlePositions,
  slot,
  titleIdOf,
  type FocusRequest,
  type Layout,
  type Point,
} from '../layout'
import type { Chain, RunState } from '../run'
import { stepUnderPointer } from '../swap'
import InputNode from './InputNode.vue'
import OutputNode from './OutputNode.vue'
import FlowEdge from './FlowEdge.vue'
import StepNode from './StepNode.vue'

const props = defineProps<{
  chain: Chain
  layout: Layout
  transformations: TransformationMeta[]
  maxInputLength: number
  contentCheckAvailable: boolean
  run: RunState
  dimmed: boolean
  focusRequest?: FocusRequest | null
}>()

const emit = defineEmits<{
  'update:inputText': [value: string]
  'update:contentCheck': [value: boolean]
  'update:positions': [positions: Record<string, Point>]
  'update:viewport': [viewport: Viewport]
  'delete-step': [stepId: string]
  'move-step': [stepId: string, direction: -1 | 1]
  'swap-steps': [draggedId: string, targetId: string, draggedStart: Point]
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
const { width: windowWidth } = useWindowSize()

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
    return [id, { invalid: props.run.status !== 'failed', fieldErrors, wholeStepErrors: errors.filter((error) => error.field === null).map((error) => error.detail) }]
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
      canMoveEarlier: index > 0,
      canMoveLater: index < props.chain.steps.length - 1,
      phone: props.layout.mode === 'phone',
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
const contentCheckEdgeId = computed(() => edgeIdOf(ids.value[0] as string, ids.value[1] as string))
const contentCheckBadge = computed(() => ({ on: props.chain.contentCheck, available: props.contentCheckAvailable }))

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
  [ids, reducedMotion, () => props.run.status, () => props.run.flash],
  () => {
    const flashedIds = new Set(props.run.flash?.edgeIds)
    edges.value = ids.value.slice(1).map((target, index) => ({
      id: edgeIdOf(ids.value[index] as string, target),
      source: ids.value[index] as string,
      target,
      ariaLabel: `${spokenName(index)} to ${spokenName(index + 1)}`,
      type: 'flow',
      data: {
        index,
        // The fill draws while running and holds until the result arrives.
        filling: props.run.status === 'running',
        flash: flashedIds.has(edgeIdOf(ids.value[index] as string, target)) ? props.run.flash?.kind : null,
        reducedMotion: reducedMotion.value,
      },
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
    const nodeWidth = getNode(INPUT_ID)?.measured?.width ?? 280
    setViewport({ x: (windowWidth.value - nodeWidth) / 2, y: 16, zoom: 1 })
  } else {
    void fitView({ padding: FRAME_PADDING, maxZoom: 1, duration: duration() })
  }
}

// A resize within phone widths keeps the column where it is relative to the centre, panned or not.
watch(windowWidth, (width, previous) => {
  if (props.layout.mode !== 'phone' || !initialized.value) return
  const viewport = getViewport()
  setViewport({ ...viewport, x: viewport.x + (width - previous) / 2 })
})

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

// The Step being dragged on its own, with where it started; unset for any other drag.
const stepDrag = ref<{ id: string; start: Point; mouse: boolean } | null>(null)
const swapTargetId = ref<string | null>(null)
const shiftHeld = useKeyModifier('Shift')

const dragMovesOneStep = (dragged: Node[]) => dragged.length === 1 && typeOf(dragged[0]!.id) === 'step'
const isMouseDrag = (event: NodeDragEvent['event']) => !('touches' in event)

function stepAt(event: NodeDragEvent['event'], draggedId: string) {
  if (!('clientX' in event)) return null
  return stepUnderPointer(document.elementsFromPoint(event.clientX, event.clientY), draggedId)
}

function onNodeDragStart({ event, node, nodes: dragged }: NodeDragEvent) {
  stepDrag.value = dragMovesOneStep(dragged)
    ? { id: node.id, start: { x: node.position.x, y: node.position.y }, mouse: isMouseDrag(event) }
    : null
}

function onNodeDrag({ event }: NodeDragEvent) {
  const drag = stepDrag.value
  swapTargetId.value = drag?.mouse ? stepAt(event, drag.id) : null
}

const swapHintVisible = computed(() => stepDrag.value?.mouse === true)
// Shift is read live, so pressing or releasing it mid-drag shows or hides the highlight at once.
const swapLabelById = computed(() => {
  const drag = stepDrag.value
  const target = swapTargetId.value
  if (!drag || !target || !shiftHeld.value) return {}
  return { [target]: `Swap with Step ${ids.value.indexOf(drag.id)}` }
})

function onNodeDragStop({ event, node, nodes: dragged }: NodeDragEvent) {
  const drag = stepDrag.value
  stepDrag.value = null
  swapTargetId.value = null
  const targetId = drag && event.shiftKey && dragMovesOneStep(dragged) && drag.id === node.id
    ? stepAt(event, drag.id)
    : null
  if (drag && targetId) {
    emit('swap-steps', drag.id, targetId, drag.start)
    return
  }
  emit(
    'update:positions',
    Object.fromEntries(dragged.map((node) => [node.id, { x: node.position.x, y: node.position.y }])),
  )
}

function onMoveEnd({ viewport }: { viewport: Viewport }) {
  emit('update:viewport', { x: viewport.x, y: viewport.y, zoom: viewport.zoom })
}

// Handed to the node that should take focus, once the canvas has panned to it.
const nodeFocus = shallowRef<FocusRequest | null>(null)
const focusById = computed(() => (nodeFocus.value ? { [nodeFocus.value.id]: nodeFocus.value } : {}))

// Pans to a node, keeping the zoom, and asks it to take focus.
async function reveal({ id, nodeOnly }: FocusRequest) {
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
  nodeFocus.value = { id, nodeOnly }
}

function focusedStep(event: KeyboardEvent) {
  const target = event.target
  return target instanceof HTMLElement && target === document.activeElement &&
    target.matches('.vue-flow__node-step') ? target.dataset.id : undefined
}

function onKeydown(event: KeyboardEvent) {
  const id = focusedStep(event)
  if (id && event.key === 'Delete') {
    event.preventDefault()
    emit('delete-step', id)
  }
}

function onKeyup(event: KeyboardEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || target !== document.activeElement ||
      !target.matches('.vue-flow__node') || !event.key.startsWith('Arrow')) return
  const node = getNode(target.dataset.id ?? '')
  if (node) emit('update:positions', { [node.id]: { ...node.position } })
}

watch(() => props.focusRequest, (request) => {
  if (request) reveal(request)
})
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
    :pro-options="{ hideAttribution: true }"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @node-drag-start="onNodeDragStart"
    @node-drag="onNodeDrag"
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

    <template #edge-flow="edgeProps">
      <FlowEdge
        v-bind="edgeProps"
        :content-check="edgeProps.id === contentCheckEdgeId ? contentCheckBadge : null"
        @toggle-content-check="emit('update:contentCheck', $event)"
      />
    </template>
    <Panel
      v-if="swapHintVisible"
      class="swap-hint"
      position="bottom-center"
    >
      Hold Shift and drop on another Step to swap them
    </Panel>

    <template #node-inputtext>
      <InputNode
        :focus-request="focusById[INPUT_ID] ?? null"
        :text="chain.inputText"
        :errors="inputErrors"
        :suppress-errors="run.status === 'failed'"
        :dimmed="dimmed"
        :max-input-length="maxInputLength"
        :source-position="ends.source"
        @update:text="emit('update:inputText', $event)"
      />
    </template>

    <template #node-step="{ id }">
      <StepNode
        v-if="stepPropsById[id]"
        :focus-request="focusById[id] ?? null"
        v-bind="stepPropsById[id]"
        :result="run.results[id]"
        :dimmed="dimmed"
        :swap-label="swapLabelById[id] ?? null"
        :source-position="ends.source"
        :target-position="ends.target"
        @update-field="onUpdateField"
        @delete-step="emit('delete-step', $event)"
        @move-step="(stepId, direction) => emit('move-step', stepId, direction)"
      />
    </template>

    <template #node-outputtext>
      <OutputNode
        :focus-request="focusById[OUTPUT_ID] ?? null"
        :output="run.output"
        :dimmed="dimmed"
        :target-position="ends.target"
      />
    </template>
  </VueFlow>
</template>

<style>
/*
 * The edge-label layer (the Content check badge and its tooltip) always paints above the nodes.
 * Isolating the nodes layer keeps Vue Flow's per-node z-index, raised on select, inside it.
 */
.chain-canvas .vue-flow__nodes {
  isolation: isolate;
}

.chain-canvas .vue-flow__edgelabel-renderer {
  z-index: 1;
}

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
  min-height: 0;
}

/* A hint, not a control: it must never catch the pointer mid-drag. */
.chain-canvas .swap-hint {
  margin: 0 0 1rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  background: #000;
  color: var(--text-on-dark);
  font-size: var(--text-sm);
  pointer-events: none;
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
