<script setup lang="ts">
import { computed } from 'vue'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/vue'
import ContentCheckBadge from './ContentCheckBadge.vue'

// How long the yellow fill takes to draw along one edge; the next edge starts when it ends.
const FILL_MS = 300

interface FlowEdgeData {
  // Position in Chain order, which sets when the fill reaches this edge.
  index: number
  filling: boolean
  flash: 'success' | 'danger' | null
  reducedMotion: boolean
}

// Only the edge leaving the Input text carries the Content check badge.
const props = defineProps<EdgeProps & { contentCheck?: { on: boolean; available: boolean } | null }>()
const emit = defineEmits<{ 'toggle-content-check': [on: boolean] }>()

// Vue Flow types an edge's data as a generic record.
const motion = computed(() => props.data as unknown as FlowEdgeData)

const bezier = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
}))
const path = computed(() => bezier.value[0])
// Vue Flow's own midpoint of the edge, in its pixel coordinates.
const badgeTransform = computed(() =>
  `translate(-50%, -50%) translate(${bezier.value[1]}px, ${bezier.value[2]}px)`)

const fillDelay = computed(() => `${motion.value.index * FILL_MS}ms`)
</script>

<template>
  <path
    :id="id"
    :d="path"
    class="vue-flow__edge-path flow-edge__base"
    :class="{ 'flow-edge__base--still': motion.reducedMotion }"
  />
  <path
    v-if="motion.filling"
    :d="path"
    pathLength="1"
    class="flow-edge__fill"
    :class="{ 'flow-edge__fill--drawn': motion.reducedMotion }"
    :style="{ animationDuration: `${FILL_MS}ms`, animationDelay: fillDelay }"
  />
  <path
    v-if="motion.flash && !motion.reducedMotion"
    :d="path"
    class="flow-edge__flash"
    :class="`flow-edge__flash--${motion.flash}`"
  />
  <EdgeLabelRenderer v-if="contentCheck">
    <ContentCheckBadge
      class="flow-edge__badge"
      :style="{ transform: badgeTransform }"
      :on="contentCheck.on"
      :available="contentCheck.available"
      @toggle="emit('toggle-content-check', $event)"
    />
  </EdgeLabelRenderer>
</template>

<style scoped>
.flow-edge__badge {
  position: absolute;
  top: 0;
  left: 0;
}

.flow-edge__base {
  stroke-dasharray: 5;
  animation: flow 0.5s linear infinite;
}

.flow-edge__base--still {
  animation: none;
}

.flow-edge__fill,
.flow-edge__flash {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}

/* pathLength="1" makes the dash as long as the edge, whatever its length. */
.flow-edge__fill {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw linear forwards;
}

.flow-edge__fill--drawn {
  stroke-dashoffset: 0;
  animation: none;
}

.flow-edge__flash {
  animation: flash 1.2s ease-out forwards;
}

.flow-edge__flash--danger {
  stroke: var(--danger-border);
  /* A failure keeps pulsing until the next run clears it. */
  animation: pulse 1.2s ease-in-out infinite alternate;
}

@keyframes flow {
  to {
    stroke-dashoffset: -10;
  }
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes pulse {
  from {
    opacity: 1;
  }

  to {
    opacity: 0.2;
  }
}

@keyframes flash {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
</style>
