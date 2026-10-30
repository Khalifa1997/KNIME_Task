import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FieldInput from '../components/FieldInput.vue'
import type { FieldMeta, Metadata } from '../api/types'
import contract from '../../../contract/get-transformations.200.json'

function props(overrides: Partial<FieldMeta>, value: FieldMeta['defaultValue'] = null, stepId = 'step-a') {
  return { stepId, field: field(overrides), value }
}

function field(overrides: Partial<FieldMeta>): FieldMeta {
  return {
    name: 'value',
    label: 'Value',
    type: 'text',
    required: false,
    defaultValue: null,
    min: null,
    max: null,
    options: null,
    ...overrides,
  }
}

describe('FieldInput', () => {
  it('renders a labelled text input and emits null when an optional Field is cleared', async () => {
    const wrapper = mount(FieldInput, { props: props({}, 'present') })

    const input = wrapper.get('input[type="text"]')
    expect(input.attributes('required')).toBeUndefined()
    await input.setValue('')

    expect(wrapper.emitted('update:value')).toEqual([[null]])
  })

  it('renders a number input with its native required and minimum hints and emits a number', async () => {
    const wrapper = mount(FieldInput, {
      props: props({ type: 'integer', required: true, min: 2 }, 3),
    })

    const input = wrapper.get('input[type="number"]')
    expect(input.attributes()).toMatchObject({ required: '', min: '2' })
    await input.setValue('5')

    expect(wrapper.emitted('update:value')).toEqual([[5]])
  })

  it('renders a checkbox and emits a boolean', async () => {
    const wrapper = mount(FieldInput, {
      props: props({ type: 'boolean' }, false),
    })

    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('update:value')).toEqual([[true]])
  })

  it('renders Choices from a Transformation fixture and emits the selected value', async () => {
    const metadata: Metadata = {
      ...contract,
      transformations: [{
        ...contract.transformations[0]!,
        fields: [field({
          type: 'select',
          defaultValue: 'comma',
          options: [
            { value: 'comma', label: 'Comma' },
            { value: 'tab', label: 'Tab' },
          ],
        })],
      }],
    }
    const select = metadata.transformations[0]!.fields[0]!
    const wrapper = mount(FieldInput, {
      props: { stepId: 'fake-step', field: select, value: select.defaultValue },
    })

    expect(wrapper.get('select').text()).toContain('Comma')
    await wrapper.get('select').setValue('tab')

    expect(wrapper.emitted('update:value')).toEqual([['tab']])
  })

  it('uses its Step id to keep labels and controls unique', () => {
    const first = mount(FieldInput, { props: props({}, '', 'first') })
    const second = mount(FieldInput, { props: props({}, '', 'second') })

    expect(first.get('input').attributes('id')).toBe('field-first-value')
    expect(second.get('input').attributes('id')).toBe('field-second-value')
  })
})

it.each(['text', 'integer', 'boolean', 'select'] as const)('links all %s errors and removes invalid semantics after success', async (type) => {
  const wrapper = mount(FieldInput, {
    props: { ...props({ type }), errors: ['First server detail.', 'Second server detail.'] },
  })
  const control = wrapper.get(type === 'select' ? 'select' : 'input')
  const description = control.attributes('aria-describedby')!
  expect(control.attributes('aria-invalid')).toBe('true')
  expect(wrapper.get(`#${description}`).text()).toContain('First server detail.')
  expect(wrapper.get(`#${description}`).text()).toContain('Second server detail.')
  await wrapper.setProps({ errors: [] })
  expect(control.attributes('aria-invalid')).toBeUndefined()
  expect(control.attributes('aria-describedby')).toBeUndefined()
  expect(wrapper.find(`#${description}`).exists()).toBe(false)
})

it('keeps error description ids unique across Steps with the same Field', () => {
  const first = mount(FieldInput, { props: { ...props({}, '', 'first'), errors: ['First'] } })
  const second = mount(FieldInput, { props: { ...props({}, '', 'second'), errors: ['Second'] } })
  const firstId = first.get('input').attributes('aria-describedby')!
  const secondId = second.get('input').attributes('aria-describedby')!
  expect(firstId).not.toBe(secondId)
  expect(first.get(`#${firstId}`).text()).toBe('First')
  expect(second.get(`#${secondId}`).text()).toBe('Second')
})
