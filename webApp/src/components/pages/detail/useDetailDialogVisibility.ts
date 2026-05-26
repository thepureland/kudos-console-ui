import { computed } from 'vue';
import type { PageContext, PageProps } from '../core/pageTypes';

/**
 * Provides common visible/close bindings for detail dialogs.
 */
export function useDetailDialogVisibility(props: PageProps, context: PageContext) {
  const visible = computed(() => props.modelValue as boolean);
  function close() {
    context.emit('update:modelValue', false);
  }
  return { visible, close };
}
