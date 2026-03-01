import { computed, onMounted, watch } from 'vue';
import { nextTick } from 'vue';
import type { BaseListPage } from './BaseListPage';
import { useTableMaxHeight } from './useTableMaxHeight';

export interface ListPageColumnVisibilityOption {
  storageKey: string;
  columnKeys: string[];
  defaultVisibleKeys: string[];
  /** 列 key -> 显示文案，如 key === 'index' 时返回「行序」等 */
  getColumnLabel: (key: string) => string;
}

export interface UseListPageLayoutOptions {
  /** 列表状态持久化 localStorage key */
  stateStorageKey: string;
  /** 列可见性配置，不传则不做列可见性配置与返回 */
  columnVisibility?: ListPageColumnVisibilityOption;
  /** onMounted 中在 restorePersistedListState + updateTableMaxHeight 之后调用 */
  onAfterMount?: () => void;
  /** watch 中在 persistListState + updateTableMaxHeight 之后调用 */
  onAfterPersist?: () => void;
}

export type ListPageWithState = BaseListPage & { state: Record<string, unknown> };

/**
 * 列表页通用布局与状态逻辑：表格高度、状态持久化、列可见性（可选）。
 * 在 setup 中调用，返回 listLayoutRefs、onTableWrapMounted、以及可选的 visibleColumnKeys/columnVisibilityOptions/isColumnVisible。
 */
export function useListPageLayout(
  listPage: ListPageWithState,
  options: UseListPageLayoutOptions
) {
  const { stateStorageKey, columnVisibility, onAfterMount, onAfterPersist } = options;

  listPage.configureListStatePersistence(stateStorageKey);
  listPage.configureTableMaxHeight();
  if (columnVisibility) {
    listPage.configureColumnVisibility(
      columnVisibility.storageKey,
      columnVisibility.columnKeys,
      columnVisibility.defaultVisibleKeys
    );
  }

  const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
  const listLayoutRefs = { tableWrapRef, paginationRef };

  const visibleColumnKeys = columnVisibility
    ? computed<string[]>({
        get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
        set: (next) => listPage.applyVisibleColumns(next),
      })
    : undefined;
  const columnVisibilityOptions = columnVisibility
    ? computed(() => [
        { key: columnVisibility.columnKeys[0], label: columnVisibility.getColumnLabel(columnVisibility.columnKeys[0]) },
        ...columnVisibility.columnKeys.slice(1).map((key) => ({ key, label: columnVisibility.getColumnLabel(key) })),
      ])
    : undefined;
  /** 判断指定列 key 是否在可见列中 */
  function isColumnVisible(key: string): boolean {
    return listPage.isColumnVisible(key);
  }

  /** 表格容器挂载后调用，用于在 nextTick 中更新表格最大高度；可在此后追加列宽等逻辑 */
  function onTableWrapMounted(): void {
    nextTick(updateTableMaxHeight);
  }

  onMounted(() => {
    listPage.restorePersistedListState();
    nextTick(updateTableMaxHeight);
    onAfterMount?.();
  });

  watch(
    () => [
      listPage.state.searchParams,
      listPage.state.sort,
      listPage.state.pagination,
      listPage.state.tableData,
    ],
    () => {
      listPage.persistListState();
      nextTick(updateTableMaxHeight);
      onAfterPersist?.();
    },
    { deep: true }
  );

  return {
    listLayoutRefs,
    updateTableMaxHeight,
    onTableWrapMounted,
    visibleColumnKeys,
    columnVisibilityOptions,
    isColumnVisible,
  };
}
