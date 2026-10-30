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
      canMoveEarlier: false,
      canMoveLater: true,
      phone: false,
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

  const buttons = wrapper.findAll('button')
  expect(buttons[0]!.attributes('disabled')).toBeDefined()
  expect(buttons[0]!.text()).toBe('←')
  await buttons[1]!.trigger('click')
  expect(wrapper.emitted('move-step')).toEqual([['replace-step', 1]])
  await buttons[2]!.trigger('click')
  expect(wrapper.emitted('delete-step')).toEqual([['replace-step']])
  await wrapper.setProps({ phone: true, canMoveEarlier: true, canMoveLater: false })
  expect(buttons[0]!.text()).toBe('↑')
  expect(buttons[1]!.attributes('disabled')).toBeDefined()
  await buttons[0]!.trigger('click')
  expect(wrapper.emitted('move-step')?.[1]).toEqual(['replace-step', -1])
  for (const button of buttons) {
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toContain('Step 1: Replace')
    expect(button.classes()).toEqual(expect.arrayContaining(['icon-btn', 'nodrag', 'nokey']))
  }

  await wrapper.get('input[id="field-replace-step-replacement"]').setValue(' x ')

  expect(wrapper.emitted('update-field')).toEqual([['replace-step', 'replacement', ' x ']])
})

it('keeps the normal card and renders all whole-Step and Field details verbatim', () => {
  const transformation = metadata.transformations.find((item) => item.id === 'replace')!
  const wrapper = mount(StepNode, {
    props: {
      stepId: 'broken', index: 0, label: transformation.label,
      canMoveEarlier: false, canMoveLater: false, phone: false,
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

it('moves focus to its first Field when asked, but not when only the node was asked for', async () => {
  const transformation = metadata.transformations.find((item) => item.id === 'replace')!
  const wrapper = mount(StepNode, {
    attachTo: document.body,
    props: {
      invalid: false,
      wholeStepErrors: [],
      fieldErrors: {},
      stepId: 'replace-step',
      index: 0,
      canMoveEarlier: false,
      canMoveLater: false,
      phone: false,
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

  await wrapper.setProps({ focusRequest: { id: 'replace-step', nodeOnly: true } })
  expect(document.activeElement).toBe(document.body)

  await wrapper.setProps({ focusRequest: { id: 'replace-step', nodeOnly: false } })
  expect(document.activeElement).toBe(wrapper.get('input[id="field-replace-step-search"]').element)
  wrapper.unmount()
})
