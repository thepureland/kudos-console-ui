import { computed } from 'vue';

interface UseColumnVisibilityOptionsOptions {
  indexColumnKey: string;
  getIndexLabel: () => string;
  getColumnKeys: () => string[];
  getColumnLabel: (key: string) => string;
}

/**
 * 统一生成列可见性面板选项，避免页面内重复 computed 样板。
 */
export function useColumnVisibilityOptions(options: UseColumnVisibilityOptionsOptions) {
  const { indexColumnKey, getIndexLabel, getColumnKeys, getColumnLabel } = options;
  return computed(() => [
    { key: indexColumnKey, label: getIndexLabel() },
    ...getColumnKeys().map((key) => ({
      key,
      label: getColumnLabel(key),
    })),
  ]);
}
