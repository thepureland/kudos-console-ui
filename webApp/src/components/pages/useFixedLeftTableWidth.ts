import { nextTick } from 'vue';
import type { Ref } from 'vue';

/**
 * 列表页固定左侧列总宽度：在表格 doLayout 后把 .el-table__fixed-left 的宽度设为指定像素。
 * 用于选择列+序号列+固定名称列等左侧固定区域宽度一致，避免错位。
 *
 * @param tableRef 表格组件 ref（需有 doLayout、$el）
 * @param totalWidthPx 固定左侧总宽度（px），如 39 + 50 + 120
 * @returns forceFixedLeftWidth 无参函数，调用后在下个 nextTick 内设置宽度
 */
export function useFixedLeftTableWidth(
  tableRef: Ref<{ doLayout?: () => void; $el?: HTMLElement } | null>,
  totalWidthPx: number
): () => void {
  return function forceFixedLeftWidth(): void {
    nextTick(() => {
      tableRef.value?.doLayout?.();
      nextTick(() => {
        const wrapper = tableRef.value?.$el?.querySelector?.('.el-table__fixed-left') as HTMLElement | null;
        if (wrapper) {
          wrapper.style.setProperty('width', `${totalWidthPx}px`, 'important');
          wrapper.style.setProperty('max-width', `${totalWidthPx}px`, 'important');
        }
      });
    });
  };
}
