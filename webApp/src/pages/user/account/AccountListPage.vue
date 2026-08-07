<!--
 * Account list: organization tree on the left and table on the right; supports filtering by tenant and username; the table supports column visibility, operation-column fold, and i18n.
 *
 * @author K
 * @author AI: Codex
 * @author AI: Cursor
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="account-list-page list-page-common">
    <el-card class="account-list-card">
      <el-row :gutter="6" class="account-list-row">
        <el-col :span="3" class="account-tree-col">
          <div class="account-tree-wrap">
            <el-scrollbar>
              <el-tree
                :data="organizations"
                node-key="id"
                default-expand-all
                :props="defaultProps"
                :current-node-key="selectedOrgId"
                highlight-current
                @node-click="onOrgNodeClick"
              />
            </el-scrollbar>
          </div>
        </el-col>
        <el-col :span="21" class="account-table-col">
          <list-page-layout
            :table-wrap-ref="listLayoutRefs.tableWrapRef"
            :list-page="listPage"
            :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
            :column-panel-show-text="t('accountList.actions.showColumnPanel')"
            :column-panel-hide-text="t('accountList.actions.hideColumnPanel')"
            :operation-column-show-text="t('accountList.actions.showOperationColumn')"
            :operation-column-hide-text="t('accountList.actions.hideOperationColumn')"
            @table-wrap-mounted="onTableWrapMounted"
          >
            <template #toolbar>
              <div class="toolbar-cell toolbar-cascader">
                <el-cascader
                  v-model="searchParams.subSysOrTenant"
                  :options="subSysOrTenants || []"
                  :props="listPage.state.cascaderProps"
                  :placeholder="t('accountList.placeholders.subSysTenant')"
                  clearable
                  class="search-cascader-input"
                  @change="onSubSysOrTenantChange"
                />
              </div>
              <div class="toolbar-cell toolbar-username">
                <el-input
                  v-model="searchParams.username"
                  :placeholder="t('accountList.placeholders.username')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                  @change="search"
                />
              </div>
              <div class="toolbar-buttons">
                <el-button type="primary" round @click="search">
                  <el-icon><Search /></el-icon>
                  {{ t('accountList.actions.search') }}
                </el-button>
                <el-button type="primary" round @click="resetSearchFields">
                  <el-icon><RefreshLeft /></el-icon>
                  {{ t('accountList.actions.reset') }}
                </el-button>
              </div>
            </template>
            <template #tableToolbar>
              <el-button type="success" @click="openAddDialog">
                <el-icon><Plus /></el-icon>
                {{ t('accountList.actions.add') }}
              </el-button>
              <el-button type="danger" @click="multiDelete">
                <el-icon><Delete /></el-icon>
                {{ t('accountList.actions.delete') }}
              </el-button>
            </template>
            <template #columnVisibilityPanel>
              <div class="column-visibility-title">{{ t('accountList.actions.columnVisibility') }}</div>
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
                  :label="t('accountList.columns.username')"
                  prop="username"
                  sortable="custom"
                  min-width="120"
                  fixed="left"
                  class-name="col-fixed-name"
                  show-overflow-tooltip
                />
                <template v-for="key in orderedColumnKeys" :key="key">
                  <el-table-column
                    v-if="key === 'subSystemCode' && isColumnVisible('subSystemCode')"
                    prop="subSystemCode"
                    :min-width="columnWidths['subSystemCode'] ?? 120"
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
                      >{{ t('accountList.columns.subSys') }}</div>
                    </template>
                    <template #default="scope">
                      {{ transAtomicService(scope.row.subSystemCode) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-else-if="key === 'tenantId' && isColumnVisible('tenantId')"
                    prop="tenantId"
                    :min-width="columnWidths['tenantId'] ?? 100"
                    show-overflow-tooltip
                  >
                    <template #header>
                      <div
                        class="column-header-draggable"
                        data-column-key="tenantId"
                        :class="{ 'is-dragging': columnDragKey === 'tenantId', 'is-drop-target': columnDropTargetKey === 'tenantId' }"
                        draggable="true"
                        @dragstart="onHeaderDragStart($event, 'tenantId')"
                        @dragover="onHeaderDragOver($event, 'tenantId')"
                        @drop="onHeaderDrop($event, 'tenantId')"
                        @dragend="onHeaderDragEnd"
                      >{{ t('accountList.columns.tenant') }}</div>
                    </template>
                    <template #default="scope">
                      {{ scope.row.tenantName ?? '—' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-else-if="key === 'userStatusDictCode' && isColumnVisible('userStatusDictCode')"
                    prop="userStatusDictCode"
                    :min-width="columnWidths['userStatusDictCode'] ?? 100"
                    sortable="custom"
                    show-overflow-tooltip
                  >
                    <template #header>
                      <div
                        class="column-header-draggable"
                        data-column-key="userStatusDictCode"
                        :class="{ 'is-dragging': columnDragKey === 'userStatusDictCode', 'is-drop-target': columnDropTargetKey === 'userStatusDictCode' }"
                        draggable="true"
                        @dragstart="onHeaderDragStart($event, 'userStatusDictCode')"
                        @dragover="onHeaderDragOver($event, 'userStatusDictCode')"
                        @drop="onHeaderDrop($event, 'userStatusDictCode')"
                        @dragend="onHeaderDragEnd"
                      >{{ t('accountList.columns.userStatus') }}</div>
                    </template>
                    <template #default="scope">
                      {{ formatDictCell('user', 'user_status', scope.row.userStatusDictCode) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-else-if="key === 'userTypeDictCode' && isColumnVisible('userTypeDictCode')"
                    prop="userTypeDictCode"
                    :min-width="columnWidths['userTypeDictCode'] ?? 100"
                    sortable="custom"
                    show-overflow-tooltip
                  >
                    <template #header>
                      <div
                        class="column-header-draggable"
                        data-column-key="userTypeDictCode"
                        :class="{ 'is-dragging': columnDragKey === 'userTypeDictCode', 'is-drop-target': columnDropTargetKey === 'userTypeDictCode' }"
                        draggable="true"
                        @dragstart="onHeaderDragStart($event, 'userTypeDictCode')"
                        @dragover="onHeaderDragOver($event, 'userTypeDictCode')"
                        @drop="onHeaderDrop($event, 'userTypeDictCode')"
                        @dragend="onHeaderDragEnd"
                      >{{ t('accountList.columns.userType') }}</div>
                    </template>
                    <template #default="scope">
                      {{ formatDictCell('user', 'user_type', scope.row.userTypeDictCode) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-else-if="key === 'lastLoginTime' && isColumnVisible('lastLoginTime')"
                    prop="lastLoginTime"
                    :min-width="columnWidths['lastLoginTime'] ?? 160"
                    sortable="custom"
                    show-overflow-tooltip
                  >
                    <template #header>
                      <div
                        class="column-header-draggable"
                        data-column-key="lastLoginTime"
                        :class="{ 'is-dragging': columnDragKey === 'lastLoginTime', 'is-drop-target': columnDropTargetKey === 'lastLoginTime' }"
                        draggable="true"
                        @dragstart="onHeaderDragStart($event, 'lastLoginTime')"
                        @dragover="onHeaderDragOver($event, 'lastLoginTime')"
                        @drop="onHeaderDrop($event, 'lastLoginTime')"
                        @dragend="onHeaderDragEnd"
                      >{{ t('accountList.columns.lastLoginTime') }}</div>
                    </template>
                    <template #default="scope">
                      {{ formatDate(scope.row.lastLoginTime) }}
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
                      >{{ t('accountList.columns.createTime') }}</div>
                    </template>
                    <template #default="scope">
                      {{ formatDate(scope.row.createTime) }}
                    </template>
                  </el-table-column>
                </template>
                <el-table-column
                  v-if="showOperationColumn"
                  :label="t('accountList.columns.operation')"
                  align="center"
                    fixed="right"
                    min-width="420"
                    class-name="operation-column"
                >
                  <template #header>
                    <div class="operation-column-hover-area">{{ t('accountList.columns.operation') }}</div>
                  </template>
                  <template #default="scope">
                    <div class="operation-column-hover-area operation-column-cell">
                      <el-tooltip :content="t('accountList.actions.edit')" placement="top" :enterable="false">
                        <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                          <Edit />
                        </el-icon>
                      </el-tooltip>
                      <el-tooltip :content="t('accountList.actions.delete')" placement="top" :enterable="false">
                        <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                          <Delete />
                        </el-icon>
                      </el-tooltip>
                      <el-tooltip :content="t('accountList.actions.detail')" placement="top" :enterable="false">
                        <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                          <Tickets />
                        </el-icon>
                      </el-tooltip>
                      <el-button size="small" type="primary" @click="openRolesDialog(scope.row)">
                        {{ t('accountList.actions.assignRoles') }}
                      </el-button>
                      <el-button size="small" type="primary" @click="openGroupsDialog(scope.row)">
                        {{ t('accountList.actions.assignGroups') }}
                      </el-button>
                      <el-button size="small" @click="openPermissionsDialog(scope.row)">
                        {{ t('accountList.actions.permissions') }}
                      </el-button>
                      <el-button size="small" @click="openExplainDialog(scope.row)">
                        {{ t('accountList.actions.explain') }}
                      </el-button>
                      <el-button size="small" @click="openDataScopeExplainDialog(scope.row)">
                        {{ t('accountList.actions.dataScopeExplain') }}
                      </el-button>
                      <el-dropdown trigger="click" @command="(cmd: string) => onSecurityCommand(cmd, scope.row)">
                        <el-button size="small" type="warning">
                          {{ t('accountSecurity.trigger') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="toggleActive">
                              {{ scope.row.active ? t('accountSecurity.menu.disable') : t('accountSecurity.menu.enable') }}
                            </el-dropdown-item>
                            <el-dropdown-item command="resetPassword" divided>{{ t('accountSecurity.menu.resetPassword') }}</el-dropdown-item>
                            <el-dropdown-item command="resetSecurityPassword">{{ t('accountSecurity.menu.resetSecurityPassword') }}</el-dropdown-item>
                            <el-dropdown-item command="resetAuthKey" divided>{{ t('accountSecurity.menu.resetAuthKey') }}</el-dropdown-item>
                            <el-dropdown-item command="cleanAuthKey">{{ t('accountSecurity.menu.cleanAuthKey') }}</el-dropdown-item>
                            <el-dropdown-item command="freeze" divided>{{ t('accountSecurity.menu.freeze') }}</el-dropdown-item>
                            <el-dropdown-item command="unfreeze">{{ t('accountSecurity.menu.unfreeze') }}</el-dropdown-item>
                            <el-dropdown-item command="permissionVersion" divided>
                              {{ t('accountSecurity.menu.revokeAllTokens') }}
                            </el-dropdown-item>
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
        </el-col>
      </el-row>
    </el-card>

    <!-- Add and Edit share one form; mount on first open of either; the v-if/v-show is on a plain div to avoid the ElDialog non-element-root directive warning -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <account-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <AccountDetailPage v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    <account-roles-dialog
      v-if="rolesDialogVisible"
      v-model="rolesDialogVisible"
      :rid="rid"
      :sub-system-code="rowSubSystemCode"
      :tenant-id="rowTenantId"
    />
    <account-groups-dialog
      v-if="groupsDialogVisible"
      v-model="groupsDialogVisible"
      :rid="rid"
      :sub-system-code="rowSubSystemCode"
      :tenant-id="rowTenantId"
    />
    <account-effective-permissions-dialog
      v-if="permissionsDialogVisible"
      v-model="permissionsDialogVisible"
      :rid="rid"
    />
    <!-- "Why does this user have (or not have) X" — the decision point's own evidence. -->
    <permission-explain-dialog
      v-if="explainDialogVisible"
      v-model="explainDialogVisible"
      :user-id="rid"
      :user-name="explainUserName"
    />
    <!-- "Which data can they see, and why" — the companion to the permission explanation. -->
    <data-scope-explain-dialog
      v-if="dataScopeExplainVisible"
      v-model="dataScopeExplainVisible"
      :user-id="rid"
      :user-name="explainUserName"
    />
    <account-security-dialog
      v-if="securityDialogVisible"
      v-model="securityDialogVisible"
      :rid="rid"
      :username="securityUsername"
      :mode="securityMode"
      @response="search"
    />
    <account-token-version-dialog
      v-if="tokenVersionDialogVisible"
      v-model="tokenVersionDialogVisible"
      :user-id="rid"
      :user-name="securityUsername"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick } from 'vue';
import { tGlobal } from '../../../i18n';
import { ArrowDown, Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AccountFormPage from './AccountFormPage.vue';
import AccountDetailPage from './AccountDetailPage.vue';
import AccountRolesDialog from './AccountRolesDialog.vue';
import AccountGroupsDialog from './AccountGroupsDialog.vue';
import AccountEffectivePermissionsDialog from './AccountEffectivePermissionsDialog.vue';
import PermissionExplainDialog from '../../auth/authz/PermissionExplainDialog.vue';
import DataScopeExplainDialog from '../../auth/authz/DataScopeExplainDialog.vue';
import AccountSecurityDialog from './AccountSecurityDialog.vue';
import AccountTokenVersionDialog from './AccountTokenVersionDialog.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { Pair } from '../../../components/model/Pair';
import { ElMessage, ElMessageBox } from 'element-plus';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, createI18nColumnLabelGetter, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useColumnOrderDrag } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'accountList.operationColumnPinned';
const ACCOUNT_LIST_STATE_STORAGE_KEY = 'accountList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'accountList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'accountList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['subSystemCode', 'tenantId', 'userStatusDictCode', 'userTypeDictCode', 'lastLoginTime', 'createTime']);

class AccountListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['user_status', 'user_type'], 'user');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        username: null as string | null,
      },
      /** Currently selected node id in the left tree; reloading table data when it changes */
      selectedOrgId: null as string | null,
      defaultProps: {
        children: 'children',
        label: 'name',
      },
      organizations: [] as unknown[],
      rolesDialogVisible: false,
      groupsDialogVisible: false,
      permissionsDialogVisible: false,
      explainDialogVisible: false,
      dataScopeExplainVisible: false,
      explainUserName: '',
      /** Security-operations dialog (reset password / 2FA / freeze) */
      securityDialogVisible: false,
      securityMode: '' as string,
      securityUsername: '' as string,
      tokenVersionDialogVisible: false,
      /** Subsystem / tenant pulled from the clicked row — separate from the toolbar cascader's selection. */
      rowSubSystemCode: null as string | null,
      rowTenantId: null as string | null,
    };
  }

  openRolesDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.rowSubSystemCode = row.subSystemCode ?? null;
    this.state.rowTenantId = row.tenantId ?? null;
    this.state.rolesDialogVisible = true;
  }

  openGroupsDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.rowSubSystemCode = row.subSystemCode ?? null;
    this.state.rowTenantId = row.tenantId ?? null;
    this.state.groupsDialogVisible = true;
  }

  openPermissionsDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.permissionsDialogVisible = true;
  }

  openExplainDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.explainUserName = String(row.displayName ?? row.username ?? '');
    this.state.explainDialogVisible = true;
  }

  openDataScopeExplainDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.explainUserName = String(row.displayName ?? row.username ?? '');
    this.state.dataScopeExplainVisible = true;
  }

  /** Dispatch the per-row security dropdown: input-driven ops open a dialog; the rest run inline after a confirm. */
  onSecurityCommand(command: string, row: Record<string, unknown>): void {
    switch (command) {
      case 'toggleActive': void this.doToggleActive(row); break;
      case 'cleanAuthKey': void this.doCleanAuthKey(row); break;
      case 'unfreeze': void this.doUnfreeze(row); break;
      case 'permissionVersion':
        this.openTokenVersionDialog(row);
        break;
      case 'resetPassword':
      case 'resetSecurityPassword':
      case 'resetAuthKey':
      case 'freeze':
        this.openSecurityDialog(command, row);
        break;
    }
  }

  private openTokenVersionDialog(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.securityUsername = String(row.username ?? '');
    this.state.tokenVersionDialogVisible = true;
  }

  private openSecurityDialog(mode: string, row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.securityUsername = String(row.username ?? '');
    this.state.securityMode = mode;
    this.state.securityDialogVisible = true;
  }

  private async confirm(messageKey: string, name: string): Promise<boolean> {
    const result = await ElMessageBox.confirm(
      this.tr(messageKey, { name }),
      this.tr('accountSecurity.confirm.title'),
      {
        confirmButtonText: this.tr('accountSecurity.confirm.confirmButton'),
        cancelButtonText: this.tr('accountSecurity.confirm.cancelButton'),
        type: 'warning',
      },
    ).catch((err) => err);
    return result === 'confirm';
  }

  private async runSecurityAction(url: string, params: Record<string, unknown>, method: 'post' | 'put'): Promise<void> {
    const result = await backendRequest({ url, method, params, paramsInQuery: true });
    if (isApiSuccessResponse(result)) {
      ElMessage.success(this.tr('accountSecurity.messages.success'));
      this.search();
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('accountSecurity.messages.failed'));
    }
  }

  private async doToggleActive(row: Record<string, unknown>): Promise<void> {
    const name = String(row.username ?? '');
    const next = !row.active;
    if (!await this.confirm(next ? 'accountSecurity.confirm.enable' : 'accountSecurity.confirm.disable', name)) return;
    await this.runSecurityAction('user/account/updateActive', { id: this.getRowId(row), active: next }, 'put');
  }

  private async doCleanAuthKey(row: Record<string, unknown>): Promise<void> {
    if (!await this.confirm('accountSecurity.confirm.cleanAuthKey', String(row.username ?? ''))) return;
    await this.runSecurityAction('user/account/cleanAuthKey', { id: this.getRowId(row) }, 'post');
  }

  private async doUnfreeze(row: Record<string, unknown>): Promise<void> {
    if (!await this.confirm('accountSecurity.confirm.unfreeze', String(row.username ?? ''))) return;
    await this.runSecurityAction('user/account/unfreezeAccount', { id: this.getRowId(row) }, 'post');
  }

  /** Left org-tree node click: update the selected org and refresh the table */
  onOrganizationNodeClick(nodeData: { id?: string }): void {
    const id = nodeData?.id ?? null;
    (this.state as Record<string, unknown>).selectedOrgId = id;
    this.search();
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const orgId = (this.state as Record<string, unknown>).selectedOrgId as string | null | undefined;
    if (orgId != null && orgId !== '') {
      params.organizationId = orgId;
    }
    return params;
  }

  protected getRootActionPath(): string {
    return 'user/account';
  }

  /** User-status and user-type dict-item translations are fetched from the backend */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['user_status', 'user_type'], atomicServiceCode: 'user' }];
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['username'];
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  protected async doSearch(): Promise<void> {
    const pair = this.parseSubSysOrTenant();
    if (pair == null) return;
    await this.loadTree(pair);
    return super.doSearch();
  }

  private async loadTree(pair: Pair | null): Promise<void> {
    if (!pair) return;
    const params = {
      subSystemCode: pair.first,
      tenantId: pair.second,
    };
    const result = await backendRequest({ url: 'user/organization/loadTree', params });
    const payload = getApiResponseData<Record<string, unknown>[]>(result);
    if (Array.isArray(payload)) {
      (this.state as Record<string, unknown>).organizations = payload;
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tGlobal('listPage.orgTreeLoadFailed'));
    }
  }
}

export default defineComponent({
  name: 'AccountListPage',
  components: { AccountFormPage, AccountDetailPage, AccountRolesDialog, AccountGroupsDialog, AccountEffectivePermissionsDialog, PermissionExplainDialog, DataScopeExplainDialog, AccountSecurityDialog, AccountTokenVersionDialog, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus, ArrowDown },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new AccountListPage(props, context)) as AccountListPage & { state: Record<string, unknown> };
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
    // Fixed-left total width: selection col (39) + index col (50) + username col (120).
    const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;
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
    const columnKeyToLabelKey: Record<string, string> = {
      subSystemCode: 'subSys',
      tenantId: 'tenant',
      userStatusDictCode: 'userStatus',
      userTypeDictCode: 'userType',
      lastLoginTime: 'lastLoginTime',
      createTime: 'createTime',
    };
    const columnLabel = createI18nColumnLabelGetter(t, 'accountList.columns', columnKeyToLabelKey);
    /** Dict-item display: if it looks like an i18n key (contains a dot), use t(key); otherwise show the key or em-dash to avoid errors from calls like t('NORMAL') */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      if (!key) return '—';
      return key.includes('.') ? t(key) : key;
    }
    const {
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 209,
      reservedWidthRight: 140,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnLabel(key),
        sortable: true,
        getCellText:
          key === 'subSystemCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSystemCode)
            : key === 'tenantId'
              ? (row: Record<string, unknown>) => String(row.tenantName ?? '—')
              : key === 'userStatusDictCode'
              ? (row: Record<string, unknown>) => formatDictCell('user', 'user_status', row.userStatusDictCode)
              : key === 'userTypeDictCode'
                ? (row: Record<string, unknown>) => formatDictCell('user', 'user_type', row.userTypeDictCode)
                : key === 'lastLoginTime'
                  ? (row: Record<string, unknown>) => listPage.formatDate(row.lastLoginTime)
                  : key === 'createTime'
                    ? (row: Record<string, unknown>) => listPage.formatDate(row.createTime)
                    : () => '',
      }))
    });

    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('accountList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: columnLabel,
    });

    // Template-bound wrappers — keep the class method private and expose only plain functions to the template.
    function onOrgNodeClick(nodeData: { id?: string }) {
      listPage.onOrganizationNodeClick(nodeData);
    }

    /** Changing the subsystem/tenant cascader resets the org-tree selection and triggers a fresh search. */
    function onSubSysOrTenantChange() {
      (listPage.state as Record<string, unknown>).selectedOrgId = null;
      listPage.search();
    }

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
      onTableWrapMounted,
      onOrgNodeClick,
      onSubSysOrTenantChange,
      formatDictCell,
      openRolesDialog: (row: Record<string, unknown>) => listPage.openRolesDialog(row),
      openGroupsDialog: (row: Record<string, unknown>) => listPage.openGroupsDialog(row),
      openPermissionsDialog: (row: Record<string, unknown>) => listPage.openPermissionsDialog(row),
      openExplainDialog: (row: Record<string, unknown>) => listPage.openExplainDialog(row),
      openDataScopeExplainDialog: (row: Record<string, unknown>) => listPage.openDataScopeExplainDialog(row),
      onSecurityCommand: (cmd: string, row: Record<string, unknown>) => listPage.onSecurityCommand(cmd, row),
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.account-list-page {
  height: 100%;
}
.account-list-card {
  height: 100%;
  margin-top: 3px; /* Card top margin */
}
.account-list-card :deep(.el-card__body) {
  height: 100%;
  padding: 8px 5px 5px 5px; /* Top padding 8px (5+3) */
}
.account-list-row {
  height: 100%;
}
.account-tree-col {
  height: 100%;
}
.account-tree-wrap {
  height: 100%;
  min-height: 200px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 4px;
  background: var(--el-fill-color-lighter);
}
.account-tree-wrap .el-scrollbar {
  height: 100%;
}
.account-table-col {
  height: 100%;
  min-width: 0;
}
.account-list-page .list-page-toolbar .toolbar-cascader,
.account-list-page .list-page-toolbar .toolbar-username {
  margin-right: 8px;
}
.account-list-page .list-page-toolbar .toolbar-username .search-name-input,
.account-list-page .list-page-toolbar .toolbar-cascader .search-cascader-input {
  min-width: 140px;
}
.account-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}

/* Sort icon stays on the same row as the header text instead of taking its own line */
.account-list-page :deep(.el-table thead th .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.account-list-page :deep(.el-table thead th .el-table__column-sort),
.account-list-page :deep(.el-table thead th .caret-wrapper) {
  flex-shrink: 0;
  margin-left: 4px;
}

/* Column-visibility config: all column options stacked in a single vertical column */
.account-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.account-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

/* Keep the operation column's content on a single line without wrapping. */
.account-list-page :deep(.operation-column-cell) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}
.account-list-page :deep(.operation-column-cell .operate-column-icon) {
  flex-shrink: 0;
}
.account-list-page :deep(.operation-column-cell .el-button) {
  flex-shrink: 0;
}
</style>
