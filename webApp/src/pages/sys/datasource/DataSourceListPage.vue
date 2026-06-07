<!--
 * Data source list: supports filtering by name, subsystem/tenant, microservice, and active-only; the table supports column visibility, drag-to-reorder column headers, operation-column fold, pagination, and i18n.
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="data-source-list-page list-page-common">
    <!-- List-page layout: toolbar + table area (column visibility/operation-column fold) + pagination -->
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('dataSourceList.actions.showColumnPanel')"
      :column-panel-hide-text="t('dataSourceList.actions.hideColumnPanel')"
      :operation-column-show-text="t('dataSourceList.actions.showOperationColumn')"
      :operation-column-hide-text="t('dataSourceList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <!-- Toolbar: layout provided by ListPageLayout + list-page-common; only slot content here -->
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <div class="search-name-input-wrap" :style="{ width: nameInputWidth + 'px' }">
            <span ref="nameInputMirrorRef" class="search-name-input-mirror">{{ searchParams.name || namePlaceholder }}</span>
            <el-input
              v-model="searchParams.name"
              :placeholder="namePlaceholder"
              clearable
              class="search-name-input"
              @keyup="(e) => e.key === 'Enter' && search()"
              @input="updateNameInputWidth"
              @change="search"
            />
          </div>
        </div>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants"
            :props="cascaderProps"
            :placeholder="t('dataSourceList.placeholders.subSysOrTenant')"
            clearable
            class="subsys-tenant-cascader"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-microservice">
          <el-tree-select
            v-model="searchParams.microServiceCode"
            :data="microserviceTree"
            :placeholder="t('dataSourceList.placeholders.microservice')"
            clearable
            filterable
            :render-after-expand="false"
            default-expand-all
            class="microservice-select"
            style="width: 100%"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('dataSourceList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('dataSourceList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('dataSourceList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('dataSourceList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('dataSourceList.actions.delete') }}
        </el-button>
      </template>
      <!-- Column visibility panel: checkboxes control each column's show/hide (column order is adjusted by dragging the headers) -->
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('dataSourceList.actions.columnVisibility') }}</div>
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
      <!-- Data source table: selection/index/name (fixed left) + subsystem/tenant/URL/username/active (sortable, hideable) + operation column -->
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
          :table-layout="tableLayout"
          :header-cell-style="{ textAlign: 'center' }"
          row-key="id"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('dataSourceList.columns.name')" prop="name" min-width="120" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSystemCode' && isColumnVisible('subSystemCode')"
              prop="subSystemCode"
              :min-width="columnWidths['subSystemCode'] ?? 120"
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
                >{{ t('dataSourceList.columns.subSys') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSystemCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'tenantName' && isColumnVisible('tenantName')"
              prop="tenantName"
              :min-width="columnWidths['tenantName'] ?? 120"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="tenantName"
                  :class="{ 'is-dragging': columnDragKey === 'tenantName', 'is-drop-target': columnDropTargetKey === 'tenantName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'tenantName')"
                  @dragover="onHeaderDragOver($event, 'tenantName')"
                  @drop="onHeaderDrop($event, 'tenantName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('dataSourceList.columns.tenantName') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'microservice' && isColumnVisible('microservice')"
              prop="microservice"
              :min-width="columnWidths['microservice'] ?? 120"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="microservice"
                  :class="{ 'is-dragging': columnDragKey === 'microservice', 'is-drop-target': columnDropTargetKey === 'microservice' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'microservice')"
                  @dragover="onHeaderDragOver($event, 'microservice')"
                  @drop="onHeaderDrop($event, 'microservice')"
                  @dragend="onHeaderDragEnd"
                >{{ t('dataSourceList.columns.microservice') }}</div>
              </template>
              <template #default="scope">
                {{ getMicroserviceDisplayText(scope.row) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'url' && isColumnVisible('url')"
              prop="url"
              :min-width="columnWidths['url'] ?? 180"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="url"
                  :class="{ 'is-dragging': columnDragKey === 'url', 'is-drop-target': columnDropTargetKey === 'url' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'url')"
                  @dragover="onHeaderDragOver($event, 'url')"
                  @drop="onHeaderDrop($event, 'url')"
                  @dragend="onHeaderDragEnd"
                >{{ t('dataSourceList.columns.url') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'username' && isColumnVisible('username')"
              prop="username"
              :min-width="columnWidths['username'] ?? 120"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="username"
                  :class="{ 'is-dragging': columnDragKey === 'username', 'is-drop-target': columnDropTargetKey === 'username' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'username')"
                  @dragover="onHeaderDragOver($event, 'username')"
                  @drop="onHeaderDrop($event, 'username')"
                  @dragend="onHeaderDragEnd"
                >{{ t('dataSourceList.columns.username') }}</div>
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
                >{{ t('dataSourceList.columns.active') }}</div>
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
          </template>
        <el-table-column
          v-if="showOperationColumn"
          :label="t('dataSourceList.columns.operation')"
          align="center"
          fixed="right"
          min-width="180"
          class-name="operation-column"
          label-class-name="operation-column"
        >
          <template #header>
            <div class="operation-column-hover-area">{{ t('dataSourceList.columns.operation') }}</div>
          </template>
          <template #default="scope">
            <div class="operation-column-hover-area">
              <el-tooltip :content="t('dataSourceList.actions.edit')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                  <Edit />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('dataSourceList.actions.delete')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                  <Delete />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('dataSourceList.actions.detail')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                  <Tickets />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('dataSourceList.actions.resetPassword')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="resetPassword(scope.row)">
                  <Lock />
                </el-icon>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>
      <!-- Pagination -->
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

    <!-- Reset-password dialog -->
    <el-dialog v-model="passwordDialogVisible" :title="t('dataSourceList.dialog.passwordTitle')" min-width="20%">
      <el-input v-model="newPassword" type="password" :placeholder="t('dataSourceList.placeholders.newPassword')" show-password />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="passwordDialogVisible = false; newPassword = null">{{ t('dataSourceList.common.cancel') }}</el-button>
          <el-button type="primary" @click="commitNewPassword(newPassword)">{{ t('dataSourceList.common.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Add and Edit share one form; mount on first open of either; the v-if/v-show is on a plain div to avoid the ElDialog non-element-root directive warning -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <data-source-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <data-source-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, Edit, Lock, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import DataSourceFormPage from './DataSourceFormPage.vue';
import DataSourceDetailPage from './DataSourceDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { Pair } from '../../../components/model/Pair';
import { backendRequest, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState, useColumnVisibilityOptions, useVisibleColumnKeys, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, createI18nColumnLabelGetter, useColumnOrderDrag } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import { useMicroserviceTreeOptions } from '../../../components/pages/integration';
import { ListPageLayout } from '../../../components/pages/ui';

/** Data-source list-page business logic: extends the tenant-support list; supports search, password reset, and test-data fallback. The tenant dropdown is two-level cascading: level 1 subsystems (getAllActiveSubSystemCodes), level 2 tenants (getTenantsBySubSystemCode). */
class DataSourceListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  /** Level 1 uses the subsystem API; level 2 loads tenants per subsystem */
  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  /** Only allow selecting level 2 (tenant); selecting only level 1 (subsystem) is not allowed */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null as string | null,
        microServiceCode: null as string | null,
        active: true,
        // subSysOrTenant is injected by TenantSupportListPage.initTenantVars in the constructor
      },
      passwordDialogVisible: false,
      newPassword: null as string | null,
      currentRow: null as Record<string, unknown> | null,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/dataSource';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      // Send `true` only when the checkbox is explicitly checked; send `null` (no filter) otherwise.
      // Strict `=== true` avoids sending the string "true" if the value is ever coerced.
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
      (params as Record<string, unknown>).microServiceCode = sp.microServiceCode ?? null;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name'];
  }

  /** Open the reset-password dialog */
  resetPassword(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.passwordDialogVisible = true;
  }

  /** Submit the new password to the backend and close the dialog */
  commitNewPassword(newPassword: string | null): void {
    this.doCommitNewPassword(newPassword);
  }

  private async doCommitNewPassword(newPassword: string | null): Promise<void> {
    const state = this.state as Record<string, unknown>;
    state.passwordDialogVisible = false;
    const row = state.currentRow as Record<string, unknown>;
    if (!row) return;
    const params = { id: row.id, password: newPassword };
    const url = 'sys/dataSource/resetPassword';
    try {
      const result = await backendRequest({ url, params });
      if (isApiSuccessResponse(result)) {
        ElMessage.info(this.tr('dataSourceList.messages.resetPasswordSuccess'));
      } else {
        ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('dataSourceList.messages.resetPasswordFailed'));
      }
    } catch {
      ElMessage.error(this.tr('dataSourceList.messages.resetPasswordFailed'));
    }
  }

}

/** Dynamic width = mirror text width + slack; never below MIN so the input doesn't get too narrow (roughly matches the original 200px toolbar cell) */
const NAME_INPUT_PADDING = 48;
const NAME_INPUT_MIN_WIDTH = 240;
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'dataSourceList.operationColumnPinned';
const DATA_SOURCE_LIST_STATE_STORAGE_KEY = 'dataSourceList.queryState.v2';
const COLUMN_VISIBILITY_STORAGE_KEY = 'dataSourceList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'dataSourceList.columnOrder.v2';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['subSystemCode', 'tenantName', 'microservice', 'url', 'username', 'active']);

export default defineComponent({
  name: 'DataSourceListPage',
  components: {
    DataSourceFormPage,
    DataSourceDetailPage,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Lock,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new DataSourceListPage(props, context)) as DataSourceListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const state = listPage.state as Record<string, unknown>;
    const {
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
    } = useListPageFormSetup({ state, listPage });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const nameInputMirrorRef = ref<HTMLElement | null>(null);
    const nameInputWidth = ref(NAME_INPUT_MIN_WIDTH);
    const namePlaceholder = computed(() => t('dataSourceList.placeholders.name'));
    function updateNameInputWidth() {
      nextTick(() => {
        const el = nameInputMirrorRef.value;
        if (!el) return;
        nameInputWidth.value = Math.max(NAME_INPUT_MIN_WIDTH, el.offsetWidth + NAME_INPUT_PADDING);
      });
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
      onAfterMount: updateNameInputWidth,
      onAfterPersist: updateNameInputWidth,
    });
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    /**
     * Keep 'microservice' immediately after 'tenantName' when both are present.
     * This constraint exists because microservice records belong to a tenant, so
     * displaying them adjacent makes the relationship obvious. If 'tenantName' is
     * hidden or absent the order is left unchanged.
     */
    function normalizeColumnOrder(order: string[]): string[] {
      const tenantIdx = order.indexOf('tenantName');
      const microIdx = order.indexOf('microservice');
      if (tenantIdx !== -1 && microIdx !== -1 && microIdx !== tenantIdx + 1) {
        const next = order.filter((k) => k !== 'microservice');
        next.splice(tenantIdx + 1, 0, 'microservice');
        return next;
      }
      return order;
    }
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
      normalizeOrder: normalizeColumnOrder,
    });
    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    /** Microservice tree (for the dropdown) and flat options (for the table's code -> name mapping) */
    const { microserviceTree, microserviceOptions } = useMicroserviceTreeOptions({ includeFlatOptions: true });
    /** Microservice column display in the table: tolerates several backend fields and microservice shapes; prefers the option label */
    function getMicroserviceDisplayText(row: Record<string, unknown>): string {
      const raw = row.microservice ?? row.microserviceCode ?? row.microServiceCode;
      const code = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' && 'code' in raw ? (raw as { code: string }).code : null);
      if (code == null || code === '') return '—';
      const label = microserviceOptions.value.find((o) => o.value === code)?.label;
      return label ?? code;
    }
    const columnLabel = createI18nColumnLabelGetter(t, 'dataSourceList.columns', { subSystemCode: 'subSys' });
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('dataSourceList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: columnLabel,
    });
    // Only `columnWidths` is needed here; the other returned values (RESERVED_WIDTH_LEFT,
    // RESERVED_WIDTH_RIGHT, autoWidthColumns, tableDataRef) are unused in this component.
    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 39 + 50 + 120,
      reservedWidthRight: 140,
      createAutoWidthColumns: () =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnLabel(key),
        sortable: false,
        getCellText:
          key === 'subSystemCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSystemCode)
            : key === 'tenantName'
              ? (row: Record<string, unknown>) => String(row.tenantName ?? '')
              : key === 'microservice'
                ? (row: Record<string, unknown>) => getMicroserviceDisplayText(row)
                : key === 'url'
                  ? (row: Record<string, unknown>) => String(row.url ?? '')
                  : key === 'username'
                    ? (row: Record<string, unknown>) => String(row.username ?? '')
                    : () => '',
      }))
    });
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
      resetPassword: listPage.resetPassword.bind(listPage),
      commitNewPassword: listPage.commitNewPassword.bind(listPage),
      nameInputMirrorRef,
      nameInputWidth,
      namePlaceholder,
      updateNameInputWidth,
      microserviceOptions,
      microserviceTree,
      getMicroserviceDisplayText,
      listLayoutRefs,
      tableRef,
      columnWidths,
      orderedColumnKeys,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      onTableWrapMounted,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
/*
 * Data-source search bar: the per-cell margin-right values from list-page-common (name 4px, cascade/microservice 2px, extra 4px) stack up so the middle cells visually appear "increasingly spaced".
 * Replace those with a uniform toolbar gap and zero out child left/right margins; the buttons follow "Active only" directly (no more margin-left:auto).
 */
.data-source-list-page :deep(.list-page-toolbar) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: flex-start;
}
.data-source-list-page :deep(.list-page-toolbar > .toolbar-cell),
.data-source-list-page :deep(.list-page-toolbar > .toolbar-extra),
.data-source-list-page :deep(.list-page-toolbar > .toolbar-buttons) {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.data-source-list-page :deep(.list-page-toolbar > .toolbar-buttons) {
  min-width: 0 !important;
  flex: 0 0 auto;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-cell) {
  flex: 0 0 auto !important;
  max-width: none !important;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-name) {
  flex-shrink: 0;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-cascader),
.data-source-list-page :deep(.list-page-toolbar .toolbar-microservice) {
  min-width: 0;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-cascader) {
  flex: 0 0 200px;
  width: 200px;
  max-width: min(200px, 42vw);
  box-sizing: border-box;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-microservice) {
  flex: 0 0 200px;
  width: 200px;
  max-width: min(200px, 42vw);
  box-sizing: border-box;
}
.data-source-list-page :deep(.list-page-toolbar .toolbar-cascader .subsys-tenant-cascader),
.data-source-list-page :deep(.list-page-toolbar .toolbar-microservice .microservice-select) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100%;
}
.col-subsys-microservice {
  display: flex;
  align-items: center;
  gap: 10px;
}
.col-subsys-microservice .subsys-tenant-cascader {
  flex: 1;
  min-width: 220px;
}
.col-subsys-microservice .microservice-select {
  min-width: 160px;
  flex: 0 1 220px;
}
.col-subsys-microservice .active-only-checkbox {
  flex-shrink: 0;
  margin-right: 0;
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
  width: 209px !important;
  max-width: 209px !important;
}
:deep(.el-table__fixed-left .el-table__fixed-body-wrapper) {
  width: 209px !important;
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
  min-width: 120px !important;
}
:deep(.el-table th.operation-column),
:deep(.el-table td.operation-column) {
  min-width: 180px !important;
}
:deep(th .cell:has(.column-header-draggable) .el-table__column-filter-trigger),
:deep(th .cell:has(.column-header-draggable) .el-table__column-sort),
:deep(th .cell:has(.column-header-draggable) .caret-wrapper),
:deep(th .cell:has(.column-header-draggable) .el-table__sort-icon) {
  display: none !important;
}
:deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
:deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
:deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
}
:deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
}
:deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
:deep(.operate-column-icon) {
  cursor: pointer;
  vertical-align: middle;
  margin-right: 6px;
}
:deep(.operation-column-hover-area) {
  width: 100%;
  height: 100%;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
