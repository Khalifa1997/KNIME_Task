import type { FieldMeta, Metadata, TransformationMeta } from './types'

const genericReason = 'Something went wrong.'
const networkReason = "Couldn't reach the server."
const supportedTypes = new Set(['text', 'integer', 'boolean', 'select'])

type RawField = Omit<FieldMeta, 'type'> & { type: string }

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function field(value: unknown): value is RawField {
  return object(value)
    && typeof value.name === 'string' && typeof value.label === 'string'
    && typeof value.type === 'string' && typeof value.required === 'boolean'
    && (value.defaultValue === null || typeof value.defaultValue === 'string'
      || typeof value.defaultValue === 'boolean' || finite(value.defaultValue))
    && (value.min === null || finite(value.min))
    && (value.max === null || finite(value.max))
    && (value.options === null || (Array.isArray(value.options)
      && value.options.every((choice: unknown) => object(choice)
        && typeof choice.value === 'string' && typeof choice.label === 'string')))
}

function checkedMetadata(value: unknown): Metadata {
  if (!object(value) || !object(value.limits)
    || !finite(value.limits.maxInputLength) || !Number.isInteger(value.limits.maxInputLength)
    || value.limits.maxInputLength < 0
    || !finite(value.limits.maxSteps) || !Number.isInteger(value.limits.maxSteps)
    || value.limits.maxSteps < 0 || !Array.isArray(value.transformations)) {
    throw new Error(genericReason)
  }
  const transformations: TransformationMeta[] = []
  for (const transformation of value.transformations as unknown[]) {
    if (!object(transformation) || typeof transformation.id !== 'string'
      || typeof transformation.label !== 'string' || typeof transformation.description !== 'string'
      || !Array.isArray(transformation.fields) || !transformation.fields.every(field)) {
      throw new Error(genericReason)
    }
    const unknownFields = transformation.fields.filter((item) => !supportedTypes.has(item.type))
    if (unknownFields.length) {
      console.warn(`Omitting Transformation ${transformation.id}: unknown Field type(s) ${unknownFields.map((item) => item.type).join(', ')}`)
      continue
    }
    // All fields are structurally checked and their types are supported above.
    transformations.push({
      id: transformation.id, label: transformation.label, description: transformation.description,
      fields: transformation.fields as FieldMeta[],
    })
  }
  return {
    contentCheck: { available: object(value.contentCheck) && value.contentCheck.available === true },
    limits: { maxInputLength: value.limits.maxInputLength, maxSteps: value.limits.maxSteps },
    transformations,
  }
}

export async function fetchMetadata(): Promise<Metadata> {
  const signal = AbortSignal.timeout(10_000)
  let response: Response
  try {
    response = await fetch('/api/transformations', { signal })
  } catch {
    throw new Error(networkReason)
  }
  if (response.status !== 200) {
    throw new Error(response.status === 500 ? 'The server had a problem.' : genericReason)
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new Error(signal.aborted || error instanceof TypeError || (error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError')) ? networkReason : genericReason)
  }
  return checkedMetadata(body)
}
