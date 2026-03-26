import { computed } from 'vue';
import type { PageContext, PageProps } from '../core/pageTypes';

/**
 * 提供详情弹窗通用的 visible/close 绑定。
 */
export function useDetailDialogVisibility(props: PageProps, context: PageContext) {
  const visible = computed(() => props.modelValue as boolean);
  function close() {
    context.emit('update:modelValue', false);
  }
  return { visible, close };
}
