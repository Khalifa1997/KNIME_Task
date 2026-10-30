import { join } from 'node:path'
import process from 'node:process'

// One port controls launch, readiness and navigation; never attach to another lane.
export function jarServer(defaultPort: number) {
  const value = process.env.E2E_PORT ?? String(defaultPort)
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error('E2E_PORT must be an integer between 1024 and 65535')
  }
  const port = Number(value)
  const baseURL = `http://localhost:${port}`
  if (process.env.BASE_URL && process.env.BASE_URL !== baseURL) {
    throw new Error('BASE_URL must match the local jar URL; select its port with E2E_PORT')
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
