<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { FieldMeta, FieldValue } from '../api/types'
import type { FocusRequest } from '../layout'

const props = defineProps<{
  stepId: string
  field: FieldMeta
  value: FieldValue
  errors?: string[]
  focusRequest?: FocusRequest | null
}>()

const emit = defineEmits<{ 'update:value': [value: FieldValue] }>()

const inputId = computed(() => `field-${props.stepId}-${props.field.name}`)

const control = useTemplateRef<HTMLElement>('control')

const errorId = computed(() => `${inputId.value}-errors`)
const hasErrors = computed(() => Boolean(props.errors?.length))

function stopCanvasKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return
  event.stopPropagation()
}

// The backend reads null as "use the Field's default", so a cleared text Field stays an empty string.
function onTextInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).value)
}

// An empty number input has no value; null avoids sending NaN.
function onIntegerInput(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:value', input.value === '' ? null : input.valueAsNumber)
}

function onBooleanInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).checked)
}

function onSelectInput(event: Event) {
  emit('update:value', (event.target as HTMLSelectElement).value)
}

watch(() => props.focusRequest, (request) => {
  if (request) control.value?.focus({ preventScroll: true })
})
</script>

<template>
  <div class="field">
    <!-- The control is selected dynamically, but each branch has this computed, unique id. -->
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
    <label
      class="field__label"
      :for="inputId"
    >{{ field.label }}</label>
    <input
      v-if="field.type === 'text'"
      :id="inputId"
      ref="control"
      :aria-invalid="hasErrors ? true : undefined"
      :aria-describedby="hasErrors ? errorId : undefined"
      class="input nodrag nowheel nokey"
      type="text"
      :required="field.required"
      :value="value ?? ''"
      @keydown="stopCanvasKey"
      @input="onTextInput"
    >
    <input
      v-else-if="field.type === 'integer'"
      :id="inputId"
      ref="control"
      :aria-invalid="hasErrors ? true : undefined"
      :aria-describedby="hasErrors ? errorId : undefined"
      class="input nodrag nowheel nokey"
      type="number"
      :required="field.required"
      :min="field.min ?? undefined"
      :max="field.max ?? undefined"
      :value="value ?? ''"
      @keydown="stopCanvasKey"
      @input="onIntegerInput"
    >
    <input
      v-else-if="field.type === 'boolean'"
      :id="inputId"
      ref="control"
      :aria-invalid="hasErrors ? true : undefined"
      :aria-describedby="hasErrors ? errorId : undefined"
      class="checkbox nodrag nowheel nokey"
      type="checkbox"
      :required="field.required"
      :checked="value === true"
      @keydown="stopCanvasKey"
      @change="onBooleanInput"
    >
    <select
      v-else
      :id="inputId"
      ref="control"
      :aria-invalid="hasErrors ? true : undefined"
      :aria-describedby="hasErrors ? errorId : undefined"
      class="input nodrag nowheel nokey"
      :required="field.required"
      :value="value ?? ''"
      @keydown="stopCanvasKey"
      @change="onSelectInput"
    >
      <option
        v-for="choice in field.options ?? []"
        :key="choice.value"
        :value="choice.value"
      >
        {{ choice.label }}
      </option>
    </select>
    <div
      v-if="hasErrors"
      :id="errorId"
      class="error-messages"
    >
      <p
        v-for="(message, index) in errors"
        :key="index"
      >
        {{ message }}
      </p>
    </div>
  </div>
</template>
