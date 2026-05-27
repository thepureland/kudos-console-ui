import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { BaseListPage } from '../core/BaseListPage';

/**
 * Dynamic list-page table height: compute the table's max-height from the table wrapper's top and the pagination bar's footprint so the table fills the content area without leaving blank space below the pagination.
 * Usage: call this in setup and return { tableWrapRef, paginationRef }; in the template, wrap the table with that ref, attach a ref to el-pagination, and bind el-table with :max-height="tableMaxHeight".
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 */
export function useTableMaxHeight(listPage: BaseListPage & { state: { tableMaxHeight?: number } }) {
  const tableWrapRef = ref<HTMLElement | null>(null);
  const paginationRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);

  /** Extract the actual DOM element from paginationRef (which may be a component instance or a DOM node) */
  function getPaginationEl(): HTMLElement | null {
    const p = paginationRef.value;
    if (!p) return null;
    return (p as { $el?: HTMLElement }).$el ?? (p as HTMLElement);
  }

  /** Recompute and write listPage.state.tableMaxHeight from the table wrapper and pagination element */
  function updateTableMaxHeight() {
    listPage.updateTableMaxHeightByElements(tableWrapRef.value, getPaginationEl());
  }

  onMounted(() => {
    nextTick(updateTableMaxHeight);
    window.addEventListener('resize', updateTableMaxHeight);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateTableMaxHeight);
  });

  return { tableWrapRef, paginationRef, updateTableMaxHeight };
}
