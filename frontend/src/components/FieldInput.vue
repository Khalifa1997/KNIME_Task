<script setup lang="ts">
import { computed } from 'vue'
import type { FieldMeta, FieldValue } from '../api/types'

const props = defineProps<{
  stepId: string
  field: FieldMeta
  value: FieldValue
}>()

const emit = defineEmits<{ 'update:value': [value: FieldValue] }>()

const inputId = computed(() => `field-${props.stepId}-${props.field.name}`)

function stopCanvasKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return
  event.stopPropagation()
}

function onTextInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:value', value === '' && !props.field.required ? null : value)
}

function onIntegerInput(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:value', input.value === '' && !props.field.required ? null : input.valueAsNumber)
}

function onBooleanInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).checked)
}

function onSelectInput(event: Event) {
  emit('update:value', (event.target as HTMLSelectElement).value)
}
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
  </div>
</template>
