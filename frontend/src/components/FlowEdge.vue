<script setup lang="ts">
import { computed } from 'vue'
import { getBezierPath, type EdgeProps } from '@xyflow/vue'

// How long the yellow fill takes to draw along one edge; the next edge starts when it ends.
const FILL_MS = 300

interface FlowEdgeData {
  // Position in Chain order, which sets when the fill reaches this edge.
  index: number
  filling: boolean
  flash: 'success' | 'danger' | null
  reducedMotion: boolean
}

const props = defineProps<EdgeProps>()

// Vue Flow types an edge's data as a generic record.
const motion = computed(() => props.data as unknown as FlowEdgeData)

const path = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
})[0])

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
</template>

<style scoped>
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
  /* A failure stays marked until the next run, so it holds instead of fading. */
  animation: none;
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

@keyframes flash {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
</style>
