import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { BaseListPage } from './BaseListPage';

/**
 * 列表页表格动态高度：根据表格容器顶部与分页栏占位，计算表格 max-height，填满内容区，避免分页下方留白。
 * 用法：在 setup 中调用并 return { tableWrapRef, paginationRef }，模板里用 ref 包住表格、给 el-pagination 加 ref，
 * el-table 使用 :max-height="tableMaxHeight"。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 */
export function useTableMaxHeight(listPage: BaseListPage & { state: { tableMaxHeight?: number } }) {
  const tableWrapRef = ref<HTMLElement | null>(null);
  const paginationRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);

  function getPaginationEl(): HTMLElement | null {
    const p = paginationRef.value;
    if (!p) return null;
    return (p as { $el?: HTMLElement }).$el ?? (p as HTMLElement);
  }

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
