import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Spring Boot runs on 8080 in development; one origin for the browser, so no CORS.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
