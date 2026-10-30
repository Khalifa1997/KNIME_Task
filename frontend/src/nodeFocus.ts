import { useTemplateRef } from 'vue'

// Vue Flow renders the focusable node wrapper around a node component, so reach it from the component's root.
export function useNodeWrapperFocus(rootName: string) {
  const root = useTemplateRef<HTMLElement>(rootName)
  return () => root.value?.closest<HTMLElement>('.vue-flow__node')?.focus({ preventScroll: true })
}
