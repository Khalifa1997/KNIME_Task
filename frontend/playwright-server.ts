import { join } from 'node:path'
import process from 'node:process'

// One managed jar per run; never attach evidence to another lane's server.
export function jarServer(defaultPort: number) {
  const rawPort = process.env.E2E_PORT ?? String(defaultPort)
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1024 || Number(rawPort) > 65535) {
    throw new Error('E2E_PORT must be an integer between 1024 and 65535')
  }
  const baseURL = `http://localhost:${Number(rawPort)}`
  if (process.env.BASE_URL && process.env.BASE_URL !== baseURL) {
    throw new Error('BASE_URL must match the managed E2E_PORT origin')
  }
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'
  return {
    baseURL,
    webServer: {
      command: `"${java}" -jar ../app/target/app.jar --server.port=${Number(rawPort)}`,
      url: `${baseURL}/api/transformations`,
      reuseExistingServer: false,
      timeout: 60 * 1000,
    },
  }
}
