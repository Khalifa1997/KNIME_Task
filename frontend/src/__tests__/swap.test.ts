import { beforeEach, expect, it } from 'vitest'
import { stepUnderPointer } from '../swap'

function nodeElement(id: string, kind: 'step' | 'inputtext' | 'outputtext') {
  const element = document.createElement('div')
  element.className = `vue-flow__node vue-flow__node-${kind}`
  element.dataset.id = id
  const inner = document.createElement('h2')
  element.append(inner)
  document.body.append(element)
  return { element, inner }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

it('picks the nearest Step under the pointer and skips the dragged one', () => {
  const dragged = nodeElement('a', 'step')
  const target = nodeElement('b', 'step')
  const farther = nodeElement('c', 'step')
  // elementsFromPoint lists the topmost element first.
  const stack = [dragged.inner, dragged.element, target.inner, target.element, farther.element]
  expect(stepUnderPointer(stack, 'a')).toBe('b')
})

it('finds nothing over Input text, Output or the empty canvas', () => {
  const dragged = nodeElement('a', 'step')
  const input = nodeElement('input', 'inputtext')
  const output = nodeElement('output', 'outputtext')
  const pane = document.createElement('div')
  pane.className = 'vue-flow__pane'
  expect(stepUnderPointer([dragged.element, input.inner, input.element], 'a')).toBeNull()
  expect(stepUnderPointer([dragged.element, output.element], 'a')).toBeNull()
  expect(stepUnderPointer([dragged.element, pane], 'a')).toBeNull()
})
