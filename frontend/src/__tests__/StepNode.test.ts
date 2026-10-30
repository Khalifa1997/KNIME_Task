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
