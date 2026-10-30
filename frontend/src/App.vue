<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchMetadata } from './api/metadata'
import type { Metadata } from './api/types'

const metadata = ref<Metadata | null>(null)

onMounted(async () => {
  try {
    metadata.value = await fetchMetadata()
  } catch (error) {
    // The loading and error screen comes with the metadata gate.
    console.error(error)
  }
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-header__title">
        <span
          class="app-header__logo"
          aria-hidden="true"
        >◆</span>
        Text Transformer
      </h1>
      <section
        v-if="metadata"
        class="palette"
        aria-labelledby="palette-label"
      >
        <h2
          id="palette-label"
          class="palette__label"
        >
          Add Step
        </h2>
        <ul class="palette__list">
          <li
            v-for="transformation in metadata.transformations"
            :key="transformation.id"
          >
            <button
              type="button"
              class="chip"
              :aria-describedby="`palette-description-${transformation.id}`"
            >
              {{ transformation.label }}
            </button>
            <span
              :id="`palette-description-${transformation.id}`"
              class="visually-hidden"
            >{{ transformation.description }}</span>
          </li>
        </ul>
      </section>
    </header>
    <main class="workspace" />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template: auto 1fr / minmax(0, 1fr);
  height: 100dvh;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  padding: 10px 16px;
  background: #000;
  border-bottom: 1px solid var(--line);
}

.app-header__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  white-space: nowrap;
}

.app-header__logo {
  color: var(--accent);
}

.palette {
  display: flex;
  align-items: center;
  gap: 6px 10px;
  flex: 1;
  min-width: 0;
}

.palette__label {
  color: var(--muted-on-dark);
  font-size: 0.85rem;
  font-weight: 400;
  white-space: nowrap;
}

.palette__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.workspace {
  min-height: 0;
}
</style>
