import { mount } from '@vue/test-utils'
import { Position } from '@xyflow/vue'
import { expect, it } from 'vitest'
import InputNode from '../components/InputNode.vue'
import problem from '../../../contract/post-chain-run.mixed-errors.422.json'

it('renders every Input error, retains the polite count description and removes invalid semantics when cleared', async () => {
  const errors = problem.errors.filter((error) => error.stepId === null).map((error) => error.detail)
  const wrapper = mount(InputNode, {
    props: { text: 'x', contentCheck: false, contentCheckAvailable: true, maxInputLength: 3000, sourcePosition: Position.Right, errors },
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

it('keeps and dims Input error content without an active node ring after a Run failure', () => {
  const wrapper = mount(InputNode, {
    props: {
      text: 'x', contentCheck: false, contentCheckAvailable: true, maxInputLength: 3000, sourcePosition: Position.Right,
      errors: ['Input text is too long.'], suppressErrors: true, dimmed: true,
    },
    global: { stubs: { Handle: true } },
  })
  expect(wrapper.get('#input-errors').text()).toBe('Input text is too long.')
  expect(wrapper.get('#input-errors').classes()).toContain('is-dimmed')
  expect(wrapper.get('.node').classes()).not.toContain('node--invalid')
  expect(wrapper.get('textarea').attributes('aria-describedby')).toBe('input-count input-errors')
})

it('puts the Content check badge right after the Input text in Tab order and passes its toggle on', async () => {
  const wrapper = mount(InputNode, {
    props: { text: 'x', contentCheck: false, contentCheckAvailable: true, maxInputLength: 3000, sourcePosition: Position.Right, errors: [] },
    global: { stubs: { Handle: true } },
  })
  const focusable = wrapper.findAll('textarea, button').map((element) => element.element.tagName)
  expect(focusable).toEqual(['TEXTAREA', 'BUTTON'])
  await wrapper.get('button[aria-label="Content check (sends text to OpenAI)"]').trigger('click')
  expect(wrapper.emitted('update:contentCheck')).toEqual([[true]])
})
