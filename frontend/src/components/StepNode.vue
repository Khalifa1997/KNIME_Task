<script setup lang="ts">
import { Handle, type Position } from '@xyflow/vue'
import { titleIdOf } from '../layout'
import type { FieldMeta, FieldValue } from '../api/types'
import FieldInput from './FieldInput.vue'

defineProps<{
  invalid: boolean
  wholeStepErrors: string[]
  fieldErrors: Record<string, string[]>
  stepId: string
  index: number
  label: string
  fields: FieldMeta[]
  values: Record<string, FieldValue>
  result: string | undefined
  dimmed: boolean
  targetPosition: Position
  sourcePosition: Position
}>()

const emit = defineEmits<{ 'update-field': [stepId: string, name: string, value: FieldValue] }>()
</script>

<template>
  <!-- Vue Flow's node wrapper is the group, named by this node's heading. -->
  <div
    class="node"
    :class="{ 'node--invalid': invalid }"
  >
    <!-- Edges are drawn for the user, never by them, so the handles are only decoration. -->
    <Handle
      aria-hidden="true"
      type="target"
      :position="targetPosition"
    />
    <h2
      :id="titleIdOf(stepId)"
      class="node__title"
    >
      <span
        class="step-node__index"
        aria-hidden="true"
      >{{ index + 1 }}</span>
      <span class="visually-hidden">Step {{ index + 1 }}: </span>{{ label }}
    </h2>
    <div
      v-if="wholeStepErrors.length"
      class="error-messages"
    >
      <p
        v-for="(message, errorIndex) in wholeStepErrors"
        :key="errorIndex"
      >
        {{ message }}
      </p>
    </div>
    <FieldInput
      v-for="field in fields"
      :key="field.name"
      :step-id="stepId"
      :field="field"
      :errors="fieldErrors[field.name]"
      :value="values[field.name] ?? null"
      @update:value="emit('update-field', stepId, field.name, $event)"
    />
    <span class="step-node__result-label">Result</span>
    <p
      v-if="result !== undefined"
      class="node__result"
      :class="{ 'is-dimmed': dimmed }"
    >
      {{ result === '' ? '(empty)' : result }}
    </p>
    <p
      v-else
      class="node__result node__result--hint"
    >
      Run to see it
    </p>
    <Handle
      aria-hidden="true"
      type="source"
      :position="sourcePosition"
    />
  </div>
</template>

<style scoped>
.step-node__index {
  display: inline-grid;
  place-items: center;
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--text);
  color: var(--card);
  font-size: var(--text-sm);
}

.step-node__result-label {
  display: block;
  color: var(--muted);
  font-size: var(--text-sm);
}
</style>
