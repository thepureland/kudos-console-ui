/** 列可见性配置项集合（索引列/可见列/默认列）。 */
export interface ColumnVisibilityConfig {
  indexColumnKey: 'index';
  allColumnKeys: string[];
  columnVisibilityKeys: string[];
  defaultVisibleColumnKeys: string[];
}

/**
 * 统一生成列表页列可见性配置，避免每个页面重复声明样板常量。
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
