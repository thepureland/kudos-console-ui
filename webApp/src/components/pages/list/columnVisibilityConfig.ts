/** Column-visibility config bundle (index column / visible columns / default columns). */
export interface ColumnVisibilityConfig {
  indexColumnKey: 'index';
  allColumnKeys: string[];
  columnVisibilityKeys: string[];
  defaultVisibleColumnKeys: string[];
}

/**
 * Build a list-page column-visibility config in one place to avoid repeating boilerplate constants on every page.
 * The index column is always prepended to columnVisibilityKeys but is NOT included in defaultVisibleColumnKeys
 * (its visibility is controlled separately via indexColumnKey).
 */
export function createColumnVisibilityConfig(allColumnKeys: readonly string[]): ColumnVisibilityConfig {
  // Copy once; reuse the same array reference for allColumnKeys and defaultVisibleColumnKeys
  // (they start identical — callers mutate neither directly).
  const keys = [...allColumnKeys];
  return {
    indexColumnKey: 'index',
    allColumnKeys: keys,
    columnVisibilityKeys: ['index', ...keys],
    defaultVisibleColumnKeys: [...keys],
  };
}
