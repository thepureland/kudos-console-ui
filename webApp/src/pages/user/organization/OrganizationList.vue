<!--
 * 组织列表：支持按子系统与租户、仅启用筛选，表格支持列可见性、操作列折角，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="organization-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('organizationList.actions.showColumnPanel')"
      :column-panel-hide-text="t('organizationList.actions.hideColumnPanel')"
      :operation-column-show-text="t('organizationList.actions.showOperationColumn')"
      :operation-column-hide-text="t('organizationList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants || []"
            :props="cascaderProps"
            :placeholder="t('organizationList.placeholders.subSysTenant')"
            clearable
            class="search-cascader-input"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('organizationList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('organizationList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('organizationList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('organizationList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('organizationList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('organizationList.actions.columnVisibility') }}</div>
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
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" min-width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('organizationList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'abbrName' && isColumnVisible('abbrName')"
              prop="abbrName"
              min-width="100"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="abbrName"
                  :class="{ 'is-dragging': columnDragKey === 'abbrName', 'is-drop-target': columnDropTargetKey === 'abbrName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'abbrName')"
                  @dragover="onHeaderDragOver($event, 'abbrName')"
                  @drop="onHeaderDrop($event, 'abbrName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.abbrName') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'orgTypeDictCode' && isColumnVisible('orgTypeDictCode')"
              prop="orgTypeDictCode"
              min-width="100"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="orgTypeDictCode"
                  :class="{ 'is-dragging': columnDragKey === 'orgTypeDictCode', 'is-drop-target': columnDropTargetKey === 'orgTypeDictCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'orgTypeDictCode')"
                  @dragover="onHeaderDragOver($event, 'orgTypeDictCode')"
                  @drop="onHeaderDrop($event, 'orgTypeDictCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.orgType') }}</div>
              </template>
              <template #default="scope">
                {{ transDict('kuark:user', 'organization_type', scope.row.orgTypeDictCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'seqNo' && isColumnVisible('seqNo')"
              prop="seqNo"
              min-width="80"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="seqNo"
                  :class="{ 'is-dragging': columnDragKey === 'seqNo', 'is-drop-target': columnDropTargetKey === 'seqNo' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'seqNo')"
                  @dragover="onHeaderDragOver($event, 'seqNo')"
                  @drop="onHeaderDrop($event, 'seqNo')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.seqNo') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              min-width="80"
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
                >{{ t('organizationList.columns.active') }}</div>
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
              v-else-if="key === 'createTime' && isColumnVisible('createTime')"
              min-width="160"
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
                >{{ t('organizationList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('organizationList.columns.operation')"
            align="center"
            min-width="120"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('organizationList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('organizationList.actions.edit')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('organizationList.actions.delete')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('organizationList.actions.detail')" placement="top">
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
        <!-- 组织树无分页 -->
      </template>
    </list-page-layout>

    <organization-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <organization-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <organization-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import OrganizationAddEdit from './OrganizationAddEdit.vue';
import OrganizationDetail from './OrganizationDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'organizationList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'organizationList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'organizationList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['abbrName', 'orgTypeDictCode', 'seqNo', 'active', 'createTime'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

/** 列 key 到 i18n key 的映射（orgTypeDictCode -> orgType）；名称列固定左侧，不参与可见性配置 */
const COLUMN_KEY_TO_I18N: Record<string, string> = {
  abbrName: 'abbrName',
  orgTypeDictCode: 'orgType',
  seqNo: 'seqNo',
  active: 'active',
  createTime: 'createTime',
};

class ListPage extends TenantSupportListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadDicts([
      new Pair('kuark:user', 'organization_type'),
    ]);
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/organization';
  }

  protected getSearchUrl(): string {
    return this.getRootActionPath() + '/searchTree';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      (params as Record<string, unknown>).active = (this.state.searchParams as Record<string, unknown>).active;
    }
    return params;
  }

  protected getDeleteMessage(_row: unknown): string {
    return '将级联删除所有孩子结点（如果有的话），依然进行删除操作吗？';
  }

  protected getBatchDeleteMessage(rows: Array<unknown>): string {
    return '将级联删除所有孩子结点（如果有的话），' + super.getBatchDeleteMessage(rows);
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  /** 必须先选择子系统/租户再搜索，按所选租户请求组织树 */
  protected isRequireSubSysOrTenantForSearch(): boolean {
    return true;
  }
}

export default defineComponent({
  name: 'OrganizationList',
  components: { OrganizationAddEdit, OrganizationDetail, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    const listLayoutRefs = { tableWrapRef, paginationRef };
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

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
      { key: INDEX_COLUMN_KEY, label: t('organizationList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('organizationList.columns.' + (COLUMN_KEY_TO_I18N[key] ?? key)),
      })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    const showOperationColumn = computed(() => Boolean(listPage.state?.showOperationColumn));

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
.organization-list-page {
  height: 100%;
}
.organization-list-page :deep(.list-page-card) {
  margin-top: 3px; /* 卡片上外边距 */
}
.organization-list-page .list-page-toolbar .toolbar-cascader {
  margin-right: 8px;
}
.organization-list-page .list-page-toolbar .toolbar-cascader .search-cascader-input {
  min-width: 140px;
}
.organization-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}

/* 列可见性配置：所有列选项单列竖排（与 AccountList 一致） */
.organization-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.organization-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

/* 非固定列表头可拖拽排序 */
.organization-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.organization-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.organization-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.organization-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.organization-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.organization-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
</style>
