<!--
 * User group list: filter by group code, group name, and active-only; the table supports column visibility, an operation-column fold toggle, drag-reorder of columns, and i18n.
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="user-group-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('userGroupList.actions.showColumnPanel')"
      :column-panel-hide-text="t('userGroupList.actions.hideColumnPanel')"
      :operation-column-show-text="t('userGroupList.actions.showOperationColumn')"
      :operation-column-hide-text="t('userGroupList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants"
            :props="cascaderProps"
            :placeholder="t('userGroupList.placeholders.subSysOrTenant')"
            clearable
            class="search-cascader"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.groupCode"
            :placeholder="t('userGroupList.placeholders.groupCode')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.groupName"
            :placeholder="t('userGroupList.placeholders.groupName')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('userGroupList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('userGroupList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('userGroupList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('userGroupList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('userGroupList.actions.delete') }}
        </el-button>
        <el-button type="primary" :disabled="!hasSelection" @click="openBatchBindUsers">
          {{ t('userGroupList.actions.batchBindUsers') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('userGroupList.actions.columnVisibility') }}</div>
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
            :label="t('userGroupList.columns.groupCode')"
            prop="groupCode"
            min-width="120"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'groupName' && isColumnVisible('groupName')"
              prop="groupName"
              :min-width="columnWidths['groupName'] ?? 120"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="groupName"
                  :class="{ 'is-dragging': columnDragKey === 'groupName', 'is-drop-target': columnDropTargetKey === 'groupName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'groupName')"
                  @dragover="onHeaderDragOver($event, 'groupName')"
                  @drop="onHeaderDrop($event, 'groupName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('userGroupList.columns.groupName') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'subSystemCode' && isColumnVisible('subSystemCode')"
              prop="subSystemCode"
              :min-width="columnWidths['subSystemCode'] ?? 100"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="subSystemCode"
                  :class="{ 'is-dragging': columnDragKey === 'subSystemCode', 'is-drop-target': columnDropTargetKey === 'subSystemCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'subSystemCode')"
                  @dragover="onHeaderDragOver($event, 'subSystemCode')"
                  @drop="onHeaderDrop($event, 'subSystemCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('userGroupList.columns.subSystemCode') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSystemCode) }}
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
                >{{ t('userGroupList.columns.remark') }}</div>
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
                >{{ t('userGroupList.columns.active') }}</div>
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
                >{{ t('userGroupList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('userGroupList.columns.operation')"
            align="center"
            fixed="right"
            min-width="260"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('userGroupList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area operation-column-cell">
                <el-tooltip
                  :content="scope.row.builtIn ? t('userGroupList.actions.builtInLocked') : t('userGroupList.actions.edit')"
                  placement="top"
                  :enterable="false"
                >
                  <el-icon
                    :size="20"
                    :class="['operate-column-icon', { 'operate-column-icon--disabled': scope.row.builtIn }]"
                    @click="scope.row.builtIn ? undefined : handleEdit(scope.row)"
                  >
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip
                  :content="scope.row.builtIn ? t('userGroupList.actions.builtInLocked') : t('userGroupList.actions.delete')"
                  placement="top"
                  :enterable="false"
                >
                  <el-icon
                    :size="20"
                    :class="['operate-column-icon', { 'operate-column-icon--disabled': scope.row.builtIn }]"
                    @click="scope.row.builtIn ? undefined : handleDelete(scope.row)"
                  >
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('userGroupList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
                <el-dropdown split-button size="small" type="primary" @command="(cmd) => onUserCommand(cmd)" style="margin-right: 8px;">
                  {{ t('userGroupList.actions.user') }}
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="commandValue(1, scope.row)">{{ t('userGroupList.actions.assignUser') }}</el-dropdown-item>
                      <el-dropdown-item :command="commandValue(2, scope.row)">{{ t('userGroupList.actions.viewUser') }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-dropdown split-button size="small" type="primary" @command="(cmd) => onRoleCommand(cmd)">
                  {{ t('userGroupList.actions.role') }}
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="commandValue(1, scope.row)">{{ t('userGroupList.actions.assignRole') }}</el-dropdown-item>
                      <el-dropdown-item :command="commandValue(2, scope.row)">{{ t('userGroupList.actions.viewRole') }}</el-dropdown-item>
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

    <!-- Add/edit share a single form; mounted on first open of either; v-if/v-show is applied to a plain div to avoid the ElDialog non-element root-node directive warning. -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <user-group-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <UserGroupDetailPage v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    <group-user-assignment-dialog
      v-if="userAssignmentDialogVisible"
      v-model="userAssignmentDialogVisible"
      :rid="rid"
      :sub-system-code="subSystemCode"
      :tenant-id="tenantId"
    />
    <group-user-list-dialog
      v-if="userListDialogVisible"
      v-model="userListDialogVisible"
      :rid="rid"
    />
    <group-role-assignment-dialog
      v-if="roleAssignmentDialogVisible"
      v-model="roleAssignmentDialogVisible"
      :rid="rid"
      :sub-system-code="subSystemCode"
      :tenant-id="tenantId"
    />
    <group-role-list-dialog
      v-if="roleListDialogVisible"
      v-model="roleListDialogVisible"
      :rid="rid"
    />
    <batch-bind-users-dialog
      v-if="batchBindUsersVisible"
      v-model="batchBindUsersVisible"
      :owners="batchOwners"
      owner-kind="group"
      bind-url="auth/group/bindUsers"
      param-name="groupId"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import { normalizeIdSet } from '../_shared/assignmentTransferUtils';
import { useI18n } from 'vue-i18n';
import UserGroupFormPage from './UserGroupFormPage.vue';
import UserGroupDetailPage from './UserGroupDetailPage.vue';
import GroupUserAssignmentDialog from './GroupUserAssignmentDialog.vue';
import GroupUserListDialog from './GroupUserListDialog.vue';
import GroupRoleAssignmentDialog from './GroupRoleAssignmentDialog.vue';
import GroupRoleListDialog from './GroupRoleListDialog.vue';
import BatchBindUsersDialog from '../_shared/BatchBindUsersDialog.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { TenantSupportListPage } from '../../../components/pages/support';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useOperationColumnVisible, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, createI18nColumnLabelGetter, useColumnOrderDrag } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'userGroupList.operationColumnPinned';
const USER_GROUP_LIST_STATE_STORAGE_KEY = 'userGroupList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'userGroupList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'userGroupList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['groupName', 'subSystemCode', 'remark', 'active', 'createTime']);

class UserGroupListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  /** Tenant cascader allows only the second level (must pick a specific tenant); matches RoleListPage. */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
        return {
      searchParams: {
        subSysOrTenant: null as string[] | null,
        groupCode: null as string | null,
        groupName: null as string | null,
        active: true,
      },
      userAssignmentDialogVisible: false,
      userListDialogVisible: false,
      roleAssignmentDialogVisible: false,
      roleListDialogVisible: false,
      subSystemCode: null as string | null,
      tenantId: null as string | null,
      batchBindUsersVisible: false,
      batchOwners: [] as Array<{ id: string; label: string }>,
    };
  }

  openBatchBindUsers(): void {
    const rows = (this.state.selectedItems ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return;
    this.state.batchOwners = rows.map(r => ({
      id: String(this.getRowId(r)),
      label: String(r.groupName ?? r.groupCode ?? r.name ?? r.code ?? r.id ?? ''),
    }));
    this.state.batchBindUsersVisible = true;
  }

  commandValue(item: number, row: Record<string, unknown>): { item: number; row: Record<string, unknown> } {
    return { item, row };
  }

  /** Filter out built-in rows on batch delete and warn the user. */
  protected async doMultiDelete(): Promise<void> {
    const all = (this.state.selectedItems ?? []) as Array<Record<string, unknown>>;
    if (all.length === 0) { return super.doMultiDelete(); }
    const targets = all.filter(r => r.builtIn !== true);
    const skipped = all.length - targets.length;
    if (skipped > 0) ElMessage.warning(this.tr('userGroupList.actions.builtInSkipped', { n: skipped }));
    if (targets.length === 0) return;
    this.state.selectedItems = targets;
    const summary = await this.fetchBatchImpactSummary(targets);
    this._cachedBatchDeleteMessage = this.tr('userGroupList.actions.batchDeleteConfirmWithImpact', {
      n: targets.length, users: summary.users, roles: summary.roles,
    });
    try {
      await super.doMultiDelete();
    } finally {
      this._cachedBatchDeleteMessage = null;
    }
  }

  protected async doHandleDelete(row: Record<string, unknown>): Promise<void> {
    const summary = await this.fetchImpactSummary(this.getRowId(row));
    this._cachedDeleteMessage = this.tr('userGroupList.actions.deleteConfirmWithImpact', {
      users: summary.users, roles: summary.roles,
    });
    try {
      await super.doHandleDelete(row);
    } finally {
      this._cachedDeleteMessage = null;
    }
  }

  protected getDeleteMessage(row: Record<string, unknown>): string {
    return this._cachedDeleteMessage ?? super.getDeleteMessage(row);
  }

  protected getBatchDeleteMessage(rows: Array<Record<string, unknown>>): string {
    return this._cachedBatchDeleteMessage ?? super.getBatchDeleteMessage(rows);
  }

  /** Counts of users in this group + roles granted to this group. */
  private async fetchImpactSummary(groupId: string | number): Promise<{ users: number | string; roles: number | string }> {
    const [usersR, rolesR] = await Promise.all([
      backendRequest({ url: 'auth/group/listUserIds', method: 'get', params: { groupId } }),
      backendRequest({ url: 'auth/group/listRoleIds', method: 'get', params: { groupId } }),
    ]);
    return {
      users: isApiSuccessResponse(usersR) ? normalizeIdSet(getApiResponseData<unknown>(usersR)).length : '?',
      roles: isApiSuccessResponse(rolesR) ? normalizeIdSet(getApiResponseData<unknown>(rolesR)).length : '?',
    };
  }

  private async fetchBatchImpactSummary(rows: Array<Record<string, unknown>>): Promise<{ users: number | string; roles: number | string }> {
    const ids = rows.map(r => this.getRowId(r));
    const allUsers = new Set<string>();
    const allRoles = new Set<string>();
    let failed = false;
    await Promise.all(ids.map(async (groupId) => {
      const [usersR, rolesR] = await Promise.all([
        backendRequest({ url: 'auth/group/listUserIds', method: 'get', params: { groupId } }),
        backendRequest({ url: 'auth/group/listRoleIds', method: 'get', params: { groupId } }),
      ]);
      if (isApiSuccessResponse(usersR)) normalizeIdSet(getApiResponseData<unknown>(usersR)).forEach(id => allUsers.add(id));
      else failed = true;
      if (isApiSuccessResponse(rolesR)) normalizeIdSet(getApiResponseData<unknown>(rolesR)).forEach(id => allRoles.add(id));
      else failed = true;
    }));
    return {
      users: failed ? `${allUsers.size}+?` : allUsers.size,
      roles: failed ? `${allRoles.size}+?` : allRoles.size,
    };
  }

  private _cachedDeleteMessage: string | null = null;
  private _cachedBatchDeleteMessage: string | null = null;

  onUserCommand(commandValue: { item: number; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    this.state.subSystemCode = row.subSystemCode ?? null;
    this.state.tenantId = row.tenantId ?? null;
    if (item === 1) {
      this.state.userAssignmentDialogVisible = true;
    } else {
      this.state.userListDialogVisible = true;
    }
  }

  onRoleCommand(commandValue: { item: number; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    this.state.subSystemCode = row.subSystemCode ?? null;
    this.state.tenantId = row.tenantId ?? null;
    if (item === 1) {
      this.state.roleAssignmentDialogVisible = true;
    } else {
      this.state.roleListDialogVisible = true;
    }
  }

  protected getRootActionPath(): string {
    return 'auth/group';
  }

  /** Only send active=true when the "active only" checkbox is ticked; otherwise send null. */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['groupCode', 'groupName'];
  }
}

export default defineComponent({
  name: 'UserGroupListPage',
  components: { UserGroupFormPage, UserGroupDetailPage, GroupUserAssignmentDialog, GroupUserListDialog, GroupRoleAssignmentDialog, GroupRoleListDialog, BatchBindUsersDialog, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const columnLabel = createI18nColumnLabelGetter(t, 'userGroupList.columns');
    const listPage = reactive(new UserGroupListPage(props, context)) as UserGroupListPage & { state: Record<string, unknown> };
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
      reservedWidthLeft: 39 + 50 + 120,
      reservedWidthRight: 140,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnLabel(key),
        sortable: key === 'groupName' || key === 'subSystemCode' || key === 'createTime',
        getCellText:
          key === 'groupName'
            ? (row: Record<string, unknown>) => String(row.groupName ?? '')
            : key === 'subSystemCode'
              ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSystemCode as string)
              : key === 'remark'
                ? (row: Record<string, unknown>) => String(row.remark ?? '')
                : key === 'createTime'
                  ? (row: Record<string, unknown>) => listPage.formatDate(row.createTime)
                  : () => '',
      }))
    });

    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('userGroupList.columns.index'),
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
      commandValue: (item: number, row: Record<string, unknown>) => listPage.commandValue(item, row),
      onUserCommand: (cmd: { item: number; row: Record<string, unknown> }) => listPage.onUserCommand(cmd),
      onRoleCommand: (cmd: { item: number; row: Record<string, unknown> }) => listPage.onRoleCommand(cmd),
      openBatchBindUsers: () => listPage.openBatchBindUsers(),
      hasSelection: computed(() => ((listPage.state.selectedItems ?? []) as Array<unknown>).length > 0),
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.user-group-list-page {
  height: 100%;
}
.user-group-list-page :deep(.list-page-card) {
  margin-top: 3px; /* card top outer margin */
}
.user-group-list-page .list-page-toolbar .toolbar-cascader,
.user-group-list-page .list-page-toolbar .toolbar-name {
  margin-right: 8px;
}
.user-group-list-page .list-page-toolbar .toolbar-name .search-name-input {
  min-width: 140px;
}
.user-group-list-page .list-page-toolbar .search-cascader {
  min-width: 160px;
}
.user-group-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}
.user-group-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}

/* Keep the column-header sort icon on the same line as the text instead of on its own line */
.user-group-list-page :deep(.el-table thead th .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.user-group-list-page :deep(.el-table thead th .el-table__column-sort),
.user-group-list-page :deep(.el-table thead th .caret-wrapper) {
  flex-shrink: 0;
  margin-left: 4px;
}

/* Column visibility config: stack all column options in a single vertical column. */
.user-group-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.user-group-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

/* Non-fixed column headers are drag-reorderable. */
.user-group-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.user-group-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.user-group-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.user-group-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.user-group-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.user-group-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}

/* Keep the operation column's content on a single line without wrapping. */
.user-group-list-page :deep(.operation-column-cell) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}
.user-group-list-page :deep(.operation-column-cell .operate-column-icon) {
  flex-shrink: 0;
}
.user-group-list-page :deep(.operation-column-cell .el-dropdown) {
  flex-shrink: 0;
}
.user-group-list-page :deep(.operate-column-icon--disabled) {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
