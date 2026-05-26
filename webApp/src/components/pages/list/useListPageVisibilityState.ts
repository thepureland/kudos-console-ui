/**
 * Lightweight shared visibility state for list pages:
 * - column-visibility lookup
 * - layout trigger after the table wrapper mounts
 */
export function useListPageVisibilityState(
  listPage: { isColumnVisible: (key: string) => boolean },
  layoutOnTableWrapMounted: () => void
) {
  function isColumnVisible(key: string): boolean {
    return listPage.isColumnVisible(key);
  }

  function onTableWrapMounted(): void {
    layoutOnTableWrapMounted();
  }

  return {
    isColumnVisible,
    onTableWrapMounted,
  };
}
