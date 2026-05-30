<!--
 * SoD (Separation of Duties) role-exclusion list.
 *
 * Lists mutually-exclusive role pairs. A user may never simultaneously hold both roles of a pair
 * (enforced server-side in AuthRoleUserService.batchBind). This page manages the rules; the
 * detail dialog additionally shows a live scan of users who currently violate a given rule.
 *
 * Backend (AuthRoleExclusionAdminController, kudos-ms-auth):
 *   POST   /api/admin/auth/roleExclusion/pagingSearch   → page of AuthRoleExclusionRow
 *   POST   /api/admin/auth/roleExclusion/save           → create
 *   DELETE /api/admin/auth/roleExclusion/delete?id=...  → delete
 *   GET    /api/admin/auth/roleExclusion/getDetail
 *   GET    /api/admin/auth/roleExclusion/findViolations
 *
 * Rows carry only roleAId / roleBId; names are resolved in one batched pagingSearch after each
 * page loads and patched onto the rows as _roleAName / _roleBName.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <div class="role-exclusion-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('roleExclusionList.actions.showColumnPanel')"
      :column-panel-hide-text="t('roleExclusionList.actions.hideColumnPanel')"
      :operation-column-show-text="t('roleExclusionList.actions.showOperationColumn')"
      :operation-column-hide-text="t('roleExclusionList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell">
          <el-select
            v-model="searchParams.roleId"
            :placeholder="t('roleExclusionList.placeholders.roleFilter')"
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
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('roleExclusionList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('roleExclusionList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('roleExclusionList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('roleExclusionList.actions.delete') }}
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
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('roleExclusionList.columns.roleA')" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._roleAName ?? scope.row.roleAId }}</template>
          </el-table-column>
          <el-table-column :label="t('roleExclusionList.columns.roleB')" min-width="160" show-overflow-tooltip>
            <template #default="scope">{{ scope.row._roleBName ?? scope.row.roleBId }}</template>
          </el-table-column>
          <el-table-column :label="t('roleExclusionList.columns.description')" prop="description" min-width="200" show-overflow-tooltip />
          <el-table-column :label="t('roleExclusionList.columns.createTime')" prop="createTime" min-width="160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
          </el-table-column>
          <el-table-column :label="t('roleExclusionList.columns.createUser')" prop="createUserName" min-width="120" show-overflow-tooltip />
          <el-table-column
            v-if="showOperationColumn"
            :label="t('roleExclusionList.columns.operation')"
            align="center"
            fixed="right"
            min-width="100"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #default="scope">
              <div class="operation-column-hover-area operation-column-cell">
                <el-tooltip :content="t('roleExclusionList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('roleExclusionList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
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

    <role-exclusion-form-page v-if="addDialogVisible" v-model="addDialogVisible" @response="onFormResponse" />
    <role-exclusion-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import RoleExclusionFormPage from './RoleExclusionFormPage.vue';
import RoleExclusionDetailPage from './RoleExclusionDetailPage.vue';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageVisibilityState, useOperationColumnVisible } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import { resolveAssignedItems, searchCandidates, type TransferItem } from '../_shared/assignmentTransferUtils';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'roleExclusionList.operationColumnPinned';

const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');

class RoleExclusionListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        roleId: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'auth/roleExclusion';
  }

  /** After each page loads, resolve every roleA/roleB id to a name in one batched search. */
  protected postSearchSuccessfully(data: any): void {
    super.postSearchSuccessfully(data);
    const rows = this.state.tableData as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return;
    const ids = Array.from(new Set(rows.flatMap(r => [r.roleAId, r.roleBId]).filter(Boolean).map(String)));
    if (ids.length === 0) return;
    void this.patchRoleNames(rows, ids);
  }

  private async patchRoleNames(rows: Array<Record<string, unknown>>, ids: string[]): Promise<void> {
    const items: TransferItem[] = await resolveAssignedItems({ searchUrl: 'auth/role/pagingSearch', ids, pickLabel: roleLabel });
    const nameById = new Map(items.map(i => [i.key, i.label]));
    for (const r of rows) {
      r._roleAName = nameById.get(String(r.roleAId ?? '')) ?? r.roleAId;
      r._roleBName = nameById.get(String(r.roleBId ?? '')) ?? r.roleBId;
    }
  }
}

export default defineComponent({
  name: 'RoleExclusionListPage',
  components: { RoleExclusionFormPage, RoleExclusionDetailPage, ListPageLayout, Delete, Plus, Search, RefreshLeft, Tickets },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new RoleExclusionListPage(props, context)) as RoleExclusionListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {});
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    const showOperationColumn = useOperationColumnVisible(listPage);
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

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

    function onFormResponse(): void {
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
      roleFilterOptions,
      roleFilterLoading,
      searchRoleFilter,
      onFormResponse,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.role-exclusion-list-page {
  height: 100%;
}
.role-exclusion-list-page :deep(.list-page-card) {
  margin-top: 3px;
}
.role-exclusion-list-page .list-page-toolbar .toolbar-cell {
  margin-right: 8px;
}
.role-exclusion-list-page .list-page-toolbar .search-name-input {
  min-width: 200px;
}
.role-exclusion-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}
.role-exclusion-list-page :deep(.operation-column-cell) {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
