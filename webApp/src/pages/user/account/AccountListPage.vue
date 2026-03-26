<!--
 * 账号列表：左侧组织机构树、右侧表格，支持按租户、用户名筛选，表格支持列可见性、操作列折角，多语言。
 *
 * @author K
 * @author AI: Cursor
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
                    min-width="160"
                    class-name="operation-column"
                >
                  <template #header>
                    <div class="operation-column-hover-area">{{ t('accountList.columns.operation') }}</div>
                  </template>
                  <template #default="scope">
                    <div class="operation-column-hover-area">
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

    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <account-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <AccountDetailPage v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AccountFormPage from './AccountFormPage.vue';
import AccountDetailPage from './AccountDetailPage.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useValidationI18nCacheProvider } from '../../../components/pages/useValidationI18nCacheProvider';
import { useListPageFormSetup } from '../../../components/pages/useListPageFormSetup';
import { useListPageVisibilityState } from '../../../components/pages/useListPageVisibilityState';
import { useColumnVisibilityOptions } from '../../../components/pages/useColumnVisibilityOptions';
import { useVisibleColumnKeys } from '../../../components/pages/useVisibleColumnKeys';
import { useTableAutoWidthContext } from '../../../components/pages/useTableAutoWidthContext';
import { createColumnVisibilityConfig } from '../../../components/pages/columnVisibilityConfig';
import { useFixedLeftTableWidth } from '../../../components/pages/useFixedLeftTableWidth';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import { Pair } from '../../../components/model/Pair';
import { ElMessage } from 'element-plus';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';

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
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadDicts(['user_status', 'user_type'], 'user');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
        return {
      searchParams: {
        username: null as string | null,
      },
      /** 左侧树当前选中节点 id，切换时重新请求表格数据 */
      selectedOrgId: null as string | null,
      defaultProps: {
        children: 'children',
        label: 'name',
      },
      organizations: [] as unknown[],
    };
  }

  /** 左侧组织机构树节点点击：更新选中组织并刷新表格 */
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

  /** 用户状态、用户类型字典项译文从后端取 */
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
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '加载组织机构树失败！');
    }
  }
}

export default defineComponent({
  name: 'AccountListPage',
  components: { AccountFormPage, AccountDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
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
    /** 字典项展示：若为 i18n key（含.）则 t(key)，否则直接显示 key 或 —，避免 t('NORMAL') 等报错 */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      if (!key) return '—';
      return key.includes('.') ? t(key) : key;
    }
    const {
      RESERVED_WIDTH_LEFT,
      RESERVED_WIDTH_RIGHT,
      autoWidthColumns,
      tableDataRef,
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 209,
      reservedWidthRight: 140,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => t('accountList.columns.' + (columnKeyToLabelKey[key] ?? key)),
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
      getColumnLabel: (key) => t('accountList.columns.' + (columnKeyToLabelKey[key] ?? key)),
    });

    function onOrgNodeClick(nodeData: { id?: string }) {
      listPage.onOrganizationNodeClick(nodeData);
    }

    function onSubSysOrTenantChange() {
      (listPage.state as Record<string, unknown>).selectedOrgId = null;
      listPage.search();
    }

    watch(
      () => listPage.state.visibleColumnKeys,
      () => nextTick(forceFixedLeftWidth),
      { deep: true }
    );
    watch(
      () => listPage.state.showOperationColumn,
      () => nextTick(forceFixedLeftWidth),
    );

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
  margin-top: 3px; /* 卡片上外边距 */
}
.account-list-card :deep(.el-card__body) {
  height: 100%;
  padding: 8px 5px 5px 5px; /* 上内边距 8px（5+3） */
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

/* 列头排序图标与文字同一行，不独占一行 */
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

/* 列可见性配置：所有列选项单列竖排 */
.account-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.account-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}
</style>
