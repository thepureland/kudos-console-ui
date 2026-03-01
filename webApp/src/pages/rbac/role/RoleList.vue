<!--
 * 角色列表：支持按子系统/租户、角色编码、角色名称、仅启用筛选，表格支持列可见性、操作列折角、列拖拽排序，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="role-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('roleList.actions.showColumnPanel')"
      :column-panel-hide-text="t('roleList.actions.hideColumnPanel')"
      :operation-column-show-text="t('roleList.actions.showOperationColumn')"
      :operation-column-hide-text="t('roleList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants"
            :props="cascaderProps"
            :placeholder="t('roleList.placeholders.subSysOrTenant')"
            clearable
            class="search-cascader"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.roleCode"
            :placeholder="t('roleList.placeholders.roleCode')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.roleName"
            :placeholder="t('roleList.placeholders.roleName')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('roleList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('roleList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('roleList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('roleList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('roleList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('roleList.actions.columnVisibility') }}</div>
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
            :label="t('roleList.columns.roleCode')"
            prop="roleCode"
            min-width="120"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-roleCode"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'roleName' && isColumnVisible('roleName')"
              prop="roleName"
              min-width="120"
              sortable="custom"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="roleName"
                  :class="{ 'is-dragging': columnDragKey === 'roleName', 'is-drop-target': columnDropTargetKey === 'roleName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'roleName')"
                  @dragover="onHeaderDragOver($event, 'roleName')"
                  @drop="onHeaderDrop($event, 'roleName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('roleList.columns.roleName') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'subSysDictCode' && isColumnVisible('subSysDictCode')"
              prop="subSysDictCode"
              min-width="100"
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
                >{{ t('roleList.columns.subSysDictCode') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSysDictCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'remark' && isColumnVisible('remark')"
              prop="remark"
              min-width="140"
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
                >{{ t('roleList.columns.remark') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              prop="active"
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
                >{{ t('roleList.columns.active') }}</div>
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
                >{{ t('roleList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('roleList.columns.operation')"
            align="center"
            fixed="right"
            min-width="340"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('roleList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area operation-column-cell">
                <el-tooltip :content="t('roleList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
                <el-dropdown split-button size="small" type="primary" @command="(cmd) => authorize(cmd)" style="margin-right: 8px;">
                  {{ t('roleList.actions.authorize') }}
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="item in getDictItems('kuark:sys', 'resource_type')"
                        :key="String(item.first)"
                        :command="commandValue(item, scope.row)"
                      >
                        {{ item.second }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-dropdown split-button size="small" type="primary" @command="(cmd) => assign(cmd)">
                  {{ t('roleList.actions.user') }}
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="commandValue(1, scope.row)">{{ t('roleList.actions.assignUser') }}</el-dropdown-item>
                      <el-dropdown-item :command="commandValue(2, scope.row)">{{ t('roleList.actions.viewUser') }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
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

    <role-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <role-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <RoleDetail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    <menu-authorization v-if="menuAuthorizationDialogVisible" v-model="menuAuthorizationDialogVisible" :rid="rid" />
    <user-assignment-dialog
      v-if="userAssignmentDialogVisible"
      v-model="userAssignmentDialogVisible"
      :rid="rid"
      :sub-sys-dict-code="subSysDictCode"
      :tenant-id="tenantId"
    />
    <user-list-dialog v-if="userListDialogVisible" v-model="userListDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import RoleAddEdit from './RoleAddEdit.vue';
import RoleDetail from './RoleDetail.vue';
import MenuAuthorization from './MenuAuthorization.vue';
import UserListDialog from './UserListDialog.vue';
import UserAssignmentDialog from './UserAssignmentDialog.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'roleList.operationColumnPinned';
const ROLE_LIST_STATE_STORAGE_KEY = 'roleList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'roleList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'roleList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['roleName', 'subSysDictCode', 'remark', 'active', 'createTime'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

class ListPage extends TenantSupportListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadDicts([new Pair('kuark:sys', 'resource_type')]);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        subSysOrTenant: null as string[] | null,
        roleCode: null as string | null,
        roleName: null as string | null,
        active: true,
      },
      menuAuthorizationDialogVisible: false,
      userAssignmentDialogVisible: false,
      userListDialogVisible: false,
    };
  }

  protected getRootActionPath(): string {
    return 'rbac/role';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  commandValue(item: unknown, row: Record<string, unknown>): { item: unknown; row: Record<string, unknown> } {
    return { item, row };
  }

  authorize(commandValue: { item: unknown; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    const resType = (item as { first?: number })?.first;
    if (resType === 1) {
      this.state.menuAuthorizationDialogVisible = true;
    } else if (resType === 2) {
      // 其他资源类型可扩展
    }
  }

  assign(commandValue: { item: number; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    this.state.subSysDictCode = row.subSysDictCode;
    this.state.tenantId = row.tenantId;
    if (item === 1) {
      this.state.userAssignmentDialogVisible = true;
    } else {
      this.state.userListDialogVisible = true;
    }
  }
}

export default defineComponent({
  name: 'RoleList',
  components: {
    RoleAddEdit,
    RoleDetail,
    MenuAuthorization,
    UserAssignmentDialog,
    UserListDialog,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(ROLE_LIST_STATE_STORAGE_KEY);
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
      { key: INDEX_COLUMN_KEY, label: t('roleList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('roleList.columns.' + key),
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
      { deep: true }
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
      // 原型方法需显式暴露，否则 toRefs(listPage) 不包含
      commandValue: (item: unknown, row: Record<string, unknown>) => listPage.commandValue(item, row),
      authorize: (cmd: { item: unknown; row: Record<string, unknown> }) => listPage.authorize(cmd),
      assign: (cmd: { item: number; row: Record<string, unknown> }) => listPage.assign(cmd),
      getDictItems: (module: string | null | undefined, dictType: string) => listPage.getDictItems(module, dictType),
      transDict: (module: string, dictType: string, code: string | null | undefined) => listPage.transDict(module, dictType, code),
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.role-list-page {
  height: 100%;
}
.role-list-page :deep(.list-page-card) {
  margin-top: 3px; /* 卡片上外边距 */
}
.role-list-page .list-page-toolbar .toolbar-cascader,
.role-list-page .list-page-toolbar .toolbar-name {
  margin-right: 8px;
}
.role-list-page .list-page-toolbar .toolbar-name .search-name-input {
  min-width: 140px;
}
.role-list-page .list-page-toolbar .search-cascader {
  min-width: 160px;
}
.role-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}
.role-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}

.role-list-page :deep(.el-table thead th .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.role-list-page :deep(.el-table thead th .el-table__column-sort),
.role-list-page :deep(.el-table thead th .caret-wrapper) {
  flex-shrink: 0;
  margin-left: 4px;
}

.role-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.role-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

.role-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.role-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.role-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.role-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.role-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.role-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}

/* 操作列内容单行显示不换行 */
.role-list-page :deep(.operation-column-cell) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}
.role-list-page :deep(.operation-column-cell .operate-column-icon) {
  flex-shrink: 0;
}
.role-list-page :deep(.operation-column-cell .el-dropdown) {
  flex-shrink: 0;
}
</style>
