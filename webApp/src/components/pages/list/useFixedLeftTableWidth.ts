import { nextTick } from 'vue';
import type { Ref } from 'vue';

/**
 * List-page fixed left column total width: after the table's doLayout, set the width of `.el-table__fixed-left` to the given pixel value.
 * Keeps the left-fixed area (selection column + index column + fixed name column) at a consistent width and avoids misalignment.
 *
 * @param tableRef table component ref (must expose doLayout and $el)
 * @param totalWidthPx total fixed-left width in px, e.g. 39 + 50 + 120
 * @returns forceFixedLeftWidth no-arg function; calling it sets the width on the next nextTick
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
