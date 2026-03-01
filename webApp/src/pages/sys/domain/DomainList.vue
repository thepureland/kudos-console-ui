<!--
 * 域名列表：支持按域名、子系统、租户、仅启用筛选，表格支持列可见性、操作列折角、未固定列可拖拽排序，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="domain-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('domainList.actions.showColumnPanel')"
      :column-panel-hide-text="t('domainList.actions.hideColumnPanel')"
      :operation-column-show-text="t('domainList.actions.showOperationColumn')"
      :operation-column-hide-text="t('domainList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.domain"
            :placeholder="t('domainList.placeholders.domain')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-subsys">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants"
            :props="cascaderProps"
            :placeholder="t('domainList.placeholders.subSysTenant')"
            clearable
            class="search-select-input"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('domainList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('domainList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('domainList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('domainList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('domainList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('domainList.actions.columnVisibility') }}</div>
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
          <el-table-column type="selection" min-width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('domainList.columns.domain')"
            prop="domain"
            sortable="custom"
            min-width="180"
            fixed="left"
            class-name="col-fixed-domain"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSysDictCode' && isColumnVisible('subSysDictCode')"
              prop="subSysDictCode"
              min-width="120"
              sortable="custom"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="subSysDictCode"
                  :class="{ 'is-dragging': columnDragKey === 'subSysDictCode', 'is-drop-target': columnDropTargetKey === 'subSysDictCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'subSysDictCode')"
                  @dragover="onHeaderDragOver($event, 'subSysDictCode')"
                  @drop="onHeaderDrop($event, 'subSysDictCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('domainList.columns.subSys') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSysDictCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'tenantName' && isColumnVisible('tenantName')"
              prop="tenantName"
              min-width="120"
              sortable="custom"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="tenantName"
                  :class="{ 'is-dragging': columnDragKey === 'tenantName', 'is-drop-target': columnDropTargetKey === 'tenantName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'tenantName')"
                  @dragover="onHeaderDragOver($event, 'tenantName')"
                  @drop="onHeaderDrop($event, 'tenantName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('domainList.columns.tenant') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              prop="active"
              min-width="80"
              sortable="custom"
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
                >{{ t('domainList.columns.active') }}</div>
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
              v-else-if="key === 'remark' && isColumnVisible('remark')"
              prop="remark"
              min-width="120"
              sortable="custom"
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
                >{{ t('domainList.columns.remark') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'createTime' && isColumnVisible('createTime')"
              prop="createTime"
              min-width="160"
              sortable="custom"
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
                >{{ t('domainList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('domainList.columns.operation')"
            align="center"
            fixed="right"
            min-width="140"
            class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('domainList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('domainList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('domainList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('domainList.actions.detail')" placement="top" :enterable="false">
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

    <domain-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <domain-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <domain-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DomainAddEdit from './DomainAddEdit.vue';
import DomainDetail from './DomainDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'domainList.operationColumnPinned';
const DOMAIN_LIST_STATE_STORAGE_KEY = 'domainList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'domainList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'domainList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['subSysDictCode', 'tenantName', 'active', 'remark', 'createTime'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

class ListPage extends TenantSupportListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        domain: null as string | null,
        active: true,
        subSysOrTenant: null as string[] | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/domain';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.domain = sp.domain ?? null;
    params.active = sp.active === true ? true : null;
    return params;
  }

  protected doAfterAdd(params: Record<string, unknown>): void {
    const sp = this.state.searchParams as Record<string, unknown>;
    if (params.domain != null) sp.domain = params.domain;
    super.doAfterAdd(params);
  }
}

export default defineComponent({
  name: 'DomainList',
  components: { DomainAddEdit, DomainDetail, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(DOMAIN_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    const listLayoutRefs = { tableWrapRef, paginationRef };
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);

    const FIXED_LEFT_TOTAL_WIDTH = 289;
    function forceFixedLeftWidth() {
      nextTick(() => {
        tableRef.value?.doLayout?.();
        nextTick(() => {
          const wrapper = tableRef.value?.$el?.querySelector?.('.el-table__fixed-left') as HTMLElement | null;
          if (wrapper) {
            wrapper.style.setProperty('width', `${FIXED_LEFT_TOTAL_WIDTH}px`, 'important');
            wrapper.style.setProperty('max-width', `${FIXED_LEFT_TOTAL_WIDTH}px`, 'important');
          }
        });
      });
    }

    function loadColumnOrder(): string[] {
      if (typeof window === 'undefined') return [...ALL_COLUMN_KEYS];
      try {
        const raw = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
        if (!raw) return [...ALL_COLUMN_KEYS];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [...ALL_COLUMN_KEYS];
        const set = new Set(ALL_COLUMN_KEYS);
        const ordered = (parsed as string[]).filter((k) => set.has(k));
        const missing = ALL_COLUMN_KEYS.filter((k) => !ordered.includes(k));
        return ordered.length ? [...ordered, ...missing] : [...ALL_COLUMN_KEYS];
      } catch {
        return [...ALL_COLUMN_KEYS];
      }
    }
    function saveColumnOrder(order: string[]) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
    }
    const columnOrder = ref<string[]>(loadColumnOrder());
    const orderedColumnKeys = computed(() => {
      const order = columnOrder.value;
      if (!order.length) return [...ALL_COLUMN_KEYS];
      const set = new Set(ALL_COLUMN_KEYS);
      const ordered = order.filter((k) => set.has(k));
      const missing = ALL_COLUMN_KEYS.filter((k) => !ordered.includes(k));
      return ordered.length ? [...ordered, ...missing] : [...ALL_COLUMN_KEYS];
    });

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('domainList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({ key, label: t('domainList.columns.' + (key === 'subSysDictCode' ? 'subSys' : key === 'tenantName' ? 'tenant' : key)) })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    const columnDragKey = ref<string | null>(null);
    const columnDropTargetKey = ref<string | null>(null);
    function onHeaderDragStart(e: DragEvent, key: string) {
      columnDragKey.value = key;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }
    function onHeaderDragOver(e: DragEvent, toKey: string) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      columnDropTargetKey.value = toKey;
    }
    function applyColumnDrop(toKey: string) {
      const fromKey = columnDragKey.value;
      columnDragKey.value = null;
      columnDropTargetKey.value = null;
      if (!fromKey || fromKey === toKey) return;
      const order = [...orderedColumnKeys.value];
      const fromIndex = order.indexOf(fromKey);
      const toIndex = order.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const [removed] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, removed);
      columnOrder.value = order;
      saveColumnOrder(order);
      nextTick(forceFixedLeftWidth);
    }
    function onHeaderDrop(e: DragEvent, toKey: string) {
      e.preventDefault();
      e.stopPropagation();
      applyColumnDrop(toKey);
    }
    function onTableDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
      if (keyEl) columnDropTargetKey.value = keyEl.getAttribute('data-column-key');
    }
    function onTableDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
      const toKey = keyEl?.getAttribute('data-column-key') ?? columnDropTargetKey.value;
      if (toKey) applyColumnDrop(toKey);
    }
    function onHeaderDragEnd() {
      columnDragKey.value = null;
      columnDropTargetKey.value = null;
    }

    function onTableWrapMounted() {
      nextTick(updateTableMaxHeight);
    }

    onMounted(() => {
      listPage.restorePersistedListState();
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
      },
      { deep: true },
    );
    watch(
      () => listPage.state.visibleColumnKeys,
      () => nextTick(forceFixedLeftWidth),
      { deep: true },
    );
    watch(
      () => listPage.state.showOperationColumn,
      () => nextTick(forceFixedLeftWidth),
    );

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
.domain-list-page .list-page-toolbar .toolbar-name .search-name-input,
.domain-list-page .list-page-toolbar .toolbar-subsys .search-select-input {
  width: 100%;
  min-width: 0;
}
.domain-list-page .list-page-toolbar .toolbar-subsys :deep(.el-input__wrapper) {
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
:deep(.el-table th.col-fixed-domain),
:deep(.el-table td.col-fixed-domain) {
  width: 200px !important;
  min-width: 200px !important;
  max-width: 200px !important;
}
:deep(.el-table__fixed-left) {
  width: 289px !important;
  max-width: 289px !important;
}
:deep(.el-table th.operation-column),
:deep(.el-table td.operation-column) {
  width: 140px !important;
  min-width: 140px !important;
  max-width: 140px !important;
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
