import { nextTick, watch } from 'vue';

/**
 * Watch column visibility and operation-column show/hide, triggering a unified relayout of the table's fixed-left columns.
 */
export function useFixedLeftRelayoutWatcher(
  listPage: { state?: Record<string, unknown> },
  relayout: () => void
): void {
  watch(
    () => (listPage.state as Record<string, unknown>).visibleColumnKeys,
    () => { nextTick(relayout); },
    { deep: true }
  );
  watch(
    () => (listPage.state as Record<string, unknown>).showOperationColumn,
    () => { nextTick(relayout); }
  );
}
