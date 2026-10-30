// The Step a dragged Step would swap with: the nearest Step among the elements under the pointer
// (as listed by document.elementsFromPoint, topmost first), skipping the dragged node itself.
// Over Input text, Output or the empty canvas there is none.
export function stepUnderPointer(elementsUnderPointer: Element[], draggedId: string): string | null {
  for (const element of elementsUnderPointer) {
    const node = element.closest<HTMLElement>('.vue-flow__node')
    if (!node || node.dataset.id === draggedId) continue
    return node.classList.contains('vue-flow__node-step') ? (node.dataset.id ?? null) : null
  }
  return null
}
