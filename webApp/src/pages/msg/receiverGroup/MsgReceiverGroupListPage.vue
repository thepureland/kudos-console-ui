<!--
 * Message receiver-group list: defines the receiver source (a DB table + name column) referenced by
 * templates and sends. Filter by receiver-group type.
 *
 * Backend: /api/admin/msg/receiverGroup (standard CRUD + updateActive)
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-receiver-group-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('msgReceiverGroupList.actions.showColumnPanel')"
      :column-panel-hide-text="t('msgReceiverGroupList.actions.hideColumnPanel')"
      :operation-column-show-text="t('msgReceiverGroupList.actions.showOperationColumn')"
      :operation-column-hide-text="t('msgReceiverGroupList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-type">
          <el-select v-model="searchParams.receiverGroupTypeDictCode" :placeholder="t('msgReceiverGroupList.placeholders.groupType')" clearable class="search-type-input" @change="search">
            <el-option v-for="item in getDictItems('msg', 'receiver_group_type')" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('msgReceiverGroupList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('msgReceiverGroupList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog"><el-icon><Plus /></el-icon>{{ t('msgReceiverGroupList.actions.add') }}</el-button>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('msgReceiverGroupList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('msgReceiverGroupList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('msgReceiverGroupList.columns.defineTable')" prop="defineTable" min-width="180" sortable="custom" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('receiverGroupTypeDictCode')" :label="t('msgReceiverGroupList.columns.groupType')" prop="receiverGroupTypeDictCode" :min-width="columnWidths['receiverGroupTypeDictCode'] ?? 140" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDictCell('msg', 'receiver_group_type', scope.row.receiverGroupTypeDictCode) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('nameColumn')" :label="t('msgReceiverGroupList.columns.nameColumn')" prop="nameColumn" :min-width="columnWidths['nameColumn'] ?? 140" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('active')" :label="t('msgReceiverGroupList.columns.active')" prop="active" :min-width="columnWidths['active'] ?? 90">
            <template #default="scope">
              <el-switch v-model="scope.row.active" :disabled="scope.row.builtIn === true" @change="updateActive(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('builtIn')" :label="t('msgReceiverGroupList.columns.builtIn')" prop="builtIn" :min-width="columnWidths['builtIn'] ?? 90">
            <template #default="scope">{{ scope.row.builtIn ? t('msgReceiverGroupList.common.yes') : t('msgReceiverGroupList.common.no') }}</template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('msgReceiverGroupList.columns.operation')" align="center" fixed="right" min-width="110" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('msgReceiverGroupList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('msgReceiverGroupList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)"><Edit /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgReceiverGroupList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgReceiverGroupList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)"><Tickets /></el-icon>
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

    <div v-if="hasFormEverOpened" v-show="formVisible">
      <msg-receiver-group-form-page
        :model-value="formVisible"
        :rid="formRid"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <msg-receiver-group-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import MsgReceiverGroupFormPage from './MsgReceiverGroupFormPage.vue';
import MsgReceiverGroupDetailPage from './MsgReceiverGroupDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class MsgReceiverGroupListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['receiver_group_type'], 'msg');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        receiverGroupTypeDictCode: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'msg/receiverGroup';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['receiver_group_type'], atomicServiceCode: 'msg' }];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'msgReceiverGroupList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'msgReceiverGroupList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['receiverGroupTypeDictCode', 'nameColumn', 'active', 'builtIn']);
/** Sum of the three always-visible fixed-left columns: selection (39) + index (50) + defineTable (180). */
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 180;

export default defineComponent({
  name: 'MsgReceiverGroupListPage',
  components: { MsgReceiverGroupFormPage, MsgReceiverGroupDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MsgReceiverGroupListPage(props, context)) as MsgReceiverGroupListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const { formVisible, formRid, hasFormEverOpened, currentFormMode, onFormClose, onFormResponse } = useListPageFormSetup({ state, listPage, addHandlerName: 'doAfterAdd', editHandlerName: 'doAfterEdit' });
    /** Dispatches the form-saved callback to the correct post-save handler based on the current mode. */
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        // Maps column keys to their i18n labels. 'receiverGroupTypeDictCode' uses the shorter
        // 'groupType' key because the i18n namespace mirrors the UI label, not the field name.
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('msgReceiverGroupList.columns.index') : t('msgReceiverGroupList.columns.' + (key === 'receiverGroupTypeDictCode' ? 'groupType' : key))),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    /**
     * Translates a dict code to its display label.
     * transDict returns an i18n key (e.g. "msg.receiver_group_type.internal") or a raw string.
     * Returns an em dash when no mapping exists (e.g. null/unknown code).
     */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      if (!key) return '—';
      // If it looks like a dotted i18n key, resolve it; otherwise use the raw value directly.
      return key.includes('.') ? t(key) : key;
    }

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 269,
      reservedWidthRight: 140,
      createAutoWidthColumns: () => [
        { key: 'receiverGroupTypeDictCode', getLabel: () => t('msgReceiverGroupList.columns.groupType'), sortable: true, getCellText: (row: Record<string, unknown>) => formatDictCell('msg', 'receiver_group_type', row.receiverGroupTypeDictCode) },
        { key: 'nameColumn', getLabel: () => t('msgReceiverGroupList.columns.nameColumn'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.nameColumn ?? '') },
      ],
    });

    return {
      listPage, OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state), ...toRefs(listPage),
      t, listLayoutRefs, tableRef, onTableWrapMounted,
      visibleColumnKeys, columnVisibilityOptions, isColumnVisible, columnWidths, formatDictCell,
      formVisible, formRid, hasFormEverOpened, onFormClose, onFormResponse, handleFormSaved,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.msg-receiver-group-list-page .list-page-toolbar .toolbar-type { margin-right: 8px; }
.msg-receiver-group-list-page .list-page-toolbar .toolbar-type .search-type-input { width: 100%; min-width: 160px; box-sizing: border-box; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 180px !important; min-width: 180px !important; max-width: 180px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
