<!--
 * 系统列表：支持按编码、名称、仅启用、仅子系统筛选，表格为树形结构（按 parentCode），支持列可见性、操作列折角、可拖拽排序列，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="system-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('systemList.actions.showColumnPanel')"
      :column-panel-hide-text="t('systemList.actions.hideColumnPanel')"
      :operation-column-show-text="t('systemList.actions.showOperationColumn')"
      :operation-column-hide-text="t('systemList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.code"
            :placeholder="t('systemList.placeholders.code')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.name"
            :placeholder="t('systemList.placeholders.name')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.subSystem" class="subsystem-only-checkbox" @change="search">
            {{ t('systemList.actions.subSystemOnly') }}
          </el-checkbox>
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('systemList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('systemList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('systemList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('systemList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('systemList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('systemList.actions.columnVisibility') }}</div>
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
          default-expand-all
          row-key="id"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('systemList.columns.code')"
            prop="code"
            min-width="140"
            fixed="left"
            class-name="col-fixed-code"
            show-overflow-tooltip
          />
          <el-table-column
            :label="t('systemList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSystem' && isColumnVisible('subSystem')"
              prop="subSystem"
              :min-width="columnWidths['subSystem'] ?? 100"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="subSystem"
                  :class="{ 'is-dragging': columnDragKey === 'subSystem', 'is-drop-target': columnDropTargetKey === 'subSystem' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'subSystem')"
                  @dragover="onHeaderDragOver($event, 'subSystem')"
                  @drop="onHeaderDrop($event, 'subSystem')"
                  @dragend="onHeaderDragEnd"
                >{{ t('systemList.columns.subSystem') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.subSystem ? t('systemList.common.yes') : t('systemList.common.no') }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              prop="active"
              :min-width="columnWidths['active'] ?? 80"
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
                >{{ t('systemList.columns.active') }}</div>
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
                >{{ t('systemList.columns.builtIn') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.builtIn ? t('systemList.common.yes') : t('systemList.common.no') }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'remark' && isColumnVisible('remark')"
              prop="remark"
              :min-width="columnWidths['remark'] ?? 140"
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
                >{{ t('systemList.columns.remark') }}</div>
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('systemList.columns.operation')"
            align="center"
            min-width="68"
            fixed="right"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('systemList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('systemList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('systemList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('systemList.actions.detail')" placement="top" :enterable="false">
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
        <!-- 树列表无分页 -->
      </template>
    </list-page-layout>
    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <system-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <system-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';
import { ElMessage } from 'element-plus';
import SystemFormPage from './SystemFormPage.vue';
import SystemDetailPage from './SystemDetailPage.vue';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useOperationColumnVisible, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, createI18nColumnLabelGetter, useColumnOrderDrag } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'systemList.operationColumnPinned';
const SYSTEM_LIST_STATE_STORAGE_KEY = 'systemList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'systemList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'systemList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['subSystem', 'active', 'builtIn', 'remark']);

class SystemListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
        return {
      searchParams: {
        code: null as string | null,
        name: null as string | null,
        active: true,
        subSystem: false,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/system';
  }

  protected createSearchParams(): Record<string, unknown> {
    const params = super.createSearchParams() as Record<string, unknown>;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.code = sp.code ?? null;
    params.name = sp.name ?? null;
    params.active = sp.active === true ? true : null;
    params.subSystem = sp.subSystem === true ? true : null;
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['code', 'name'];
  }

  /** 将扁平列表按 parentCode 挂成树（父节点为 code === item.parentCode 的节点） */
  protected flatListToTree(flat: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!flat.length) return [];
    const list = flat.map((row) => ({ ...row, children: [] as Record<string, unknown>[] }));
    const byCode = new Map<string, Record<string, unknown>>();
    list.forEach((row) => {
      const k = row.code != null ? String(row.code) : (row.id != null ? String(row.id) : '');
      if (k !== '') byCode.set(k, row);
    });
    const roots: Record<string, unknown>[] = [];
    list.forEach((row) => {
      const parentCode = row.parentCode != null ? String(row.parentCode).trim() : '';
      if (!parentCode) {
        roots.push(row);
        return;
      }
      const parent = byCode.get(parentCode) as Record<string, unknown> | undefined;
      const children = parent?.children as Record<string, unknown>[] | undefined;
      if (parent && Array.isArray(children)) children.push(row);
      else roots.push(row);
    });
    return roots;
  }

  /** 支持 { data: 树数组, totalCount } 或直接数组；若为扁平列表则按 parentCode 转成树 */
  protected postSearchSuccessfully(data: unknown): void {
    let raw: unknown[] = [];
    if (data != null && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      const obj = data as { data: unknown[]; totalCount?: number };
      raw = obj.data;
      if (typeof obj.totalCount === 'number') this.state.pagination.total = obj.totalCount;
    } else if (Array.isArray(data)) {
      raw = data;
    }
    const rows = raw as Record<string, unknown>[];
    const hasChildren = rows.some((r) => Array.isArray((r as Record<string, unknown>).children));
    this.state.tableData = hasChildren ? rows : this.flatListToTree(rows);
  }

  /** 树接口可能直接返回数组或仅 { data }，与基类仅认 { data, totalCount } 对齐：此处均视为成功并填表 */
  protected async doSearch() {
    const params = this.createSearchParams();
    if (!params) return;
    const result = await backendRequest({ url: this.getSearchUrl(), method: 'post', params });
    const payload = getApiResponseData(result);
    if (Array.isArray(payload) || (payload != null && Array.isArray((payload as { data?: unknown }).data))) {
      this.postSearchSuccessfully(payload);
      return;
    }
    ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('listPage.queryFailed'));
  }
}

export default defineComponent({
  name: 'SystemListPage',
  components: { ListPageLayout, SystemFormPage, SystemDetailPage, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const columnLabel = createI18nColumnLabelGetter(t, 'systemList.columns');
    const listPage = reactive(new SystemListPage(props, context)) as SystemListPage & { state: Record<string, unknown> };
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
    const tableRef = ref<{ doLayout?: () => void } | null>(null);
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
    } = useColumnOrderDrag(COLUMN_ORDER_STORAGE_KEY, ALL_COLUMN_KEYS);

    const {
      RESERVED_WIDTH_LEFT,
      RESERVED_WIDTH_RIGHT,
      autoWidthColumns,
      tableDataRef,
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 39 + 50 + 140 + 120,
      reservedWidthRight: 120,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnLabel(key),
        sortable: false,
        getCellText:
          key === 'subSystem'
            ? (row: Record<string, unknown>) => (row.subSystem ? t('systemList.common.yes') : t('systemList.common.no'))
            : key === 'builtIn'
              ? (row: Record<string, unknown>) => (row.builtIn ? t('systemList.common.yes') : t('systemList.common.no'))
              : key === 'remark'
                ? (row: Record<string, unknown>) => String(row.remark ?? '')
                : () => '',
      }))
    });

    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('systemList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: columnLabel,
    });
    const showOperationColumn = useOperationColumnVisible(listPage);

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
      listLayoutRefs,
      tableRef,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
      orderedColumnKeys,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
      showOperationColumn,
      onTableWrapMounted,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.system-list-page {
  height: 100%;
}
.system-list-page :deep(.list-page-card .el-card__body) {
  padding-top: 8px; /* 与全局一致 */
}
.system-list-page .list-page-toolbar .toolbar-name {
  margin-right: 8px;
}
.system-list-page .list-page-toolbar .toolbar-name .search-name-input {
  min-width: 140px;
}
.system-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}

.system-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.system-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

.system-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.system-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.system-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.system-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.system-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.system-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
</style>
