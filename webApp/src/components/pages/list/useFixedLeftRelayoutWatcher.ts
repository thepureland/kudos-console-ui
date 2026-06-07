import { nextTick, watch } from 'vue';

/**
 * Watch column visibility and operation-column show/hide, triggering a unified relayout of the table's fixed-left columns.
 * Both watchers call relayout after the next DOM flush so the table has already updated its column widths.
 */
export function useFixedLeftRelayoutWatcher(
  listPage: { state?: Record<string, unknown> },
  relayout: () => void
): void {
  // Capture state once; it is a plain reactive object so accessing it via a getter is fine.
  const getState = () => listPage.state ?? {} as Record<string, unknown>;

  // visibleColumnKeys is an array, so deep-watch to catch mutations as well as replacement.
  watch(
    () => getState().visibleColumnKeys,
    () => { nextTick(relayout); },
    { deep: true }
  );

  // showOperationColumn is a primitive; shallow watch is sufficient.
  watch(
    () => getState().showOperationColumn,
    () => { nextTick(relayout); }
  );
}
