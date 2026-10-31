<script setup lang="ts">
import { computed } from 'vue'
import { Handle, type Position } from '@xyflow/vue'
import { useFocusRequest } from '../nodeFocus'
import { INPUT_ID, titleIdOf, type FocusRequest } from '../layout'

const props = defineProps<{
  focusRequest?: FocusRequest | null
  errors: string[]
  suppressErrors?: boolean
  dimmed?: boolean
  text: string
  maxInputLength: number
  sourcePosition: Position
}>()

const emit = defineEmits<{ 'update:text': [value: string] }>()

const count = computed(
  () => `${props.text.length.toLocaleString('en-US')} / ${props.maxInputLength.toLocaleString('en-US')}`,
)
const over = computed(() => props.text.length > props.maxInputLength)

function onInput(event: Event) {
  emit('update:text', (event.target as HTMLTextAreaElement).value)
}

useFocusRequest('root', () => props.focusRequest)
</script>

<template>
  <!-- Vue Flow's node wrapper is the group, named by this node's heading. -->
  <div
    ref="root"
    class="node node--io"
    :class="{ 'node--invalid': errors.length > 0 && !suppressErrors }"
  >
    <h2
      :id="titleIdOf(INPUT_ID)"
      class="node__title"
    >
      Input text
    </h2>
    <textarea
      id="input-text"
      class="input-node__text nodrag nowheel nokey"
      rows="4"
      :aria-labelledby="titleIdOf(INPUT_ID)"
      :aria-describedby="errors.length ? 'input-count input-errors' : 'input-count'"
      :aria-invalid="errors.length ? true : undefined"
      :value="text"
      @input="onInput"
    />
    <p
      id="input-count"
      class="input-node__count"
      :class="{ 'input-node__count--over': over }"
      aria-live="polite"
    >
      {{ count }}
    </p>
    <div
      v-if="errors.length"
      id="input-errors"
      class="error-messages"
      :class="{ 'is-dimmed': dimmed }"
    >
      <p
        v-for="(message, index) in errors"
        :key="index"
      >
        {{ message }}
      </p>
    </div>
    <!-- Edges are drawn for the user, never by them, so the handles are only decoration. -->
    <Handle
      aria-hidden="true"
      type="source"
      :position="sourcePosition"
    />
  </div>
</template>

<style scoped>
.input-node__text {
  display: block;
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  resize: vertical;
}

/* Fields inside cards: a darker, thicker border instead of the two-tone ring. */
.input-node__text:focus-visible {
  border-color: var(--text);
  box-shadow: 0 0 0 1px var(--text);
}

.input-node__count {
  margin-top: 0.25rem;
  color: var(--muted);
  font-size: var(--text-sm);
  text-align: right;
}

.input-node__count--over {
  color: var(--danger-text);
  font-weight: 700;
}
</style>
