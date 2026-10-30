import { mount } from '@vue/test-utils'
import { Position } from '@xyflow/vue'
import { expect, it } from 'vitest'
import InputNode from '../components/InputNode.vue'
import problem from '../../../contract/post-chain-run.mixed-errors.422.json'

it('renders every Input error, retains the polite count description and removes invalid semantics when cleared', async () => {
  const errors = problem.errors.filter((error) => error.stepId === null).map((error) => error.detail)
  const wrapper = mount(InputNode, {
    props: { text: 'x', maxInputLength: 3000, sourcePosition: Position.Right, errors },
    global: { stubs: { Handle: true } },
  })
  const input = wrapper.get('textarea')
  expect(input.attributes('aria-describedby')).toBe('input-count input-errors')
  expect(input.attributes('aria-invalid')).toBe('true')
  expect(wrapper.get('#input-count').attributes('aria-live')).toBe('polite')
  expect(wrapper.get('#input-errors').findAll('p').map((message) => message.text())).toEqual(errors)
  expect(wrapper.get('.node').classes()).toContain('node--invalid')
  expect(input.attributes('maxlength')).toBeUndefined()
  await wrapper.setProps({ errors: [] })
  expect(input.attributes('aria-describedby')).toBe('input-count')
  expect(input.attributes('aria-invalid')).toBeUndefined()
  expect(wrapper.find('#input-errors').exists()).toBe(false)
  expect(wrapper.get('.node').classes()).not.toContain('node--invalid')
})
