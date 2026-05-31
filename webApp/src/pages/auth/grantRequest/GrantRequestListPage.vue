<!--
 * Role-grant approval dashboard.
 *
 * Lists role-grant requests submitted through the approval workflow. Approvers act on PENDING
 * rows (approve / reject); requesters can cancel their own pending rows. Terminal rows
 * (APPROVED / REJECTED / CANCELLED) are read-only and shown for audit.
 *
 * Backend (AuthRoleGrantRequestAdminController, kudos-ms-auth):
 *   POST /api/admin/auth/roleGrantRequest/pagingSearch  → page of AuthRoleGrantRequestRow
 *   GET  /api/admin/auth/roleGrantRequest/getDetail
 *   POST /api/admin/auth/roleGrantRequest/submit   body={ roleId, userId, reason }     → new id
 *   POST /api/admin/auth/roleGrantRequest/approve  body={ id, comment }                → boolean
 *   POST /api/admin/auth/roleGrantRequest/reject   body={ id, comment }                → boolean
 *   POST /api/admin/auth/roleGrantRequest/cancel   body={ id }                         → boolean
 *
 * Rows carry only ids (roleId / userId / requesterId / approverId); display names are resolved in
 * one batched pagingSearch per entity after each page loads and patched onto the rows.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <div class="grant-request-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('grantRequestList.actions.showColumnPanel')"
      :column-panel-hide-text="t('grantRequestList.actions.hideColumnPanel')"
      :operation-column-show-text="t('grantRequestList.actions.showOperationColumn')"
      :operation-column-hide-text="t('grantRequestList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell">
          <el-select
            v-model="searchParams.status"
            :placeholder="t('grantRequestList.placeholders.statusFilter')"
            clearable
            class="search-status-input"
            @change="search"
          >
            <el-option v-for="s in statusOptions" :key="s.value" :value="s.value" :label="s.label" />
          </el-select>
        </div>
        <div class="toolbar-cell">
          <el-select
            v-model="searchParams.roleId"
            :placeholder="t('grantRequestList.placeholders.roleFilter')"
            filterable
            remote
            clearable
            :remote-method="searchRoleFilter"
            :loading="roleFilterLoading"
            class="search-name-input"
            @change="search"
          >
            <el-option v-for="r in roleFilterOptions" :key="r.id" :value="r.id" :label="r.label" />
          </el-select>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="mineOnly" class="mine-only-checkbox" @change="onMineOnlyChange">
            {{ t('grantRequestList.actions.mineOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('grantRequestList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('grantRequestList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openSubmitDialog">
          <el-icon><Plus /></el-icon>
          {{ t('grantRequestList.actions.submit') }}
        </el-button>
      </template>
      <div class="table-drag-drop-zone">
        <el-table
          ref="tableRef"
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          @sort-change="handleSortChange"
        >
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('grantRequestList.columns.role')" min-width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._roleName ?? scope.row.roleId }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.user')" min-width="140" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._userName ?? scope.row.userId }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.status')" align="center" min-width="110">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" disable-transitions>{{ statusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.reason')" prop="reason" min-width="180" show-overflow-tooltip />
          <el-table-column :label="t('grantRequestList.columns.requester')" min-width="130" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._requesterName ?? scope.row.requesterId ?? '—' }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.requestTime')" prop="requestTime" min-width="160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.requestTime) }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.approver')" min-width="130" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._approverName ?? scope.row.approverId ?? '—' }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.decisionComment')" prop="decisionComment" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.decisionComment || '—' }}</template>
          </el-table-column>
          <el-table-column :label="t('grantRequestList.columns.decisionTime')" prop="decisionTime" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.decisionTime ? formatDate(scope.row.decisionTime) : '—' }}</template>
          </el-table-column>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('grantRequestList.columns.operation')"
            align="center"
            fixed="right"
            min-width="150"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #default="scope">
              <div class="operation-column-hover-area operation-column-cell">
                <el-tooltip :content="t('grantRequestList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
                <template v-if="isPending(scope.row.status)">
                  <el-tooltip :content="t('grantRequestList.actions.approve')" placement="top" :enterable="false">
                    <el-icon :size="20" class="operate-column-icon op-approve" @click="openDecision(scope.row, 'approve')">
                      <Check />
                    </el-icon>
                  </el-tooltip>
                  <el-tooltip :content="t('grantRequestList.actions.reject')" placement="top" :enterable="false">
                    <el-icon :size="20" class="operate-column-icon op-reject" @click="openDecision(scope.row, 'reject')">
                      <Close />
                    </el-icon>
                  </el-tooltip>
                  <el-tooltip :content="t('grantRequestList.actions.cancel')" placement="top" :enterable="false">
                    <el-icon :size="20" class="operate-column-icon" @click="handleCancel(scope.row)">
                      <Remove />
                    </el-icon>
                  </el-tooltip>
                </template>
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

    <grant-request-form-page v-if="submitDialogVisible" v-model="submitDialogVisible" @response="onActionDone" />
    <grant-request-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    <grant-request-decision-dialog
      v-if="decisionDialogVisible"
      v-model="decisionDialogVisible"
      :action="decisionAction"
      :request-id="decisionRequestId"
      :role-name="decisionRoleName"
      :user-name="decisionUserName"
      @response="onActionDone"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed } from 'vue';
import { Check, Close, Plus, RefreshLeft, Remove, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AuthApiFactory } from 'shared';
import { useI18n } from 'vue-i18n';
import GrantRequestFormPage from './GrantRequestFormPage.vue';
import GrantRequestDetailPage from './GrantRequestDetailPage.vue';
import GrantRequestDecisionDialog from './GrantRequestDecisionDialog.vue';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageVisibilityState, useOperationColumnVisible } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';
import { backendRequest, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { resolveAssignedItems, searchCandidates, type TransferItem } from '../_shared/assignmentTransferUtils';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'grantRequestList.operationColumnPinned';

const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');
const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

class GrantRequestListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        status: null as string | null,
        roleId: null as string | null,
        requesterId: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'auth/roleGrantRequest';
  }

  /** After each page loads, resolve role + user (target / requester / approver) ids to names. */
  protected postSearchSuccessfully(data: any): void {
    super.postSearchSuccessfully(data);
    const rows = this.state.tableData as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return;
    void this.patchNames(rows);
  }

  private async patchNames(rows: Array<Record<string, unknown>>): Promise<void> {
    const roleIds = Array.from(new Set(rows.map(r => r.roleId).filter(Boolean).map(String)));
    const userIds = Array.from(new Set(
      rows.flatMap(r => [r.userId, r.requesterId, r.approverId]).filter(Boolean).map(String),
    ));
    const [roleItems, userItems] = await Promise.all([
      roleIds.length ? resolveAssignedItems({ searchUrl: 'auth/role/pagingSearch', ids: roleIds, pickLabel: roleLabel }) : Promise.resolve([] as TransferItem[]),
      userIds.length ? resolveAssignedItems({ searchUrl: 'user/account/pagingSearch', ids: userIds, pickLabel: userLabel }) : Promise.resolve([] as TransferItem[]),
    ]);
    const roleById = new Map(roleItems.map(i => [i.key, i.label]));
    const userById = new Map(userItems.map(i => [i.key, i.label]));
    for (const r of rows) {
      r._roleName = roleById.get(String(r.roleId ?? '')) ?? r.roleId;
      r._userName = userById.get(String(r.userId ?? '')) ?? r.userId;
      r._requesterName = r.requesterId ? (userById.get(String(r.requesterId)) ?? r.requesterId) : null;
      r._approverName = r.approverId ? (userById.get(String(r.approverId)) ?? r.approverId) : null;
    }
  }
}

export default defineComponent({
  name: 'GrantRequestListPage',
  components: { GrantRequestFormPage, GrantRequestDetailPage, GrantRequestDecisionDialog, ListPageLayout, Check, Close, Plus, Remove, Search, RefreshLeft, Tickets },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new GrantRequestListPage(props, context)) as GrantRequestListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {});
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    const showOperationColumn = useOperationColumnVisible(listPage);
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

    const statusOptions = computed(() => [
      { value: 'PENDING', label: t('grantRequestList.status.PENDING') },
      { value: 'APPROVED', label: t('grantRequestList.status.APPROVED') },
      { value: 'REJECTED', label: t('grantRequestList.status.REJECTED') },
      { value: 'CANCELLED', label: t('grantRequestList.status.CANCELLED') },
    ]);
    const statusLabel = (s: string | null | undefined): string =>
      s ? t(`grantRequestList.status.${s}`) : '—';
    const statusTagType = (s: string | null | undefined): 'warning' | 'success' | 'danger' | 'info' => {
      switch (s) {
        case 'PENDING': return 'warning';
        case 'APPROVED': return 'success';
        case 'REJECTED': return 'danger';
        default: return 'info';
      }
    };
    const isPending = (s: string | null | undefined): boolean => s === 'PENDING';

    const roleFilterOptions = ref<TransferItem[]>([]);
    const roleFilterLoading = ref(false);
    async function searchRoleFilter(keyword: string): Promise<void> {
      roleFilterLoading.value = true;
      try {
        const result = await searchCandidates({
          searchUrl: 'auth/role/pagingSearch',
          keyword,
          keywordField: 'name',
          baseParams: { active: true },
          pageNo: 1,
          pageSize: 50,
          pickLabel: roleLabel,
        });
        roleFilterOptions.value = result.items;
      } finally {
        roleFilterLoading.value = false;
      }
    }
    void searchRoleFilter('');

    // -- "Mine Only" toggle: filter by the current logged-in user's requesterId --
    const mineOnly = ref(false);
    async function onMineOnlyChange(checked: boolean | string | number): Promise<void> {
      const sp = listPage.state.searchParams as Record<string, unknown>;
      if (checked) {
        try {
          const api = AuthApiFactory.getInstance().getAuthApi();
          const me = await api.getMe();
          sp.requesterId = (me as unknown as { id?: string })?.id ?? null;
        } catch {
          sp.requesterId = null;
          mineOnly.value = false;
        }
      } else {
        sp.requesterId = null;
      }
      listPage.search();
    }

    // -- Submit dialog --
    const submitDialogVisible = ref(false);
    function openSubmitDialog(): void { submitDialogVisible.value = true; }

    // -- Detail dialog --
    const detailDialogVisible = ref(false);
    const rid = ref<string | undefined>(undefined);
    function handleDetail(row: Record<string, unknown>): void {
      rid.value = String(row.id ?? '');
      detailDialogVisible.value = true;
    }

    // -- Approve / Reject decision dialog --
    const decisionDialogVisible = ref(false);
    const decisionAction = ref<'approve' | 'reject'>('approve');
    const decisionRequestId = ref<string>('');
    const decisionRoleName = ref<string>('');
    const decisionUserName = ref<string>('');
    function openDecision(row: Record<string, unknown>, action: 'approve' | 'reject'): void {
      decisionAction.value = action;
      decisionRequestId.value = String(row.id ?? '');
      decisionRoleName.value = String(row._roleName ?? row.roleId ?? '');
      decisionUserName.value = String(row._userName ?? row.userId ?? '');
      decisionDialogVisible.value = true;
    }

    // -- Cancel (requester action; no comment) --
    async function handleCancel(row: Record<string, unknown>): Promise<void> {
      try {
        await ElMessageBox.confirm(
          t('grantRequestList.confirm.cancelBody'),
          t('grantRequestList.confirm.cancelTitle'),
          { type: 'warning', confirmButtonText: t('grantRequestList.actions.cancel'), cancelButtonText: t('grantRequestList.actions.dismiss') },
        );
      } catch {
        return; // user dismissed
      }
      const result = await backendRequest({ url: 'auth/roleGrantRequest/cancel', method: 'post', params: { id: String(row.id ?? '') } });
      if (!isApiSuccessResponse(result)) {
        ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('grantRequestList.messages.cancelFailed'));
        return;
      }
      ElMessage.success(t('grantRequestList.messages.cancelSuccess'));
      listPage.search();
    }

    function onActionDone(): void {
      listPage.search();
    }

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      listLayoutRefs,
      tableRef,
      isColumnVisible,
      onTableWrapMounted,
      showOperationColumn,
      statusOptions,
      statusLabel,
      statusTagType,
      isPending,
      roleFilterOptions,
      roleFilterLoading,
      searchRoleFilter,
      mineOnly,
      onMineOnlyChange,
      submitDialogVisible,
      openSubmitDialog,
      detailDialogVisible,
      rid,
      handleDetail,
      decisionDialogVisible,
      decisionAction,
      decisionRequestId,
      decisionRoleName,
      decisionUserName,
      openDecision,
      handleCancel,
      onActionDone,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.grant-request-list-page {
  height: 100%;
}
.grant-request-list-page :deep(.list-page-card) {
  margin-top: 3px;
}
.grant-request-list-page .list-page-toolbar .toolbar-cell {
  margin-right: 8px;
}
.grant-request-list-page .list-page-toolbar .search-name-input {
  min-width: 200px;
}
.grant-request-list-page .list-page-toolbar .search-status-input {
  min-width: 150px;
}
.grant-request-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}
.grant-request-list-page :deep(.operation-column-cell) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.grant-request-list-page :deep(.op-approve) {
  color: var(--el-color-success);
}
.grant-request-list-page :deep(.op-reject) {
  color: var(--el-color-danger);
}
.grant-request-list-page .mine-only-checkbox {
  white-space: nowrap;
  margin-left: 4px;
}
</style>
