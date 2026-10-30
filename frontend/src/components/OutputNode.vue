<script setup lang="ts">
import { Handle, type Position } from '@xyflow/vue'
import { OUTPUT_ID, titleIdOf } from '../layout'

defineProps<{
  // Undefined until a run has produced one.
  output: string | undefined
  dimmed: boolean
  targetPosition: Position
}>()
</script>

<template>
  <!-- Vue Flow's node wrapper is the group, named by this node's heading. -->
  <div class="node node--io">
    <!-- Edges are drawn for the user, never by them, so the handles are only decoration. -->
    <Handle
      aria-hidden="true"
      type="target"
      :position="targetPosition"
    />
    <h2
      :id="titleIdOf(OUTPUT_ID)"
      class="node__title"
    >
      Output
    </h2>
    <p
      v-if="output !== undefined"
      class="node__result"
      :class="{ 'is-dimmed': dimmed }"
    >
      {{ output === '' ? '(empty)' : output }}
    </p>
    <p
      v-else
      class="node__result node__result--hint"
    >
      Press Run to see the Output.
    </p>
  </div>
</template>
