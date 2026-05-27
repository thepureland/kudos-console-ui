import { computed, onMounted, onActivated, onDeactivated, watch } from 'vue';
import { nextTick } from 'vue';
import { useStore } from 'vuex';
import type { BaseListPage } from '../core/BaseListPage';
import { useTableMaxHeight } from './useTableMaxHeight';
import { getGlobalLocale, loadMessagesForConfig } from '../../../i18n';

/** Column-visibility panel config. */
export interface ListPageColumnVisibilityOption {
  storageKey: string;
  columnKeys: string[];
  defaultVisibleKeys: string[];
  /** Column key -> display label; e.g. when key === 'index' returns "Row #" */
  getColumnLabel: (key: string) => string;
}

/** Composite list-layout options. */
export interface UseListPageLayoutOptions {
  /** localStorage key for persisting list state; if omitted or empty, search results are not preserved across close/reopen (no persistence by default) */
  stateStorageKey?: string | null;
  /** Whether to reset when leaving the page (default false); on tab close the store records the path, and the reset happens on the next activation so "tab switching" preserves state */
  resetStateOnDeactivate?: boolean;
  /** Column-visibility config; if omitted, column visibility is neither configured nor returned */
  columnVisibility?: ListPageColumnVisibilityOption;
  /** Called inside onMounted after restorePersistedListState + updateTableMaxHeight */
  onAfterMount?: () => void;
  /** Called inside the watch after persistListState + updateTableMaxHeight */
  onAfterPersist?: () => void;
}

/** List-page instance type with state. */
export type ListPageWithState = BaseListPage & { state: Record<string, unknown> };

/**
 * Shared list-page layout and state logic: table height, state persistence, and optional column visibility.
 * Call inside setup; returns listLayoutRefs, onTableWrapMounted, and optionally visibleColumnKeys/columnVisibilityOptions/isColumnVisible.
 */
export function useListPageLayout(
  listPage: ListPageWithState,
  options: UseListPageLayoutOptions
) {
  const { stateStorageKey, resetStateOnDeactivate = false, columnVisibility, onAfterMount, onAfterPersist } = options;
  const store = useStore();

  if (stateStorageKey) {
    listPage.configureListStatePersistence(stateStorageKey);
  }
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
  /** Determine whether the given column key is in the visible-columns list */
  function isColumnVisible(key: string): boolean {
    return listPage.isColumnVisible(key);
  }

  /** Called after the table wrapper mounts to update the table's max height on the next nextTick; additional logic like column widths can be appended after this */
  function onTableWrapMounted(): void {
    nextTick(updateTableMaxHeight);
  }

  onMounted(() => {
    listPage.restorePersistedListState();
    nextTick(updateTableMaxHeight);
    onAfterMount?.();
  });

  /** On activation: if this path was recorded when its tag was closed, reset the list state (no reset on tab switch — only when the tag was closed and then reopened) */
  onActivated(() => {
    const path = (store.state as { currentMenuPath?: string }).currentMenuPath;
    const resetPaths = (store.state as { listStateResetPaths?: string[] }).listStateResetPaths;
    if (path && resetPaths?.includes(path)) {
      listPage.resetSearchAndTableOnLeave();
      store.commit('removeListStateResetPath', path);
    }
  });
  if (resetStateOnDeactivate) {
    onDeactivated(() => listPage.resetSearchAndTableOnLeave());
  }

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

  /** On locale change, reload this page's dict-item and other i18n so dropdowns using t(item.second) reflect the new language */
  watch(
    () => getGlobalLocale(),
    () => {
      const config = (listPage as unknown as { getI18nConfig?: () => { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode: string }[] }).getI18nConfig?.();
      if (config?.length) loadMessagesForConfig(config);
    },
    { immediate: false }
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
