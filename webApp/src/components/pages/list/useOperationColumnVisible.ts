import { computed } from 'vue';

/**
 * Provides the operation-column visibility state in one place.
 */
export function useOperationColumnVisible(listPage: { state?: Record<string, unknown> }) {
  return computed(() => Boolean(listPage.state?.showOperationColumn));
}
