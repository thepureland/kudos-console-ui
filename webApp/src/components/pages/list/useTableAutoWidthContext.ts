import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

interface UseTableAutoWidthContextOptions {
  /** List-page instance whose `state.tableData` drives the table rows. */
  listPage: { state: Record<string, unknown> };
  /** Total pixel width reserved for fixed columns on the left (selection + index + name, etc.). */
  reservedWidthLeft: number;
  /** Total pixel width reserved for fixed columns on the right (actions, etc.). */
  reservedWidthRight: number;
  /** Factory that returns the column descriptors eligible for automatic width calculation. */
  createAutoWidthColumns: () => Array<Record<string, unknown>>;
}

/**
 * Centralises the auto column-width boilerplate shared across list pages:
 * - exposes the reserved left/right width constants under a consistent name
 * - derives `autoWidthColumns` and `tableDataRef` as computed properties
 * - provides a shared `columnWidths` map updated by the auto-width logic
 */
export function useTableAutoWidthContext(options: UseTableAutoWidthContextOptions): {
  RESERVED_WIDTH_LEFT: number;
  RESERVED_WIDTH_RIGHT: number;
  autoWidthColumns: ComputedRef<Array<Record<string, unknown>>>;
  tableDataRef: ComputedRef<Array<Record<string, unknown>>>;
  columnWidths: Ref<Record<string, number>>;
} {
  const { listPage, reservedWidthLeft, reservedWidthRight, createAutoWidthColumns } = options;

  const autoWidthColumns = computed(() => createAutoWidthColumns());
  const tableDataRef = computed(
    () => listPage.state.tableData as Array<Record<string, unknown>>
  );
  const columnWidths = ref<Record<string, number>>({});

  return {
    RESERVED_WIDTH_LEFT: reservedWidthLeft,
    RESERVED_WIDTH_RIGHT: reservedWidthRight,
    autoWidthColumns,
    tableDataRef,
    columnWidths,
  };
}
