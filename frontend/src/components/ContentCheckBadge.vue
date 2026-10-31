<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'

const props = defineProps<{ on: boolean; available: boolean }>()
const emit = defineEmits<{ toggle: [on: boolean] }>()

// The OpenAI mark, unaltered, as published in OpenAI's brand assets (via simple-icons).
const OPENAI_MARK = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

const state = computed(() => !props.available ? 'unavailable' : props.on ? 'on' : 'off')
const tooltip = computed(() => ({
  on: 'Content check on: the Input text is sent to OpenAI before each run.',
  off: 'Content check off. Select to send the Input text to OpenAI before each run.',
  unavailable: 'Content check not available: this server has no OpenAI API key.',
})[state.value])

// Escape hides the tooltip until it is hovered or focused afresh (WCAG 1.4.13).
const dismissed = ref(false)
const root = useTemplateRef<HTMLDivElement>('root')
// A fresh hover brings it back; moving between the badge and its tooltip is not a fresh hover.
useEventListener(root, 'mouseenter', () => { dismissed.value = false })

function onClick() {
  if (props.available) emit('toggle', !props.on)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  dismissed.value = true
  event.stopPropagation()
}
</script>

<template>
  <div
    ref="root"
    class="content-check-badge nodrag nopan"
    :class="[`content-check-badge--${state}`, { 'content-check-badge--dismissed': dismissed }]"
  >
    <button
      type="button"
      class="content-check-badge__button"
      aria-label="Content check (sends text to OpenAI)"
      :aria-pressed="on && available"
      :aria-disabled="available ? undefined : true"
      aria-describedby="content-check-tooltip"
      @click="onClick"
      @keydown="onKeydown"
      @blur="dismissed = false"
    >
      <span class="content-check-badge__disc">
        <svg
          class="content-check-badge__logo"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path :d="OPENAI_MARK" />
        </svg>
      </span>
    </button>
    <span
      id="content-check-tooltip"
      class="content-check-badge__tooltip"
    >
      <span class="content-check-badge__tooltip-text">{{ tooltip }}</span>
    </span>
  </div>
</template>

<style scoped>
.content-check-badge {
  position: relative;
  pointer-events: all;
}

/* A 2.75rem tap target around a 2rem disc, so even the enlarged disc stays clear of the nodes. */
.content-check-badge__button {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.content-check-badge__disc {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 2px dashed var(--muted-on-dark);
  border-radius: 50%;
  background: var(--card);
  color: var(--muted);
  transition: transform 150ms ease-out;
}

.content-check-badge__logo {
  width: 1.25rem;
  height: 1.25rem;
  fill: currentcolor;
}

/* On: full-colour mark and a solid accent ring; off is dashed, so colour is never the only cue. */
.content-check-badge--on .content-check-badge__disc {
  border-style: solid;
  border-color: var(--accent);
  color: var(--text);
}

.content-check-badge--unavailable .content-check-badge__button {
  cursor: not-allowed;
}

.content-check-badge--unavailable .content-check-badge__disc {
  border-color: var(--line);
  background: var(--border);
}

/* The ring goes on the disc; the button keeps its transparent outline for forced-colors mode. */
.content-check-badge__button:focus-visible {
  box-shadow: none;
}

.content-check-badge__button:focus-visible .content-check-badge__disc {
  box-shadow: var(--focus-ring);
}

.content-check-badge__button:hover .content-check-badge__disc,
.content-check-badge__button:focus-visible .content-check-badge__disc {
  transform: scale(1.2);
}

/* Sits flush above the badge, so the pointer can move onto it without it closing. */
.content-check-badge__tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: 14rem;
  padding-bottom: 0.75rem;
  transform: translateX(-50%);
  visibility: hidden;
  opacity: 0;
  transition: opacity 150ms ease-out, visibility 150ms;
}

.content-check-badge__tooltip-text {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--text);
  color: var(--card);
  font-size: var(--text-sm);
  line-height: 1.4;
  text-align: center;
}

/* Escape dismisses it; the :not() keeps that stronger than :hover and :focus-within. */
.content-check-badge:not(.content-check-badge--dismissed):hover .content-check-badge__tooltip,
.content-check-badge:not(.content-check-badge--dismissed):focus-within .content-check-badge__tooltip {
  visibility: visible;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .content-check-badge__disc,
  .content-check-badge__tooltip {
    transition: none;
  }

  .content-check-badge__button:hover .content-check-badge__disc,
  .content-check-badge__button:focus-visible .content-check-badge__disc {
    transform: none;
  }
}
</style>
