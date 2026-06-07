<!--
 * Message receive list: per-receiver delivery record within a send batch. Monitoring view — rows are
 * produced by the system, so there is no add/edit (delete is allowed for cleanup). Filter by receive
 * status and send id.
 *
 * Backend: /api/admin/msg/receive (pagingSearch / getDetail / delete / batchDelete)
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-receive-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('msgReceiveList.actions.showColumnPanel')"
      :column-panel-hide-text="t('msgReceiveList.actions.hideColumnPanel')"
      :operation-column-show-text="t('msgReceiveList.actions.showOperationColumn')"
      :operation-column-hide-text="t('msgReceiveList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-status">
          <el-select v-model="searchParams.receiveStatusDictCode" :placeholder="t('msgReceiveList.placeholders.receiveStatus')" clearable class="search-status-input" @change="search">
            <el-option v-for="item in getDictItems('msg', 'receive_status')" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-send">
          <el-input v-model="searchParams.sendId" :placeholder="t('msgReceiveList.placeholders.sendId')" clearable class="search-send-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('msgReceiveList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('msgReceiveList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('msgReceiveList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('msgReceiveList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('msgReceiveList.columns.receiveStatus')" prop="receiveStatusDictCode" min-width="120" sortable="custom" fixed="left" class-name="col-fixed-name">
            <template #default="scope">{{ formatDictCell('msg', 'receive_status', scope.row.receiveStatusDictCode) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('receiverId')" :label="t('msgReceiveList.columns.receiverId')" prop="receiverId" :min-width="columnWidths['receiverId'] ?? 180" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('sendId')" :label="t('msgReceiveList.columns.sendId')" prop="sendId" :min-width="columnWidths['sendId'] ?? 180" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('createTime')" :label="t('msgReceiveList.columns.createTime')" prop="createTime" :min-width="columnWidths['createTime'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('msgReceiveList.columns.operation')" align="center" fixed="right" min-width="80" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('msgReceiveList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('msgReceiveList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)"><Tickets /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgReceiveList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #pagination>
        <el-pagination
          :ref="(el: unknown) => { listLayoutRefs.paginationRef.value = (el as { $el?: HTMLElement } | HTMLElement | null) ?? null; }"
          class="pagination-right"
          :current-page="pagination.pageNo"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </template>
    </list-page-layout>

    <msg-receive-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import MsgReceiveDetailPage from './MsgReceiveDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class MsgReceiveListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['receive_status'], 'msg');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        receiveStatusDictCode: null as string | null,
        sendId: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'msg/receive';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['receive_status'], atomicServiceCode: 'msg' }];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'msgReceiveList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'msgReceiveList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['receiverId', 'sendId', 'createTime']);
// Sum of fixed-left column widths: selection(39) + index(50) + receiveStatus(120).
// Used by useFixedLeftTableWidth to prevent layout thrash when columns are toggled.
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;

export default defineComponent({
  name: 'MsgReceiveListPage',
  components: { MsgReceiveDetailPage, ListPageLayout, Delete, Tickets, Search, RefreshLeft },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MsgReceiveListPage(props, context)) as MsgReceiveListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('msgReceiveList.columns.index') : t('msgReceiveList.columns.' + key)),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    /**
     * Translate a dictionary code to its display label.
     * transDict returns either a dotted i18n key (e.g. "msg.receive_status.sent") or a raw
     * display string. Only pass dotted values through the i18n translator.
     */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      if (!key) return '—';
      return key.includes('.') ? t(key) : key;
    }

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 209,
      reservedWidthRight: 100,
      createAutoWidthColumns: () => [
        { key: 'receiverId', getLabel: () => t('msgReceiveList.columns.receiverId'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.receiverId ?? '') },
        { key: 'sendId', getLabel: () => t('msgReceiveList.columns.sendId'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.sendId ?? '') },
        { key: 'createTime', getLabel: () => t('msgReceiveList.columns.createTime'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.createTime) },
      ],
    });

    return {
      listPage, OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state), ...toRefs(listPage),
      t, listLayoutRefs, tableRef, onTableWrapMounted,
      visibleColumnKeys, columnVisibilityOptions, isColumnVisible, columnWidths, formatDictCell,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.msg-receive-list-page .list-page-toolbar .toolbar-status,
.msg-receive-list-page .list-page-toolbar .toolbar-send { margin-right: 8px; }
.msg-receive-list-page .list-page-toolbar .toolbar-status .search-status-input { width: 100%; min-width: 140px; }
.msg-receive-list-page .list-page-toolbar .toolbar-send .search-send-input { width: 100%; min-width: 160px; box-sizing: border-box; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
