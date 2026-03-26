<!--
 * 租户列表：支持按租户名称、子系统、仅启用筛选，表格支持列可见性、操作列折角、未固定列可拖拽排序，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="tenant-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('tenantList.actions.showColumnPanel')"
      :column-panel-hide-text="t('tenantList.actions.hideColumnPanel')"
      :operation-column-show-text="t('tenantList.actions.showOperationColumn')"
      :operation-column-hide-text="t('tenantList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.name"
            :placeholder="t('tenantList.placeholders.name')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-subsys">
          <el-select
            v-model="searchParams.subSystemCode"
            :placeholder="t('tenantList.placeholders.subSys')"
            clearable
            class="search-select-input"
            @change="search"
          >
            <el-option
              v-for="item in (listPage.state.subSysDictOptions || [])"
              :key="item.code"
              :value="item.code"
              :label="item.name"
            />
          </el-select>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('tenantList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('tenantList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('tenantList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('tenantList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('tenantList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('tenantList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox
            v-for="item in columnVisibilityOptions"
            :key="item.key"
            :value="item.key"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </template>
      <div
        class="table-drag-drop-zone"
        @dragover="onTableDragOver"
        @drop="onTableDrop"
      >
        <el-table
          ref="tableRef"
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('tenantList.columns.name')"
            prop="name"
            sortable="custom"
            min-width="160"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSystemCodes' && isColumnVisible('subSystemCodes')"
              prop="subSystemCodes"
              :min-width="columnWidths['subSystemCodes'] ?? 120"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="subSystemCodes"
                  :class="{ 'is-dragging': columnDragKey === 'subSystemCodes', 'is-drop-target': columnDropTargetKey === 'subSystemCodes' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'subSystemCodes')"
                  @dragover="onHeaderDragOver($event, 'subSystemCodes')"
                  @drop="onHeaderDrop($event, 'subSystemCodes')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.subSys') }}</div>
              </template>
              <template #default="scope">
                {{ formatSubSystemCodes(scope.row.subSystemCodes) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              prop="active"
              :min-width="columnWidths['active'] ?? 80"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="active"
                  :class="{ 'is-dragging': columnDragKey === 'active', 'is-drop-target': columnDropTargetKey === 'active' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'active')"
                  @dragover="onHeaderDragOver($event, 'active')"
                  @drop="onHeaderDrop($event, 'active')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.active') }}</div>
              </template>
              <template #default="scope">
                <el-switch
                  v-model="scope.row.active"
                  :active-value="true"
                  :inactive-value="false"
                  @change="updateActive(scope.row)"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'builtIn' && isColumnVisible('builtIn')"
              prop="builtIn"
              :min-width="columnWidths['builtIn'] ?? 80"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="builtIn"
                  :class="{ 'is-dragging': columnDragKey === 'builtIn', 'is-drop-target': columnDropTargetKey === 'builtIn' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'builtIn')"
                  @dragover="onHeaderDragOver($event, 'builtIn')"
                  @drop="onHeaderDrop($event, 'builtIn')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.builtIn') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.builtIn ? t('tenantList.common.yes') : t('tenantList.common.no') }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'timezone' && isColumnVisible('timezone')"
              prop="timezone"
              :min-width="columnWidths['timezone'] ?? 120"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="timezone"
                  :class="{ 'is-dragging': columnDragKey === 'timezone', 'is-drop-target': columnDropTargetKey === 'timezone' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'timezone')"
                  @dragover="onHeaderDragOver($event, 'timezone')"
                  @drop="onHeaderDrop($event, 'timezone')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.timezone') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.timezone ?? '—' }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'defaultLanguageCode' && isColumnVisible('defaultLanguageCode')"
              prop="defaultLanguageCode"
              :min-width="columnWidths['defaultLanguageCode'] ?? 120"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="defaultLanguageCode"
                  :class="{ 'is-dragging': columnDragKey === 'defaultLanguageCode', 'is-drop-target': columnDropTargetKey === 'defaultLanguageCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'defaultLanguageCode')"
                  @dragover="onHeaderDragOver($event, 'defaultLanguageCode')"
                  @drop="onHeaderDrop($event, 'defaultLanguageCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.defaultLanguageCode') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.defaultLanguageCode ?? '—' }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'remark' && isColumnVisible('remark')"
              prop="remark"
              :min-width="columnWidths['remark'] ?? 140"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="remark"
                  :class="{ 'is-dragging': columnDragKey === 'remark', 'is-drop-target': columnDropTargetKey === 'remark' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'remark')"
                  @dragover="onHeaderDragOver($event, 'remark')"
                  @drop="onHeaderDrop($event, 'remark')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.remark') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.remark ?? '—' }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'createTime' && isColumnVisible('createTime')"
              prop="createTime"
              :min-width="columnWidths['createTime'] ?? 160"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="createTime"
                  :class="{ 'is-dragging': columnDragKey === 'createTime', 'is-drop-target': columnDropTargetKey === 'createTime' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'createTime')"
                  @dragover="onHeaderDragOver($event, 'createTime')"
                  @drop="onHeaderDrop($event, 'createTime')"
                  @dragend="onHeaderDragEnd"
                >{{ t('tenantList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('tenantList.columns.operation')"
            align="center"
            fixed="right"
            min-width="160"
            class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('tenantList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('tenantList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('tenantList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('tenantList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #pagination>
        <el-pagination
          :ref="(el: unknown) => { listLayoutRefs.paginationRef.value = el as HTMLElement | null; }"
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

    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <tenant-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <tenant-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import TenantFormPage from './TenantFormPage.vue';
import TenantDetailPage from './TenantDetailPage.vue';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { Pair } from '../../../components/model/Pair';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, createI18nColumnLabelGetter, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useColumnOrderDrag } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'tenantList.operationColumnPinned';
const TENANT_LIST_STATE_STORAGE_KEY = 'tenantList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'tenantList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'tenantList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['subSystemCodes', 'active', 'builtIn', 'timezone', 'defaultLanguageCode', 'remark', 'createTime']);

class TenantListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadSubSystems();
    this.convertThis();
  }

  /** 租户模块子系统下拉：调用 sys/system/getAllActiveSubSystemCodes，结果为启用子系统编码列表 */
  private async loadSubSystems(): Promise<void> {
    try {
      const result = await backendRequest({ url: 'sys/system/getAllActiveSubSystemCodes' });
      const payload = getApiResponseData<unknown[]>(result);
      const codes = Array.isArray(payload) ? payload.map((x) => String(x ?? '')) : [];
      this.state.subSysDictOptions = codes
        .filter((c) => c !== '')
        .map((code) => ({ code, name: code }));
    } catch {
      this.state.subSysDictOptions = [];
    }
  }

  protected initState(): Record<string, unknown> {
        return {
      searchParams: {
        name: null as string | null,
        subSystemCode: null as string | null,
        active: true,
      },
      /** 子系统下拉选项（响应式，loadDicts 完成后更新以便下拉能刷新） */
      subSysDictOptions: [] as Array<{ code: string; name: string }>,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.name = sp.name ?? null;
    params.subSystemCode = sp.subSystemCode ?? null;
    params.active = sp.active === true ? true : null;
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name', 'subSystemCode'];
  }
}

export default defineComponent({
  name: 'TenantListPage',
  components: { TenantFormPage, TenantDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const columnLabel = createI18nColumnLabelGetter(t, 'tenantList.columns', { subSystemCodes: 'subSys' });
    const listPage = reactive(new TenantListPage(props, context)) as TenantListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const state = listPage.state as Record<string, unknown>;
    const {
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
    } = useListPageFormSetup({ state, listPage });
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
    });
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 200;
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const {
      orderedColumnKeys,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
    } = useColumnOrderDrag(COLUMN_ORDER_STORAGE_KEY, ALL_COLUMN_KEYS, {
      onOrderChange: () => nextTick(forceFixedLeftWidth),
    });
    function formatSubSystemCodes(val: unknown): string {
      if (Array.isArray(val)) return val.map((c) => listPage.transAtomicService(c)).filter(Boolean).join(', ');
      return listPage.transAtomicService(val as string | null | undefined);
    }
    const {
      RESERVED_WIDTH_LEFT,
      RESERVED_WIDTH_RIGHT,
      autoWidthColumns,
      tableDataRef,
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 289,
      reservedWidthRight: 140,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnLabel(key),
        sortable: true,
        getCellText:
          key === 'subSystemCodes'
            ? (row: Record<string, unknown>) => formatSubSystemCodes(row.subSystemCodes)
            : key === 'builtIn'
              ? (row: Record<string, unknown>) => (row.builtIn ? t('tenantList.common.yes') : t('tenantList.common.no'))
              : key === 'timezone'
                ? (row: Record<string, unknown>) => String(row.timezone ?? '—')
                : key === 'defaultLanguageCode'
                  ? (row: Record<string, unknown>) => String(row.defaultLanguageCode ?? '—')
                  : key === 'remark'
                    ? (row: Record<string, unknown>) => String(row.remark ?? '—')
                    : key === 'createTime'
                    ? (row: Record<string, unknown>) => listPage.formatDate(row.createTime)
                    : () => '',
      }))
    });

    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('tenantList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: columnLabel,
    });

    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      formatSubSystemCodes,
      listLayoutRefs,
      tableRef,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
      onTableWrapMounted,
      orderedColumnKeys,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.tenant-list-page .list-page-toolbar .toolbar-name .search-name-input,
.tenant-list-page .list-page-toolbar .toolbar-subsys .search-select-input {
  width: 100%;
  min-width: 0;
}
.tenant-list-page .list-page-toolbar .toolbar-subsys :deep(.el-input__wrapper) {
  min-width: 0;
}
.table-drag-drop-zone {
  flex: 1;
  min-height: 0;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
:deep(.el-table__fixed-left) {
  width: 289px !important;
  max-width: 289px !important;
}
:deep(.el-table th.col-fixed-selection),
:deep(.el-table td.col-fixed-selection) {
  width: 39px !important;
  min-width: 39px !important;
  max-width: 39px !important;
}
:deep(.el-table th.col-fixed-index),
:deep(.el-table td.col-fixed-index) {
  width: 50px !important;
  min-width: 50px !important;
  max-width: 50px !important;
}
:deep(.el-table th.col-fixed-name),
:deep(.el-table td.col-fixed-name) {
  width: 200px !important;
  min-width: 200px !important;
  max-width: 200px !important;
}
:deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
:deep(.column-header-draggable:active) {
  cursor: grabbing;
}
:deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
:deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
:deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
:deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
:deep(th .cell:has(.column-header-draggable) .el-table__column-filter-trigger),
:deep(th .cell:has(.column-header-draggable) .el-table__sort-icon),
:deep(th .cell:has(.column-header-draggable) .caret-wrapper) {
  display: none !important;
}
</style>
