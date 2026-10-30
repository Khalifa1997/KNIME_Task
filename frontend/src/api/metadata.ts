import type { Metadata } from './types'

export async function fetchMetadata(): Promise<Metadata> {
  const response = await fetch('/api/transformations')
  if (!response.ok) {
    throw new Error(`GET /api/transformations failed with ${response.status}`)
  }
  return (await response.json()) as Metadata
}
