import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import ContentCheckBadge from '../components/ContentCheckBadge.vue'

const NAME = 'Content check (sends text to OpenAI)'

function badge(on: boolean, available = true) {
  return mount(ContentCheckBadge, { props: { on, available } })
}

function tooltipOf(wrapper: ReturnType<typeof badge>) {
  const button = wrapper.get('button')
  return wrapper.get(`#${button.attributes('aria-describedby')}`)
}

it('is a toggle button named for the Content check that says whether it is on', async () => {
  const wrapper = badge(false)
  const button = wrapper.get('button')
  expect(button.attributes('aria-label')).toBe(NAME)
  expect(button.attributes('aria-pressed')).toBe('false')
  expect(tooltipOf(wrapper).text()).toBe('Content check off. Select to send the Input text to OpenAI before each run.')

  await wrapper.setProps({ on: true })
  expect(button.attributes('aria-pressed')).toBe('true')
  expect(tooltipOf(wrapper).text()).toBe('Content check on: the Input text is sent to OpenAI before each run.')
})

it('asks to switch the Content check when selected', async () => {
  const wrapper = badge(false)
  await wrapper.get('button').trigger('click')
  await wrapper.setProps({ on: true })
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('toggle')).toEqual([[true], [false]])
})

it('stays focusable when unavailable, but explains why and ignores selection', async () => {
  const wrapper = badge(false, false)
  const button = wrapper.get('button')
  expect(button.attributes('disabled')).toBeUndefined()
  expect(button.attributes('aria-disabled')).toBe('true')
  expect(button.attributes('aria-pressed')).toBe('false')
  expect(tooltipOf(wrapper).text()).toBe('Content check not available: this server has no OpenAI API key.')
  await button.trigger('click')
  expect(wrapper.emitted('toggle')).toBeUndefined()
})

it('hides the tooltip on Escape until it is hovered or focused afresh', async () => {
  const wrapper = badge(false)
  const root = wrapper.get('.content-check-badge')
  await wrapper.get('button').trigger('keydown', { key: 'Escape' })
  expect(root.classes()).toContain('content-check-badge--dismissed')
  await root.trigger('mouseenter')
  expect(root.classes()).not.toContain('content-check-badge--dismissed')
  await wrapper.get('button').trigger('keydown', { key: 'Escape' })
  await wrapper.get('button').trigger('blur')
  expect(root.classes()).not.toContain('content-check-badge--dismissed')
})
