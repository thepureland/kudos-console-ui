import { computed } from 'vue';

interface UseColumnVisibilityOptionsOptions {
  indexColumnKey: string;
  getIndexLabel: () => string;
  getColumnKeys: () => string[];
  getColumnLabel: (key: string) => string;
}

/**
 * Build column-visibility panel options in one place to avoid duplicated computed boilerplate across pages.
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
