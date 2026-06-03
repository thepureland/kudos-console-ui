<!--
 * Account protection list: filter by user id and active-only; table supports pagination and i18n.
 *
 * @author: K
 * @author: AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="account-protection-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('accountProtectionList.actions.showColumnPanel')"
      :column-panel-hide-text="t('accountProtectionList.actions.hideColumnPanel')"
      :operation-column-show-text="t('accountProtectionList.actions.showOperationColumn')"
      :operation-column-hide-text="t('accountProtectionList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-user-id">
          <el-input
            v-model="searchParams.userId"
            :placeholder="t('accountProtectionList.placeholders.userId')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('accountProtectionList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('accountProtectionList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('accountProtectionList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('accountProtectionList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('accountProtectionList.actions.columnVisibility') }}</div>
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
            :label="t('accountProtectionList.columns.userId')"
            prop="userId"
            min-width="160"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('question1')"
            :label="t('accountProtectionList.columns.question1')"
            prop="question1"
            :min-width="columnWidths['question1'] ?? 160"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('totalValidateCount')"
            :label="t('accountProtectionList.columns.totalValidateCount')"
            prop="totalValidateCount"
            :min-width="columnWidths['totalValidateCount'] ?? 100"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('matchQuestionCount')"
            :label="t('accountProtectionList.columns.matchQuestionCount')"
            prop="matchQuestionCount"
            :min-width="columnWidths['matchQuestionCount'] ?? 100"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('errorTimes')"
            :label="t('accountProtectionList.columns.errorTimes')"
            prop="errorTimes"
            :min-width="columnWidths['errorTimes'] ?? 90"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('createTime')"
            :label="t('accountProtectionList.columns.createTime')"
            prop="createTime"
            :min-width="columnWidths['createTime'] ?? 160"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ formatDate(scope.row.createTime) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('active')"
            :label="t('accountProtectionList.columns.active')"
            prop="active"
            :min-width="columnWidths['active'] ?? 80"
            show-overflow-tooltip
          >
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
            v-if="showOperationColumn"
            :label="t('accountProtectionList.columns.operation')"
            align="center"
            fixed="right"
            min-width="68"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('accountProtectionList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('accountProtectionList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('accountProtectionList.actions.detail')" placement="top" :enterable="false">
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

    <account-protection-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AccountProtectionDetailPage from './AccountProtectionDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class AccountProtectionListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        userId: null as string | null,
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/accountProtection';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'accountProtectionList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'accountProtectionList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['question1', 'totalValidateCount', 'matchQuestionCount', 'errorTimes', 'createTime', 'active']);
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 160;

export default defineComponent({
  name: 'AccountProtectionListPage',
  components: {
    AccountProtectionDetailPage,
    ListPageLayout,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
  },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new AccountProtectionListPage(props, context)) as AccountProtectionListPage & { state: Record<string, unknown> };
    const {
      listLayoutRefs,
      onTableWrapMounted: layoutOnTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
    } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('accountProtectionList.columns.index') : t('accountProtectionList.columns.' + key)),
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
        { key: 'question1', getLabel: () => t('accountProtectionList.columns.question1'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.question1 ?? '') },
        { key: 'totalValidateCount', getLabel: () => t('accountProtectionList.columns.totalValidateCount'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.totalValidateCount ?? '') },
        { key: 'matchQuestionCount', getLabel: () => t('accountProtectionList.columns.matchQuestionCount'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.matchQuestionCount ?? '') },
        { key: 'errorTimes', getLabel: () => t('accountProtectionList.columns.errorTimes'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.errorTimes ?? '') },
        { key: 'createTime', getLabel: () => t('accountProtectionList.columns.createTime'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.createTime) },
        { key: 'active', getLabel: () => t('accountProtectionList.columns.active'), sortable: false, getCellText: () => '' },
      ],
    });

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      listLayoutRefs,
      tableRef,
      onTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.account-protection-list-page .list-page-toolbar .toolbar-user-id {
  margin-right: 8px;
}
.account-protection-list-page .list-page-toolbar .toolbar-user-id .search-name-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.account-protection-list-page .list-page-toolbar .toolbar-user-id :deep(.el-input__wrapper) {
  min-width: 0;
}
.table-drag-drop-zone {
  flex: 1;
  min-height: 0;
}
:deep(.el-table .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 22px;
}
:deep(.el-table__row) {
  height: 32px;
}
:deep(.el-table__fixed-left) {
  width: 249px !important;
  max-width: 249px !important;
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
:deep(.el-table th.col-fixed-name),
:deep(.el-table td.col-fixed-name) {
  width: 160px !important;
  min-width: 160px !important;
  max-width: 160px !important;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
