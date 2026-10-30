<script setup lang="ts">
import { computed } from 'vue'
import { Handle, type Position } from '@xyflow/vue'
import { useFocusRequest } from '../nodeFocus'
import { titleIdOf, type FocusRequest } from '../layout'
import type { FieldMeta, FieldValue } from '../api/types'
import FieldInput from './FieldInput.vue'

const props = defineProps<{
  focusRequest?: FocusRequest | null
  invalid: boolean
  wholeStepErrors: string[]
  fieldErrors: Record<string, string[]>
  stepId: string
  canMoveEarlier: boolean
  canMoveLater: boolean
  phone: boolean
  index: number
  label: string
  fields: FieldMeta[]
  values: Record<string, FieldValue>
  result: string | undefined
  dimmed: boolean
  targetPosition: Position
  sourcePosition: Position
}>()

const emit = defineEmits<{
  'update-field': [stepId: string, name: string, value: FieldValue]
  'delete-step': [stepId: string]
  'move-step': [stepId: string, direction: -1 | 1]
}>()

// The first Field takes focus unless only the node was asked for.
const fieldFocusRequest = computed(
  () => (props.fields.length && !props.focusRequest?.nodeOnly ? props.focusRequest : null),
)
useFocusRequest('root', () => props.focusRequest, () => fieldFocusRequest.value !== null)
</script>

<template>
  <!-- Vue Flow's node wrapper is the group, named by this node's heading. -->
  <div
    ref="root"
    class="node"
    :class="{ 'node--invalid': invalid, 'errors-dimmed': dimmed }"
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
    <div class="step-node__actions">
      <button
        type="button"
        class="icon-btn nodrag nokey"
        :aria-label="`Move Step ${index + 1}: ${label} earlier`"
        :disabled="!canMoveEarlier"
        @click="emit('move-step', stepId, -1)"
      >
        <span aria-hidden="true">{{ phone ? '↑' : '←' }}</span>
      </button>
      <button
        type="button"
        class="icon-btn nodrag nokey"
        :aria-label="`Move Step ${index + 1}: ${label} later`"
        :disabled="!canMoveLater"
        @click="emit('move-step', stepId, 1)"
      >
        <span aria-hidden="true">{{ phone ? '↓' : '→' }}</span>
      </button>
      <button
        type="button"
        class="icon-btn nodrag nokey"
        :aria-label="`Delete Step ${index + 1}: ${label}`"
        @click="emit('delete-step', stepId)"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
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
      v-for="(field, fieldIndex) in fields"
      :key="field.name"
      :focus-request="fieldIndex === 0 ? fieldFocusRequest : null"
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
.step-node__actions {
  display: flex;
  gap: 0.25rem;
  margin-block: 0.5rem;
}

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
