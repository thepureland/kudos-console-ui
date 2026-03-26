import { nextTick, watch } from 'vue';

/**
 * 监听列可见性与操作列显隐，统一触发表格固定左列重布局。
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
