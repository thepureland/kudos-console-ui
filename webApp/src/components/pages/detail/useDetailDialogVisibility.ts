import { computed } from 'vue';
import type { PageContext, PageProps } from '../core/pageTypes';

/**
 * Provides common visible/close bindings for detail dialogs.
 */
export function useDetailDialogVisibility(props: PageProps, context: PageContext) {
  // PageProps is Record<string, unknown>, so the cast is required to narrow modelValue to boolean
  const visible = computed(() => props.modelValue as boolean);
  function close() {
    context.emit('update:modelValue', false);
  }
  return { visible, close };
}
