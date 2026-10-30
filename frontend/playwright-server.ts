import { join } from 'node:path'
import process from 'node:process'

// One port drives the jar, readiness probe and browser; never reuse an unrelated server.
export function playwrightServer(defaultPort: number) {
  const value = process.env.E2E_PORT ?? String(defaultPort)
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error('E2E_PORT must be an integer between 1024 and 65535')
  }
  const port = Number(value)
  const baseURL = `http://localhost:${port}`
  if (process.env.BASE_URL && process.env.BASE_URL !== baseURL) {
    throw new Error('Use E2E_PORT instead of an incompatible BASE_URL')
  }
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'
  return {
    baseURL,
    webServer: {
      command: `"${java}" -jar ../app/target/app.jar --server.port=${port}`,
      url: `${baseURL}/api/transformations`,
      reuseExistingServer: false,
      timeout: 60 * 1000,
    },
  }
}
