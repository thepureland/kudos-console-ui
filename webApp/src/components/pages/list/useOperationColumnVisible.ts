import { computed } from 'vue';

/**
 * 统一提供操作列显示状态。
 */
export function useOperationColumnVisible(listPage: { state?: Record<string, unknown> }) {
  return computed(() => Boolean(listPage.state?.showOperationColumn));
}
