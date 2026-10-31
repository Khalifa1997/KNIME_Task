import { mount } from '@vue/test-utils'
import { Position } from '@xyflow/vue'
import { describe, expect, it } from 'vitest'
import FlowEdge from '../components/FlowEdge.vue'

type EdgeData = { index: number; filling: boolean; flash: 'success' | 'danger' | null; reducedMotion: boolean }

function mountEdge(data: Partial<EdgeData> = {}) {
  return mount(FlowEdge, {
    props: {
      id: 'a->b',
      source: 'a',
      target: 'b',
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { index: 0, filling: false, flash: null, reducedMotion: false, ...data },
    },
  })
}

describe('the flow edge', () => {
  it('always draws a dashed base stroke that flows, and nothing else when idle', () => {
    const wrapper = mountEdge()
    expect(wrapper.findAll('path')).toHaveLength(1)
    expect(wrapper.get('path').classes()).not.toContain('flow-edge__base--still')
  })

  it('draws the fill over 300 ms, staggered by position in the Chain', () => {
    const fill = mountEdge({ filling: true, index: 2 }).findAll('path')[1]!
    expect(fill.element.getAttribute('pathLength')).toBe('1')
    expect(fill.attributes('style')).toContain('animation-duration: 300ms')
    expect(fill.attributes('style')).toContain('animation-delay: 600ms')
  })

  it('flashes yellow on success and red on failure', () => {
    expect(mountEdge({ flash: 'success' }).get('.flow-edge__flash').classes()).toContain('flow-edge__flash--success')
    expect(mountEdge({ flash: 'danger' }).get('.flow-edge__flash').classes()).toContain('flow-edge__flash--danger')
  })

  it('under reduced motion stops flowing, shows the fill at once and does not flash', () => {
    const wrapper = mountEdge({ reducedMotion: true, filling: true, flash: 'danger' })
    expect(wrapper.get('.flow-edge__base').classes()).toContain('flow-edge__base--still')
    expect(wrapper.get('.flow-edge__fill').classes()).toContain('flow-edge__fill--drawn')
    expect(wrapper.find('.flow-edge__flash').exists()).toBe(false)
  })
})
