import { computed } from 'vue';

/**
 * Two-way binding for column visibility: reads listPage.state.visibleColumnKeys and writes back via applyVisibleColumns.
 */
export function useVisibleColumnKeys(listPage: {
  state: Record<string, unknown>;
  applyVisibleColumns: (next: string[]) => void;
}) {
  return computed<string[]>({
    get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
    set: (next) => listPage.applyVisibleColumns(next),
  });
}
