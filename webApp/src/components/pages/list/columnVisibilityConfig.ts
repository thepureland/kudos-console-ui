/** Column-visibility config bundle (index column / visible columns / default columns). */
export interface ColumnVisibilityConfig {
  indexColumnKey: 'index';
  allColumnKeys: string[];
  columnVisibilityKeys: string[];
  defaultVisibleColumnKeys: string[];
}

/**
 * Build a list-page column-visibility config in one place to avoid repeating boilerplate constants on every page.
 */
export function createColumnVisibilityConfig(allColumnKeys: readonly string[]): ColumnVisibilityConfig {
  const normalizedAllColumnKeys = [...allColumnKeys];
  return {
    indexColumnKey: 'index',
    allColumnKeys: normalizedAllColumnKeys,
    columnVisibilityKeys: ['index', ...normalizedAllColumnKeys],
    defaultVisibleColumnKeys: [...normalizedAllColumnKeys],
  };
}
