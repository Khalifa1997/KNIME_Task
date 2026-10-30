import { useTemplateRef, watch } from 'vue'
import type { FocusRequest } from './layout'

// Vue Flow renders the focusable node wrapper around a node component, so reach it from the component's root.
// `focusField` is for nodes with Fields; without it, or with `nodeOnly`, the wrapper takes focus.
export function useFocusRequest(
  rootName: string,
  request: () => FocusRequest | null | undefined,
  focusField?: () => boolean,
) {
  const root = useTemplateRef<HTMLElement>(rootName)
  watch(request, (current) => {
    if (!current) return
    if (!current.nodeOnly && focusField?.()) return
    root.value?.closest<HTMLElement>('.vue-flow__node')?.focus({ preventScroll: true })
  })
}
