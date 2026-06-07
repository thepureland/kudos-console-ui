/**
 * Lightweight shared visibility state for list pages:
 * - column-visibility lookup delegated to the list-page instance
 * - layout trigger called after the table wrapper mounts (runs doLayout + fixed-width correction)
 */
export function useListPageVisibilityState(
  listPage: { isColumnVisible: (key: string) => boolean },
  layoutOnTableWrapMounted: () => void
) {
  // Expose both helpers under stable, template-friendly names without adding
  // any extra logic — keeps callers decoupled from the listPage internals.
  return {
    isColumnVisible: (key: string): boolean => listPage.isColumnVisible(key),
    onTableWrapMounted: layoutOnTableWrapMounted,
  };
}
