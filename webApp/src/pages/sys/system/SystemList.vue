<!--
 * 子系统列表：支持按编码、名称、仅启用、仅子系统筛选，表格为树形结构（按 parentCode），支持列可见性、操作列折角、可拖拽排序列，多语言。
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
          />
          <el-table-column
            :label="t('systemList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSystem' && isColumnVisible('subSystem')"
              prop="subSystem"
              :min-width="columnWidths['subSystem'] ?? 100"
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
            min-width="120"
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
    <system-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <system-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <system-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, provide } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';
import { ElMessage } from 'element-plus';
import SystemAddEdit from './SystemAddEdit.vue';
import SystemDetail from './SystemDetail.vue';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'systemList.operationColumnPinned';
const SYSTEM_LIST_STATE_STORAGE_KEY = 'systemList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'systemList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'systemList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['subSystem', 'active', 'builtIn', 'remark'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
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
    return 'sys/subsys';
  }

  protected getSearchUrl(): string {
    return this.getRootActionPath() + '/searchTree';
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

  /** 与缓存等列表一致：支持 { data: 树数组, totalCount } 或直接数组 */
  protected postSearchSuccessfully(data: unknown): void {
    if (data != null && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      const obj = data as { data: unknown[]; totalCount?: number };
      this.state.tableData = obj.data;
      if (typeof obj.totalCount === 'number') this.state.pagination.total = obj.totalCount;
      return;
    }
    this.state.tableData = Array.isArray(data) ? data : [];
  }

  /** 树接口可能直接返回数组或仅 { data }，与基类仅认 { data, totalCount } 对齐：此处均视为成功并填表 */
  protected async doSearch() {
    const params = this.createSearchParams();
    if (!params) return;
    const result = await backendRequest({ url: this.getSearchUrl(), method: 'post', params });
    if (Array.isArray(result) || (result != null && Array.isArray((result as { data?: unknown }).data))) {
      this.postSearchSuccessfully(result);
      return;
    }
    ElMessage.error(i18n.global.t('listPage.queryFailed') as string);
  }
}

export default defineComponent({
  name: 'SystemList',
  components: { ListPageLayout, SystemAddEdit, SystemDetail, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
    });
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

    const RESERVED_WIDTH_LEFT = 39 + 50 + 140 + 120;
    const RESERVED_WIDTH_RIGHT = 120;
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => t('systemList.columns.' + key),
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
    );
    const tableDataRef = computed(() => (listPage.state as Record<string, unknown>).tableData as Array<Record<string, unknown>>);
    const { columnWidths, run: runColumnAutoWidth } = useTableColumnAutoWidth({
      containerRef: listLayoutRefs.tableWrapRef,
      columns: autoWidthColumns,
      tableData: tableDataRef,
      reservedWidthLeft: RESERVED_WIDTH_LEFT,
      reservedWidthRight: RESERVED_WIDTH_RIGHT,
    });
    function onTableWrapMounted() {
      layoutOnTableWrapMounted();
      nextTick(runColumnAutoWidth);
    }

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('systemList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('systemList.columns.' + key),
      })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    const showOperationColumn = computed(() => Boolean(listPage.state?.showOperationColumn));

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
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
