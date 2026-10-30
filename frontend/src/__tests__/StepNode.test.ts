import { mount } from '@vue/test-utils'
import { Position } from '@xyflow/vue'
import { expect, it } from 'vitest'
import metadata from '../../../contract/get-transformations.200.json'
import StepNode from '../components/StepNode.vue'
import type { FieldMeta } from '../api/types'

it('re-emits an inline Field edit with its Step id and Field name', async () => {
  const transformation = metadata.transformations.find((item) => item.id === 'replace')!
  const wrapper = mount(StepNode, {
    props: {
      invalid: false,
      wholeStepErrors: [],
      fieldErrors: {},
      stepId: 'replace-step',
      index: 0,
      label: transformation.label,
      fields: transformation.fields as FieldMeta[],
      values: { search: 'a', replacement: '' },
      result: undefined,
      dimmed: false,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    },
    global: { stubs: { Handle: true } },
  })

  await wrapper.get('input[id="field-replace-step-replacement"]').setValue(' x ')

  expect(wrapper.emitted('update-field')).toEqual([['replace-step', 'replacement', ' x ']])
})

it('keeps the normal card and renders all whole-Step and Field details verbatim', () => {
  const transformation = metadata.transformations.find((item) => item.id === 'replace')!
  const wrapper = mount(StepNode, {
    props: {
      stepId: 'broken', index: 0, label: transformation.label,
      fields: transformation.fields as FieldMeta[], values: {}, result: undefined, dimmed: false,
      invalid: true, wholeStepErrors: ['Whole Step one.', 'Whole Step two.'],
      fieldErrors: { search: ['Field one.', 'Field two.'] },
      targetPosition: Position.Left, sourcePosition: Position.Right,
    },
    global: { stubs: { Handle: true } },
  })
  expect(wrapper.get('.node').classes()).toEqual(['node', 'node--invalid'])
  expect(wrapper.get('.node > .error-messages').text()).toContain('Whole Step one.')
  expect(wrapper.get('.node > .error-messages').text()).toContain('Whole Step two.')
  expect(wrapper.get('.field .error-messages').text()).toContain('Field one.')
  expect(wrapper.get('.field .error-messages').text()).toContain('Field two.')
})
