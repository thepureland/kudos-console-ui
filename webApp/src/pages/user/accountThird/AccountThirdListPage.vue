<!--
 * Account-third (third-party account binding) list: filter by user id / provider / subject; supports pagination & i18n.
 *
 * @author: K
 * @author: AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="account-third-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('accountThirdList.actions.showColumnPanel')"
      :column-panel-hide-text="t('accountThirdList.actions.hideColumnPanel')"
      :operation-column-show-text="t('accountThirdList.actions.showOperationColumn')"
      :operation-column-hide-text="t('accountThirdList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-user-id">
          <el-input
            v-model="searchParams.userId"
            :placeholder="t('accountThirdList.placeholders.userId')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-provider">
          <el-input
            v-model="searchParams.accountProviderDictCode"
            :placeholder="t('accountThirdList.placeholders.provider')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-subject">
          <el-input
            v-model="searchParams.subject"
            :placeholder="t('accountThirdList.placeholders.subject')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('accountThirdList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>{{ t('accountThirdList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>{{ t('accountThirdList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>{{ t('accountThirdList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>{{ t('accountThirdList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('accountThirdList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
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
          <el-table-column
            :label="t('accountThirdList.columns.userId')"
            prop="userId"
            min-width="160"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <el-table-column v-if="isColumnVisible('accountProviderDictCode')" :label="t('accountThirdList.columns.provider')" prop="accountProviderDictCode" :min-width="columnWidths['accountProviderDictCode'] ?? 120" sortable="custom" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('subject')" :label="t('accountThirdList.columns.subject')" prop="subject" :min-width="columnWidths['subject'] ?? 160" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('externalDisplayName')" :label="t('accountThirdList.columns.externalDisplayName')" prop="externalDisplayName" :min-width="columnWidths['externalDisplayName'] ?? 140" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('externalEmail')" :label="t('accountThirdList.columns.externalEmail')" prop="externalEmail" :min-width="columnWidths['externalEmail'] ?? 160" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('lastLoginTime')" :label="t('accountThirdList.columns.lastLoginTime')" prop="lastLoginTime" :min-width="columnWidths['lastLoginTime'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.lastLoginTime) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('active')" :label="t('accountThirdList.columns.active')" prop="active" :min-width="columnWidths['active'] ?? 80" show-overflow-tooltip>
            <template #default="scope">
              <el-switch v-model="scope.row.active" :active-value="true" :inactive-value="false" @change="updateActive(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('accountThirdList.columns.operation')" align="center" fixed="right" min-width="68" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('accountThirdList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('accountThirdList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)"><Edit /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('accountThirdList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('accountThirdList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)"><Tickets /></el-icon>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #pagination>
        <el-pagination
          :ref="(el: unknown) => { listLayoutRefs.paginationRef.value = (el as { $el?: HTMLElement } | HTMLElement | null) ?? null; }"
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

    <div v-if="hasFormEverOpened" v-show="formVisible">
      <account-third-form-page
        :model-value="formVisible"
        :rid="formRid"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <account-third-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AccountThirdFormPage from './AccountThirdFormPage.vue';
import AccountThirdDetailPage from './AccountThirdDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class AccountThirdListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        userId: null as string | null,
        accountProviderDictCode: null as string | null,
        subject: null as string | null,
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/accountThird';
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
    return ['userId', 'accountProviderDictCode', 'subject'];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'accountThirdList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'accountThirdList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['accountProviderDictCode', 'subject', 'externalDisplayName', 'externalEmail', 'lastLoginTime', 'active']);
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 160;

export default defineComponent({
  name: 'AccountThirdListPage',
  components: { AccountThirdFormPage, AccountThirdDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new AccountThirdListPage(props, context)) as AccountThirdListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const { formVisible, formRid, hasFormEverOpened, currentFormMode, onFormClose, onFormResponse } = useListPageFormSetup({ state, listPage, addHandlerName: 'doAfterAdd', editHandlerName: 'doAfterEdit' });
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('accountThirdList.columns.index') : t('accountThirdList.columns.' + key)),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 249,
      reservedWidthRight: 140,
      createAutoWidthColumns: () => [
        { key: 'accountProviderDictCode', getLabel: () => t('accountThirdList.columns.provider'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.accountProviderDictCode ?? '') },
        { key: 'subject', getLabel: () => t('accountThirdList.columns.subject'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.subject ?? '') },
        { key: 'externalDisplayName', getLabel: () => t('accountThirdList.columns.externalDisplayName'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.externalDisplayName ?? '') },
        { key: 'externalEmail', getLabel: () => t('accountThirdList.columns.externalEmail'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.externalEmail ?? '') },
        { key: 'lastLoginTime', getLabel: () => t('accountThirdList.columns.lastLoginTime'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.lastLoginTime) },
        { key: 'active', getLabel: () => t('accountThirdList.columns.active'), sortable: false, getCellText: () => '' },
      ],
    });

    return {
      listPage, OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state), ...toRefs(listPage),
      t, listLayoutRefs, tableRef, onTableWrapMounted,
      visibleColumnKeys, columnVisibilityOptions, isColumnVisible, columnWidths,
      formVisible, formRid, hasFormEverOpened, onFormClose, onFormResponse, handleFormSaved,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.account-third-list-page .list-page-toolbar .toolbar-user-id,
.account-third-list-page .list-page-toolbar .toolbar-provider,
.account-third-list-page .list-page-toolbar .toolbar-subject { margin-right: 8px; }
.account-third-list-page .list-page-toolbar .toolbar-user-id .search-name-input,
.account-third-list-page .list-page-toolbar .toolbar-provider .search-name-input,
.account-third-list-page .list-page-toolbar .toolbar-subject .search-name-input { width: 100%; min-width: 0; box-sizing: border-box; }
.account-third-list-page .list-page-toolbar .toolbar-user-id :deep(.el-input__wrapper),
.account-third-list-page .list-page-toolbar .toolbar-provider :deep(.el-input__wrapper),
.account-third-list-page .list-page-toolbar .toolbar-subject :deep(.el-input__wrapper) { min-width: 0; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table__fixed-left) { width: 249px !important; max-width: 249px !important; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
