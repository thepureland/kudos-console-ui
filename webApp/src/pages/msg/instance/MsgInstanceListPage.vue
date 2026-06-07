<!--
 * Message instance list: a concrete message (title + content) materialized from a template,
 * with a validity window. Filter by title and send type.
 *
 * Backend: /api/admin/msg/instance (standard CRUD)
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-instance-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('msgInstanceList.actions.showColumnPanel')"
      :column-panel-hide-text="t('msgInstanceList.actions.hideColumnPanel')"
      :operation-column-show-text="t('msgInstanceList.actions.showOperationColumn')"
      :operation-column-hide-text="t('msgInstanceList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-sendtype">
          <el-select v-model="searchParams.sendTypeDictCode" :placeholder="t('msgInstanceList.placeholders.sendType')" clearable class="search-sendtype-input" @change="search">
            <el-option v-for="opt in SEND_TYPE_OPTIONS" :key="opt" :value="opt" :label="t('msgTemplateCommon.sendType.' + opt)" />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-title">
          <el-input v-model="searchParams.title" :placeholder="t('msgInstanceList.placeholders.title')" clearable class="search-title-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('msgInstanceList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('msgInstanceList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog"><el-icon><Plus /></el-icon>{{ t('msgInstanceList.actions.add') }}</el-button>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('msgInstanceList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('msgInstanceList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('msgInstanceList.columns.title')" prop="title" min-width="180" sortable="custom" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('sendTypeDictCode')" :label="t('msgInstanceList.columns.sendType')" prop="sendTypeDictCode" :min-width="columnWidths['sendTypeDictCode'] ?? 110" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.sendTypeDictCode ? t('msgTemplateCommon.sendType.' + scope.row.sendTypeDictCode) : '—' }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('msgTypeDictCode')" :label="t('msgInstanceList.columns.msgType')" prop="msgTypeDictCode" :min-width="columnWidths['msgTypeDictCode'] ?? 110" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('localeDictCode')" :label="t('msgInstanceList.columns.locale')" prop="localeDictCode" :min-width="columnWidths['localeDictCode'] ?? 100" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('validTimeStart')" :label="t('msgInstanceList.columns.validTimeStart')" prop="validTimeStart" :min-width="columnWidths['validTimeStart'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.validTimeStart) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('validTimeEnd')" :label="t('msgInstanceList.columns.validTimeEnd')" prop="validTimeEnd" :min-width="columnWidths['validTimeEnd'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.validTimeEnd) }}</template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('msgInstanceList.columns.operation')" align="center" fixed="right" min-width="110" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('msgInstanceList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('msgInstanceList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)"><Edit /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgInstanceList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgInstanceList.actions.detail')" placement="top" :enterable="false">
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
      <msg-instance-form-page
        :model-value="formVisible"
        :rid="formRid"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <msg-instance-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import MsgInstanceFormPage from './MsgInstanceFormPage.vue';
import MsgInstanceDetailPage from './MsgInstanceDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const SEND_TYPE_OPTIONS = ['auto', 'manual'];

class MsgInstanceListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        title: null as string | null,
        sendTypeDictCode: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'msg/instance';
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['title'];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'msgInstanceList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'msgInstanceList.visibleColumns';
const COLUMN_LABEL_KEY: Record<string, string> = {
  sendTypeDictCode: 'sendType',
  msgTypeDictCode: 'msgType',
  localeDictCode: 'locale',
};
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['sendTypeDictCode', 'msgTypeDictCode', 'localeDictCode', 'validTimeStart', 'validTimeEnd']);
// Sum of fixed-left column widths: selection (39) + index (50) + title (180)
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 180;

export default defineComponent({
  name: 'MsgInstanceListPage',
  components: { MsgInstanceFormPage, MsgInstanceDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MsgInstanceListPage(props, context)) as MsgInstanceListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const { formVisible, formRid, hasFormEverOpened, currentFormMode, onFormClose, onFormResponse } = useListPageFormSetup({ state, listPage, addHandlerName: 'doAfterAdd', editHandlerName: 'doAfterEdit' });
    // Dispatch to the appropriate post-save hook depending on whether the dialog was opened for add or edit.
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('msgInstanceList.columns.index') : t('msgInstanceList.columns.' + (COLUMN_LABEL_KEY[key] ?? key))),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 269,
      reservedWidthRight: 140,
      createAutoWidthColumns: () => [
        { key: 'sendTypeDictCode', getLabel: () => t('msgInstanceList.columns.sendType'), sortable: true, getCellText: (row: Record<string, unknown>) => (row.sendTypeDictCode ? t('msgTemplateCommon.sendType.' + row.sendTypeDictCode) : '') },
        { key: 'msgTypeDictCode', getLabel: () => t('msgInstanceList.columns.msgType'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.msgTypeDictCode ?? '') },
        { key: 'localeDictCode', getLabel: () => t('msgInstanceList.columns.locale'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.localeDictCode ?? '') },
        { key: 'validTimeStart', getLabel: () => t('msgInstanceList.columns.validTimeStart'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.validTimeStart) },
        { key: 'validTimeEnd', getLabel: () => t('msgInstanceList.columns.validTimeEnd'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.validTimeEnd) },
      ],
    });

    return {
      listPage, OPERATION_COLUMN_PINNED_STORAGE_KEY, SEND_TYPE_OPTIONS,
      ...toRefs(listPage.state), ...toRefs(listPage),
      t, listLayoutRefs, tableRef, onTableWrapMounted,
      visibleColumnKeys, columnVisibilityOptions, isColumnVisible, columnWidths,
      formVisible, formRid, hasFormEverOpened, onFormClose, onFormResponse, handleFormSaved,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.msg-instance-list-page .list-page-toolbar .toolbar-sendtype,
.msg-instance-list-page .list-page-toolbar .toolbar-title { margin-right: 8px; }
.msg-instance-list-page .list-page-toolbar .toolbar-sendtype .search-sendtype-input { width: 100%; min-width: 130px; }
.msg-instance-list-page .list-page-toolbar .toolbar-title .search-title-input { width: 100%; min-width: 160px; box-sizing: border-box; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 180px !important; min-width: 180px !important; max-width: 180px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
