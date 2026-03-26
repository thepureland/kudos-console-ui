import { computed } from 'vue';

/**
 * 列可见性双向绑定：读取 listPage.state.visibleColumnKeys，并写回 applyVisibleColumns。
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
