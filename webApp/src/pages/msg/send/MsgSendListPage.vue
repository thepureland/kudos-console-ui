<!--
 * Message send (batch) list: one row per send batch, with status and success/fail counts. Monitoring
 * view — rows are produced by the system, so there is no add/edit (delete is allowed for cleanup).
 * Filter by send status and instance id.
 *
 * Backend: /api/admin/msg/send (pagingSearch / getDetail / delete / batchDelete)
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-send-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('msgSendList.actions.showColumnPanel')"
      :column-panel-hide-text="t('msgSendList.actions.hideColumnPanel')"
      :operation-column-show-text="t('msgSendList.actions.showOperationColumn')"
      :operation-column-hide-text="t('msgSendList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-status">
          <el-select v-model="searchParams.sendStatusDictCode" :placeholder="t('msgSendList.placeholders.sendStatus')" clearable class="search-status-input" @change="search">
            <el-option v-for="item in getDictItems('msg', 'send_status')" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-instance">
          <el-input v-model="searchParams.instanceId" :placeholder="t('msgSendList.placeholders.instanceId')" clearable class="search-instance-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('msgSendList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('msgSendList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('msgSendList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('msgSendList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('msgSendList.columns.sendStatus')" prop="sendStatusDictCode" min-width="120" sortable="custom" fixed="left" class-name="col-fixed-name">
            <template #default="scope">{{ formatDictCell('msg', 'send_status', scope.row.sendStatusDictCode) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('receiverGroupTypeDictCode')" :label="t('msgSendList.columns.receiverGroupType')" prop="receiverGroupTypeDictCode" :min-width="columnWidths['receiverGroupTypeDictCode'] ?? 130" show-overflow-tooltip>
            <template #default="scope">{{ formatDictCell('msg', 'receiver_group_type', scope.row.receiverGroupTypeDictCode) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('msgTypeDictCode')" :label="t('msgSendList.columns.msgType')" prop="msgTypeDictCode" :min-width="columnWidths['msgTypeDictCode'] ?? 110" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('successCount')" :label="t('msgSendList.columns.successCount')" prop="successCount" :min-width="columnWidths['successCount'] ?? 90" sortable="custom" />
          <el-table-column v-if="isColumnVisible('failCount')" :label="t('msgSendList.columns.failCount')" prop="failCount" :min-width="columnWidths['failCount'] ?? 90" sortable="custom" />
          <el-table-column v-if="isColumnVisible('createTime')" :label="t('msgSendList.columns.createTime')" prop="createTime" :min-width="columnWidths['createTime'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('msgSendList.columns.operation')" align="center" fixed="right" min-width="80" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('msgSendList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('msgSendList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)"><Tickets /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgSendList.actions.delete')" placement="top" :enterable="false">
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

    <msg-send-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import MsgSendDetailPage from './MsgSendDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class MsgSendListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['send_status', 'receiver_group_type'], 'msg');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        sendStatusDictCode: null as string | null,
        instanceId: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'msg/send';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['send_status', 'receiver_group_type'], atomicServiceCode: 'msg' }];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'msgSendList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'msgSendList.visibleColumns';

/**
 * Maps column keys whose i18n label key differs from the column key itself.
 * Keys not listed here fall back to using the column key directly in `t('msgSendList.columns.<key>')`.
 */
const COLUMN_LABEL_KEY: Record<string, string> = {
  receiverGroupTypeDictCode: 'receiverGroupType',
  msgTypeDictCode: 'msgType',
};

const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['receiverGroupTypeDictCode', 'msgTypeDictCode', 'successCount', 'failCount', 'createTime']);

// Sum of the fixed-left columns: selection (39) + index (50) + sendStatus (120).
// Used by useFixedLeftTableWidth to prevent layout jitter when columns are hidden.
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;

export default defineComponent({
  name: 'MsgSendListPage',
  components: { MsgSendDetailPage, ListPageLayout, Delete, Tickets, Search, RefreshLeft },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MsgSendListPage(props, context)) as MsgSendListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('msgSendList.columns.index') : t('msgSendList.columns.' + (COLUMN_LABEL_KEY[key] ?? key))),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    /**
     * Translates a dict code to its display label.
     * `transDict` returns either an i18n key (contains '.') or a raw string;
     * only i18n keys are passed through `t()`.
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
        { key: 'receiverGroupTypeDictCode', getLabel: () => t('msgSendList.columns.receiverGroupType'), sortable: false, getCellText: (row: Record<string, unknown>) => formatDictCell('msg', 'receiver_group_type', row.receiverGroupTypeDictCode) },
        { key: 'msgTypeDictCode', getLabel: () => t('msgSendList.columns.msgType'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.msgTypeDictCode ?? '') },
        { key: 'successCount', getLabel: () => t('msgSendList.columns.successCount'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.successCount ?? '') },
        { key: 'failCount', getLabel: () => t('msgSendList.columns.failCount'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.failCount ?? '') },
        { key: 'createTime', getLabel: () => t('msgSendList.columns.createTime'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.createTime) },
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
.msg-send-list-page .list-page-toolbar .toolbar-status,
.msg-send-list-page .list-page-toolbar .toolbar-instance { margin-right: 8px; }
.msg-send-list-page .list-page-toolbar .toolbar-status .search-status-input { width: 100%; min-width: 140px; }
.msg-send-list-page .list-page-toolbar .toolbar-instance .search-instance-input { width: 100%; min-width: 160px; box-sizing: border-box; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 120px !important; min-width: 120px !important; max-width: 120px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
