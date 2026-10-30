// Hand-written types for the HTTP contract. The JSON fixtures in /contract are the source of truth.

export type FieldType = 'text' | 'integer' | 'boolean' | 'select'

export interface Choice {
  value: string
  label: string
}

export interface FieldMeta {
  name: string
  label: string
  type: FieldType
  required: boolean
  defaultValue: string | number | boolean | null
  min: number | null
  max: number | null
  options: Choice[] | null
}

export interface TransformationMeta {
  id: string
  label: string
  description: string
  fields: FieldMeta[]
}

export interface Limits {
  maxInputLength: number
  maxSteps: number
}

export interface Metadata {
  limits: Limits
  transformations: TransformationMeta[]
}
