import { computed } from 'vue';
import type { ComputedRef } from 'vue';

/** A single option shown in the column-visibility toggle panel. */
export interface ColumnVisibilityOption {
  key: string;
  label: string;
}

interface UseColumnVisibilityOptionsOptions {
  /** The key that identifies the index/row-number column (always prepended to the list). */
  indexColumnKey: string;
  /** Returns the localised label for the index column. */
  getIndexLabel: () => string;
  /** Returns the ordered list of data-column keys to include in the panel. */
  getColumnKeys: () => string[];
  /** Returns the localised label for a given column key. */
  getColumnLabel: (key: string) => string;
}

/**
 * Build column-visibility panel options in one place to avoid duplicated computed boilerplate across pages.
 * The index column is always the first entry; remaining columns follow `getColumnKeys()` order.
 */
export function useColumnVisibilityOptions(
  options: UseColumnVisibilityOptionsOptions
): ComputedRef<ColumnVisibilityOption[]> {
  const { indexColumnKey, getIndexLabel, getColumnKeys, getColumnLabel } = options;
  return computed<ColumnVisibilityOption[]>(() => [
    { key: indexColumnKey, label: getIndexLabel() },
    ...getColumnKeys().map((key) => ({ key, label: getColumnLabel(key) })),
  ]);
}
