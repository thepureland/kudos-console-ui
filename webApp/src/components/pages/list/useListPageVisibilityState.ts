/**
 * 列表页可见性相关的轻量公共状态：
 * - 列是否可见判断
 * - 表格容器挂载后的布局触发
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
