import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

interface UseTableAutoWidthContextOptions {
  listPage: { state: Record<string, unknown> };
  reservedWidthLeft: number;
  reservedWidthRight: number;
  createAutoWidthColumns: () => Array<Record<string, unknown>>;
}

/**
 * Lightweight wrapper around the auto column-width context for list pages:
 * - unifies reserved left/right width constants
 * - unifies the tableDataRef / autoWidthColumns / columnWidths boilerplate
 */
export function useTableAutoWidthContext(options: UseTableAutoWidthContextOptions): {
  RESERVED_WIDTH_LEFT: number;
  RESERVED_WIDTH_RIGHT: number;
  autoWidthColumns: ComputedRef<Array<Record<string, unknown>>>;
  tableDataRef: ComputedRef<Array<Record<string, unknown>>>;
  columnWidths: Ref<Record<string, number>>;
} {
  const { listPage, reservedWidthLeft, reservedWidthRight, createAutoWidthColumns } = options;
  const RESERVED_WIDTH_LEFT = reservedWidthLeft;
  const RESERVED_WIDTH_RIGHT = reservedWidthRight;
  const autoWidthColumns = computed(() => createAutoWidthColumns());
  const tableDataRef = computed(
    () => (listPage.state as Record<string, unknown>).tableData as Array<Record<string, unknown>>
  );
  const columnWidths = ref<Record<string, number>>({});
  return {
    RESERVED_WIDTH_LEFT,
    RESERVED_WIDTH_RIGHT,
    autoWidthColumns,
    tableDataRef,
    columnWidths,
  };
}
