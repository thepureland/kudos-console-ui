<!--
 * Role list: filter by subsystem/tenant, role code, role name, and active-only; the table supports column visibility, an operation-column fold toggle, drag-reorder of columns, and i18n.
 *
 * @author K
 * @author: AI: Cursor
 * @author AI: Claude
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
        <el-button type="primary" :disabled="!hasSelection" @click="openBatchBindUsers">
          {{ t('roleList.actions.batchBindUsers') }}
        </el-button>
        <el-button @click="purgeExpiredGrants">
          <el-icon><Clock /></el-icon>
          {{ t('roleList.actions.purgeExpired') }}
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
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('roleList.columns.roleCode')"
            prop="roleCode"
            min-width="120"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-roleCode"
            show-overflow-tooltip
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'roleName' && isColumnVisible('roleName')"
              prop="roleName"
              :min-width="columnWidths['roleName'] ?? 120"
              sortable="custom"
              show-overflow-tooltip
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
                >{{ t('roleList.columns.subSystemCode') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSystemCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'dataScope' && isColumnVisible('dataScope')"
              prop="dataScope"
              :min-width="columnWidths['dataScope'] ?? 130"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="dataScope"
                  :class="{ 'is-dragging': columnDragKey === 'dataScope', 'is-drop-target': columnDropTargetKey === 'dataScope' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'dataScope')"
                  @dragover="onHeaderDragOver($event, 'dataScope')"
                  @drop="onHeaderDrop($event, 'dataScope')"
                  @dragend="onHeaderDragEnd"
                >{{ t('roleList.columns.dataScope') }}</div>
              </template>
              <template #default="scope">
                <el-tag
                  v-if="scope.row.dataScope && scope.row.dataScope !== 'ALL'"
                  size="small"
                  type="warning"
                  disable-transitions
                >{{ t(`roleList.dataScopes.${scope.row.dataScope}`) }}</el-tag>
                <span v-else class="ds-all">{{ t('roleList.dataScopes.ALL') }}</span>
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
                >{{ t('roleList.columns.remark') }}</div>
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
            min-width="200"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('roleList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area operation-column-cell">
                <el-tooltip
                  :content="scope.row.builtIn ? t('roleList.actions.builtInLocked') : t('roleList.actions.edit')"
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
                  :content="scope.row.builtIn ? t('roleList.actions.builtInLocked') : t('roleList.actions.delete')"
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
                <el-tooltip :content="t('roleList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.copy')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="openCopyDialog(scope.row)">
                    <CopyDocument />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.dataScope')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="openDataScopeDialog(scope.row)">
                    <Filter />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.permissionCodes')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="openPermissionCodeDialog(scope.row)">
                    <Key />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.delegate')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="openDelegationDialog(scope.row)">
                    <Share />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleList.actions.temporalGrants')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="openTemporalGrantsDialog(scope.row)">
                    <Clock />
                  </el-icon>
                </el-tooltip>
                <el-dropdown split-button size="small" type="primary" @command="(cmd) => authorize(cmd)" style="margin-right: 8px;">
                  {{ t('roleList.actions.authorize') }}
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="item in getDictItems('sys', 'resource_type')"
                        :key="String(item.first)"
                        :command="commandValue(item, scope.row)"
                      >
                        {{ t(item.second) }}
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

    <!-- Add/edit share a single form; mounted on first open of either; v-if/v-show is applied to a plain div to avoid the ElDialog non-element root-node directive warning. -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <role-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <RoleDetailPage v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    <menu-authorization v-if="menuAuthorizationDialogVisible" v-model="menuAuthorizationDialogVisible" :rid="rid" />
    <user-assignment-dialog
      v-if="userAssignmentDialogVisible"
      v-model="userAssignmentDialogVisible"
      :rid="rid"
      :sub-system-code="subSystemCode"
      :tenant-id="tenantId"
    />
    <user-list-dialog v-if="userListDialogVisible" v-model="userListDialogVisible" :rid="rid" />
    <role-resource-assignment-dialog
      v-if="resourceAssignmentDialogVisible"
      v-model="resourceAssignmentDialogVisible"
      :rid="rid"
      :resource-type-dict-code="resourceTypeDictCode"
      :resource-type-label-key="resourceTypeLabelKey"
      :sub-system-code="subSystemCode"
      :tenant-id="tenantId"
    />
    <role-copy-dialog
      v-if="copyDialogVisible"
      v-model="copyDialogVisible"
      :rid="rid"
      @response="onCopyResponse"
    />
    <role-data-scope-dialog
      v-if="dataScopeDialogVisible"
      v-model="dataScopeDialogVisible"
      :rid="rid"
      @response="onDataScopeResponse"
    />
    <!-- Code-addressed bindings: effect + condition, which the resource tree cannot express. -->
    <role-permission-code-dialog
      v-if="permissionCodeDialogVisible"
      v-model="permissionCodeDialogVisible"
      :rid="rid"
      :role-name="delegationRoleName"
      @response="onPermissionCodeResponse"
    />
    <!-- Delegate the role on the current operator's own authority (screened + chained). -->
    <role-delegation-dialog
      v-if="delegationDialogVisible"
      v-model="delegationDialogVisible"
      :rid="rid"
      :role-name="delegationRoleName"
      @response="onDelegationResponse"
    />
    <!-- View all grants for a role -->
    <role-temporal-grants-dialog
      v-if="temporalGrantsDialogVisible"
      v-model="temporalGrantsDialogVisible"
      :rid="rid"
      @regrant="onRegrantFromView"
    />
    <!-- Grant form (opened from the view dialog or directly) -->
    <role-temporal-grant-dialog
      v-if="temporalGrantDialogVisible"
      v-model="temporalGrantDialogVisible"
      :rid="rid"
      @response="onTemporalGrantResponse"
    />
    <batch-bind-users-dialog
      v-if="batchBindUsersVisible"
      v-model="batchBindUsersVisible"
      :owners="batchOwners"
      owner-kind="role"
      bind-url="auth/role/bindUsers"
      param-name="roleId"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed } from 'vue';
import { Clock, CopyDocument, Delete, Edit, Filter, Key, Plus, RefreshLeft, Search, Share, Tickets } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { useI18n } from 'vue-i18n';
import RoleFormPage from './RoleFormPage.vue';
import RoleDetailPage from './RoleDetailPage.vue';
import MenuAuthorization from './MenuAuthorization.vue';
import UserListDialog from './UserListDialog.vue';
import UserAssignmentDialog from './UserAssignmentDialog.vue';
import RoleResourceAssignmentDialog from './RoleResourceAssignmentDialog.vue';
import RoleCopyDialog from './RoleCopyDialog.vue';
import RoleDataScopeDialog from './RoleDataScopeDialog.vue';
import RoleDelegationDialog from './RoleDelegationDialog.vue';
import RolePermissionCodeDialog from './RolePermissionCodeDialog.vue';
import RoleTemporalGrantDialog from './RoleTemporalGrantDialog.vue';
import RoleTemporalGrantsDialog from './RoleTemporalGrantsDialog.vue';
import BatchBindUsersDialog from '../_shared/BatchBindUsersDialog.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useOperationColumnVisible, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, createI18nColumnLabelGetter, useColumnOrderDrag } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'roleList.operationColumnPinned';
const ROLE_LIST_STATE_STORAGE_KEY = 'roleList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'roleList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'roleList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['roleName', 'subSystemCode', 'dataScope', 'remark', 'active', 'createTime']);

class RoleListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['resource_type'], 'sys');
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
      resourceAssignmentDialogVisible: false,
      resourceTypeDictCode: null as string | null,
      resourceTypeLabelKey: null as string | null,
      copyDialogVisible: false,
      dataScopeDialogVisible: false,
      delegationDialogVisible: false,
      permissionCodeDialogVisible: false,
      delegationRoleName: '',
      temporalGrantsDialogVisible: false,
      temporalGrantDialogVisible: false,
      batchBindUsersVisible: false,
      /** Snapshot of selected rows at the moment the batch dialog opens (avoids drift if selection changes). */
      batchOwners: [] as Array<{ id: string; label: string }>,
    };
  }

  openBatchBindUsers(): void {
    const rows = (this.state.selectedItems ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return;
    this.state.batchOwners = rows.map(r => ({
      id: String(this.getRowId(r)),
      label: String(r.roleName ?? r.roleCode ?? r.name ?? r.code ?? r.id ?? ''),
    }));
    this.state.batchBindUsersVisible = true;
  }

  openCopyDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.copyDialogVisible = true;
  }

  onCopyResponse(): void {
    // Refresh the list so the new role shows up immediately.
    this.search();
  }

  openDataScopeDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.dataScopeDialogVisible = true;
  }

  onDataScopeResponse(): void {
    // Refresh so the (potentially) changed scope is reflected in the row.
    this.search();
  }

  openPermissionCodeDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.delegationRoleName = String(row.name ?? row.code ?? '');
    this.state.permissionCodeDialogVisible = true;
  }

  onPermissionCodeResponse(): void {
    // Bindings drive the decision point; nothing on the row changes, so no reload is needed.
  }

  openDelegationDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.delegationRoleName = String(row.name ?? row.code ?? '');
    this.state.delegationDialogVisible = true;
  }

  onDelegationResponse(): void {
    this.search();
  }

  openTemporalGrantsDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.temporalGrantsDialogVisible = true;
  }

  openTemporalGrantDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.temporalGrantDialogVisible = true;
  }

  onTemporalGrantResponse(): void {
    // No list column changes from a grant, but refresh keeps things consistent.
    this.search();
  }


  protected getRootActionPath(): string {
    return 'auth/role';
  }

  /** Resource type, user status, and user type dict-item translations come from the backend (also used by UserListDialog). */
  protected getI18nConfig() {
    return [
      { i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' },
      { i18nTypeDictCode: 'dict-item', namespaces: ['user_status', 'user_type'], atomicServiceCode: 'user' },
    ];
  }

  /** Tenant cascader allows only the second level (must pick a specific tenant); selecting only a subsystem is not allowed. */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['roleCode', 'roleName'];
  }

  commandValue(item: unknown, row: Record<string, unknown>): { item: unknown; row: Record<string, unknown> } {
    return { item, row };
  }

  /** Filter out built-in rows on batch delete and warn the user; built-in rows cannot be deleted by design. */
  protected async doMultiDelete(): Promise<void> {
    const all = (this.state.selectedItems ?? []) as Array<Record<string, unknown>>;
    if (all.length === 0) { return super.doMultiDelete(); }
    const targets = all.filter(r => r.builtIn !== true);
    const skipped = all.length - targets.length;
    if (skipped > 0) ElMessage.warning(this.tr('roleList.actions.builtInSkipped', { n: skipped }));
    if (targets.length === 0) return;
    this.state.selectedItems = targets;
    // Aggregate impact across all selected roles (union of all users / groups).
    const summary = await this.fetchBatchImpactSummary(targets);
    this._cachedBatchDeleteMessage = this.tr('roleList.actions.batchDeleteConfirmWithImpact', {
      n: targets.length, users: summary.users, groups: summary.groups,
    });
    try {
      await super.doMultiDelete();
    } finally {
      this._cachedBatchDeleteMessage = null;
    }
  }

  /** Per-row delete: fetch the impact (users + groups still bound to this role) and show a richer confirm. */
  protected async doHandleDelete(row: Record<string, unknown>): Promise<void> {
    const summary = await this.fetchImpactSummary(this.getRowId(row));
    this._cachedDeleteMessage = this.tr('roleList.actions.deleteConfirmWithImpact', {
      users: summary.users, groups: summary.groups,
    });
    try {
      await super.doHandleDelete(row);
    } finally {
      this._cachedDeleteMessage = null;
    }
  }

  /** Per-row message picker; falls back to the framework default when no impact has been pre-fetched. */
  protected getDeleteMessage(row: Record<string, unknown>): string {
    return this._cachedDeleteMessage ?? super.getDeleteMessage(row);
  }

  protected getBatchDeleteMessage(rows: Array<Record<string, unknown>>): string {
    return this._cachedBatchDeleteMessage ?? super.getBatchDeleteMessage(rows);
  }

  /** Counts of users + groups currently bound to a single role. Failures degrade to '?'. */
  private async fetchImpactSummary(roleId: string | number): Promise<{ users: number | string; groups: number | string }> {
    return this.fetchImpactByIds([String(roleId)]);
  }

  /** Counts deduped across a batch of roles. */
  private async fetchBatchImpactSummary(rows: Array<Record<string, unknown>>): Promise<{ users: number | string; groups: number | string }> {
    return this.fetchImpactByIds(rows.map(r => String(this.getRowId(r))));
  }

  /** Single POST to the new backend aggregator — replaces the 2N listUserIds + listGroupIdsByRole
   *  fan-out the page used to make. Backend dedups across the batch; degraded display ('?') only
   *  on outright HTTP failure so the operator still sees the confirm dialog with a partial answer. */
  private async fetchImpactByIds(roleIds: string[]): Promise<{ users: number | string; groups: number | string }> {
    if (roleIds.length === 0) return { users: 0, groups: 0 };
    const result = await backendRequest({
      url: 'auth/role/getDeleteImpact',
      method: 'post',
      params: roleIds as unknown as Record<string, unknown>,
    });
    if (!isApiSuccessResponse(result)) return { users: '?', groups: '?' };
    const payload = getApiResponseData<{ users?: number; groups?: number }>(result);
    return {
      users: typeof payload?.users === 'number' ? payload.users : '?',
      groups: typeof payload?.groups === 'number' ? payload.groups : '?',
    };
  }

  /** Cached message slots used by getDeleteMessage / getBatchDeleteMessage — set by the async overrides above. */
  private _cachedDeleteMessage: string | null = null;
  private _cachedBatchDeleteMessage: string | null = null;

  authorize(commandValue: { item: unknown; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    this.state.subSystemCode = row.subSystemCode;
    this.state.tenantId = row.tenantId;
    const dictItem = item as { first?: number | string; second?: string } | undefined;
    const resType = dictItem?.first;
    // Resource type 1 = menu (handled by the dedicated tree dialog); any other type falls through
    // to the generic flat-transfer dialog. dictItem.second is the i18n key for the type label
    // (e.g. 'resource_type.2'), which the dialog uses to render its title.
    if (resType === 1 || resType === '1') {
      this.state.menuAuthorizationDialogVisible = true;
    } else if (resType != null) {
      this.state.resourceTypeDictCode = String(resType);
      this.state.resourceTypeLabelKey = dictItem?.second ?? null;
      this.state.resourceAssignmentDialogVisible = true;
    }
  }

  assign(commandValue: { item: number; row: Record<string, unknown> }): void {
    const { item, row } = commandValue;
    this.state.rid = this.getRowId(row);
    this.state.subSystemCode = row.subSystemCode;
    this.state.tenantId = row.tenantId;
    if (item === 1) {
      this.state.userAssignmentDialogVisible = true;
    } else {
      this.state.userListDialogVisible = true;
    }
  }
}

export default defineComponent({
  name: 'RoleListPage',
  components: {
    RoleFormPage,
    RoleDetailPage,
    MenuAuthorization,
    UserAssignmentDialog,
    UserListDialog,
    RoleResourceAssignmentDialog,
    RoleCopyDialog,
    RoleDataScopeDialog,
    RoleDelegationDialog,
    RolePermissionCodeDialog,
    RoleTemporalGrantDialog,
    RoleTemporalGrantsDialog,
    BatchBindUsersDialog,
    CopyDocument,
    Filter,
    Clock,
    Share,
    Key,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const columnLabel = createI18nColumnLabelGetter(t, 'roleList.columns');
    const listPage = reactive(new RoleListPage(props, context)) as RoleListPage & { state: Record<string, unknown> };
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

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 39 + 50 + 120,
      reservedWidthRight: 340,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => {
        // Derive the per-cell text extractor for each dynamic column so the
        // auto-width context can measure rendered content without touching the DOM.
        type Row = Record<string, unknown>;
        let getCellText: (row: Row) => string;
        if (key === 'subSystemCode') {
          getCellText = (row) => listPage.transAtomicService(row.subSystemCode);
        } else if (key === 'dataScope') {
          getCellText = (row) => String(row.dataScope ?? 'ALL');
        } else if (key === 'roleName') {
          getCellText = (row) => String(row.roleName ?? '');
        } else if (key === 'remark') {
          getCellText = (row) => String(row.remark ?? '');
        } else if (key === 'createTime') {
          getCellText = (row) => listPage.formatDate(row.createTime);
        } else {
          getCellText = () => '';
        }
        return {
          key,
          getLabel: () => columnLabel(key),
          sortable: key === 'roleName' || key === 'subSystemCode' || key === 'createTime',
          getCellText,
        };
      })
    });

    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('roleList.columns.index'),
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
      // Prototype methods must be exposed explicitly; toRefs(listPage) doesn't include them.
      commandValue: (item: unknown, row: Record<string, unknown>) => listPage.commandValue(item, row),
      authorize: (cmd: { item: unknown; row: Record<string, unknown> }) => listPage.authorize(cmd),
      assign: (cmd: { item: number; row: Record<string, unknown> }) => listPage.assign(cmd),
      openDataScopeDialog: (row: Record<string, unknown>) => listPage.openDataScopeDialog(row),
      onDataScopeResponse: () => listPage.onDataScopeResponse(),
      openTemporalGrantsDialog: (row: Record<string, unknown>) => listPage.openTemporalGrantsDialog(row),
      onRegrantFromView: (userId: string) => {
        // Keep rid pointing at the same role, open the grant form pre-populated in future state.
        listPage.state.temporalGrantsDialogVisible = false;
        listPage.state.temporalGrantDialogVisible = true;
        // The grant form will pick up rid from state; pass userId hint via a brief state field.
        (listPage.state as Record<string, unknown>)._regrantUserId = userId;
      },
      openTemporalGrantDialog: (row: Record<string, unknown>) => listPage.openTemporalGrantDialog(row),
      onTemporalGrantResponse: () => listPage.onTemporalGrantResponse(),
      openCopyDialog: (row: Record<string, unknown>) => listPage.openCopyDialog(row),
      onCopyResponse: () => listPage.onCopyResponse(),
      openBatchBindUsers: () => listPage.openBatchBindUsers(),
      purgeExpiredGrants: async () => {
        try {
          await ElMessageBox.confirm(
            t('roleList.actions.purgeExpiredConfirm'),
            t('roleList.actions.purgeExpired'),
            { type: 'warning' },
          );
        } catch {
          return;
        }
        const result = await backendRequest({ url: 'auth/roleUserTemporal/purgeExpired', method: 'post' });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('roleList.actions.purgeExpiredFailed'));
          return;
        }
        const count = getApiResponseData<number>(result) ?? 0;
        ElMessage.success(t('roleList.actions.purgeExpiredDone', { n: count }));
      },
      hasSelection: computed(() => ((listPage.state.selectedItems ?? []) as Array<unknown>).length > 0),
      getDictItems: (module: string, dictType: string) => listPage.getDictItems(module, dictType),
      transDict: (module: string, dictType: string, code: string | null | undefined) => t(listPage.transDict(module, dictType, code)),
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
  margin-top: 3px; /* card top outer margin */
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

/* Keep the operation column's content on a single line without wrapping. */
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
.role-list-page :deep(.operate-column-icon--disabled) {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}
.role-list-page :deep(.operation-column-cell .el-dropdown) {
  flex-shrink: 0;
}
.role-list-page .ds-all {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
