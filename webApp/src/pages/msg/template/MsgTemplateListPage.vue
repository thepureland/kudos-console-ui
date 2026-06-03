<!--
 * Message template list: notification templates resolved by (tenant, eventType, msgType, locale).
 * Filter by title and send type.
 *
 * Backend: /api/admin/msg/template (standard CRUD)
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-template-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('msgTemplateList.actions.showColumnPanel')"
      :column-panel-hide-text="t('msgTemplateList.actions.hideColumnPanel')"
      :operation-column-show-text="t('msgTemplateList.actions.showOperationColumn')"
      :operation-column-hide-text="t('msgTemplateList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-sendtype">
          <el-select v-model="searchParams.sendTypeDictCode" :placeholder="t('msgTemplateList.placeholders.sendType')" clearable class="search-sendtype-input" @change="search">
            <el-option v-for="opt in SEND_TYPE_OPTIONS" :key="opt" :value="opt" :label="t('msgTemplateCommon.sendType.' + opt)" />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-title">
          <el-input v-model="searchParams.title" :placeholder="t('msgTemplateList.placeholders.title')" clearable class="search-title-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('msgTemplateList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('msgTemplateList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog"><el-icon><Plus /></el-icon>{{ t('msgTemplateList.actions.add') }}</el-button>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('msgTemplateList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('msgTemplateList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('msgTemplateList.columns.title')" prop="title" min-width="180" sortable="custom" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('sendTypeDictCode')" :label="t('msgTemplateList.columns.sendType')" prop="sendTypeDictCode" :min-width="columnWidths['sendTypeDictCode'] ?? 110" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.sendTypeDictCode ? t('msgTemplateCommon.sendType.' + scope.row.sendTypeDictCode) : '—' }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('eventTypeDictCode')" :label="t('msgTemplateList.columns.eventType')" prop="eventTypeDictCode" :min-width="columnWidths['eventTypeDictCode'] ?? 140" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('msgTypeDictCode')" :label="t('msgTemplateList.columns.msgType')" prop="msgTypeDictCode" :min-width="columnWidths['msgTypeDictCode'] ?? 110" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('localeDictCode')" :label="t('msgTemplateList.columns.locale')" prop="localeDictCode" :min-width="columnWidths['localeDictCode'] ?? 110" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('receiverGroupCode')" :label="t('msgTemplateList.columns.receiverGroup')" prop="receiverGroupCode" :min-width="columnWidths['receiverGroupCode'] ?? 140" show-overflow-tooltip />
          <el-table-column v-if="showOperationColumn" :label="t('msgTemplateList.columns.operation')" align="center" fixed="right" min-width="110" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('msgTemplateList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('msgTemplateList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)"><Edit /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgTemplateList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('msgTemplateList.actions.detail')" placement="top" :enterable="false">
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
      <msg-template-form-page
        :model-value="formVisible"
        :rid="formRid"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <msg-template-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import MsgTemplateFormPage from './MsgTemplateFormPage.vue';
import MsgTemplateDetailPage from './MsgTemplateDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const SEND_TYPE_OPTIONS = ['auto', 'manual'];

class MsgTemplateListPage extends BaseListPage {
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
    return 'msg/template';
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['title'];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'msgTemplateList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'msgTemplateList.visibleColumns';
const COLUMN_LABEL_KEY: Record<string, string> = {
  sendTypeDictCode: 'sendType',
  eventTypeDictCode: 'eventType',
  msgTypeDictCode: 'msgType',
  localeDictCode: 'locale',
  receiverGroupCode: 'receiverGroup',
};
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['sendTypeDictCode', 'eventTypeDictCode', 'msgTypeDictCode', 'localeDictCode', 'receiverGroupCode']);
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 180;

export default defineComponent({
  name: 'MsgTemplateListPage',
  components: { MsgTemplateFormPage, MsgTemplateDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MsgTemplateListPage(props, context)) as MsgTemplateListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const { formVisible, formRid, hasFormEverOpened, currentFormMode, onFormClose, onFormResponse } = useListPageFormSetup({ state, listPage, addHandlerName: 'doAfterAdd', editHandlerName: 'doAfterEdit' });
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('msgTemplateList.columns.index') : t('msgTemplateList.columns.' + (COLUMN_LABEL_KEY[key] ?? key))),
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
        { key: 'sendTypeDictCode', getLabel: () => t('msgTemplateList.columns.sendType'), sortable: true, getCellText: (row: Record<string, unknown>) => (row.sendTypeDictCode ? t('msgTemplateCommon.sendType.' + row.sendTypeDictCode) : '') },
        { key: 'eventTypeDictCode', getLabel: () => t('msgTemplateList.columns.eventType'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.eventTypeDictCode ?? '') },
        { key: 'msgTypeDictCode', getLabel: () => t('msgTemplateList.columns.msgType'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.msgTypeDictCode ?? '') },
        { key: 'localeDictCode', getLabel: () => t('msgTemplateList.columns.locale'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.localeDictCode ?? '') },
        { key: 'receiverGroupCode', getLabel: () => t('msgTemplateList.columns.receiverGroup'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.receiverGroupCode ?? '') },
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
.msg-template-list-page .list-page-toolbar .toolbar-sendtype,
.msg-template-list-page .list-page-toolbar .toolbar-title { margin-right: 8px; }
.msg-template-list-page .list-page-toolbar .toolbar-sendtype .search-sendtype-input { width: 100%; min-width: 130px; }
.msg-template-list-page .list-page-toolbar .toolbar-title .search-title-input { width: 100%; min-width: 160px; box-sizing: border-box; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 180px !important; min-width: 180px !important; max-width: 180px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
