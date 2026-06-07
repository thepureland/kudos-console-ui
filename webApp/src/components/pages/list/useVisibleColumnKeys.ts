import { computed } from 'vue';

/**
 * Two-way computed binding for column visibility.
 * Reading returns the current visibleColumnKeys from listPage state (falls back to empty array).
 * Writing delegates to applyVisibleColumns so callers can bind this directly to the column-picker component.
 */
export function useVisibleColumnKeys(listPage: {
  state: Record<string, unknown>;
  applyVisibleColumns: (next: string[]) => void;
}) {
  return computed<string[]>({
    // state is already typed as Record<string, unknown>, so only one cast to string[] is needed.
    get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
    set: (next) => listPage.applyVisibleColumns(next),
  });
}
