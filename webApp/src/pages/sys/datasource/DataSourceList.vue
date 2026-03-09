<!--
 * 数据源列表：支持按名称、子系统/租户、微服务、仅启用筛选，表格支持栏位可见性、表头拖拽列顺序、操作列折角、分页，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="data-source-list-page list-page-common">
    <!-- 列表页布局：工具栏 + 表格区（栏位可见性/操作列折角）+ 分页 -->
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
      <!-- 工具栏：布局由 ListPageLayout + list-page-common 提供，此处仅填 slot 内容 -->
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <div class="search-name-input-wrap">
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
          <el-select
            v-model="searchParams.microserviceCode"
            :placeholder="t('dataSourceList.placeholders.microservice')"
            clearable
            filterable
            class="microservice-select"
            @change="search"
          >
            <el-option
              v-for="item in microserviceOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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
      <!-- 栏位可见性面板：勾选控制各列显示/隐藏（列顺序在表头拖拽调整） -->
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
      <!-- 数据源表格：选择/序号/名称（固定左）+ 子系统/租户/URL/用户名/启用（可排序可隐藏）+ 操作列 -->
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
          <el-table-column :label="t('dataSourceList.columns.name')" prop="name" min-width="120" fixed="left" class-name="col-fixed-name" />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'subSysDictCode' && isColumnVisible('subSysDictCode')"
              prop="subSysDictCode"
              :min-width="columnWidths['subSysDictCode'] ?? 120"
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
                >{{ t('dataSourceList.columns.subSys') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.subSysDictCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'tenantName' && isColumnVisible('tenantName')"
              prop="tenantName"
              :min-width="columnWidths['tenantName'] ?? 120"
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
      <!-- 分页 -->
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

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" :title="t('dataSourceList.dialog.passwordTitle')" min-width="20%">
      <el-input v-model="newPassword" type="password" :placeholder="t('dataSourceList.placeholders.newPassword')" show-password />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="passwordDialogVisible = false; newPassword = null">{{ t('dataSourceList.common.cancel') }}</el-button>
          <el-button type="primary" @click="commitNewPassword(newPassword)">{{ t('dataSourceList.common.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <data-source-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <data-source-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <data-source-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch, provide } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, Edit, Lock, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import DataSourceAddEdit from './DataSourceAddEdit.vue';
import DataSourceDetail from './DataSourceDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useFixedLeftTableWidth } from '../../../components/pages/useFixedLeftTableWidth';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';

/** 在非 setup 中获取 i18n 文案 */
function tr(key: string): string {
  return i18n.global.t(key) as string;
}

/** 数据源列表页业务逻辑：继承租户支持列表，支持搜索、重置密码、测试数据回退 */
class DataSourceListPage extends TenantSupportListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null as string | null,
        microserviceCode: null as string | null,
        active: true,
        // subSysOrTenant 由 TenantSupportListPage.initTenantVars 在构造函数中注入
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
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
      (params as Record<string, unknown>).microserviceCode = sp.microserviceCode ?? null;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name'];
  }

  /** 打开重置密码弹窗 */
  resetPassword(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.passwordDialogVisible = true;
  }

  /** 提交新密码到后端并关闭弹窗 */
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
      if (result != null) {
        ElMessage.info(tr('dataSourceList.messages.resetPasswordSuccess'));
      } else {
        ElMessage.error(tr('dataSourceList.messages.resetPasswordFailed'));
      }
    } catch {
      ElMessage.error(tr('dataSourceList.messages.resetPasswordFailed'));
    }
  }

}

const NAME_INPUT_PADDING = 40;
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'dataSourceList.operationColumnPinned';
const DATA_SOURCE_LIST_STATE_STORAGE_KEY = 'dataSourceList.queryState.v2';
const COLUMN_VISIBILITY_STORAGE_KEY = 'dataSourceList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'dataSourceList.columnOrder.v2';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['subSysDictCode', 'tenantName', 'microservice', 'url', 'username', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'DataSourceList',
  components: {
    DataSourceAddEdit,
    DataSourceDetail,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Lock,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t } = useI18n();
    const listPage = reactive(new DataSourceListPage(props, context)) as DataSourceListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const nameInputMirrorRef = ref<HTMLElement | null>(null);
    const nameInputWidth = ref(180);
    const namePlaceholder = computed(() => t('dataSourceList.placeholders.name'));
    function updateNameInputWidth() {
      nextTick(() => {
        const el = nameInputMirrorRef.value;
        if (!el) return;
        nameInputWidth.value = el.offsetWidth + NAME_INPUT_PADDING;
      });
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
      onAfterMount: updateNameInputWidth,
      onAfterPersist: updateNameInputWidth,
    });
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
    const visibleColumnKeys = computed<string[]>({
      get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    /** 微服务下拉选项（可与后端接口对接后替换） */
    const microserviceOptions = ref<Array<{ value: string; label: string }>>([
      { value: 'ams-sys', label: '系统服务' },
      { value: 'ams-log', label: '日志服务' },
      { value: 'ams-job', label: '任务服务' },
    ]);
    /** 表格微服务列展示：兼容多种后端字段与 microservice 展示，优先显示选项 label */
    function getMicroserviceDisplayText(row: Record<string, unknown>): string {
      const raw = row.microservice ?? row.microserviceCode ?? row.microServiceCode;
      const code = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' && 'code' in raw ? (raw as { code: string }).code : null);
      if (code == null || code === '') return '—';
      const label = microserviceOptions.value.find((o) => o.value === code)?.label;
      return label ?? code;
    }
    const columnKeyToLabel: Record<string, () => string> = {
      subSysDictCode: () => t('dataSourceList.columns.subSys'),
      tenantName: () => t('dataSourceList.columns.tenantName'),
      microservice: () => t('dataSourceList.columns.microservice'),
      url: () => t('dataSourceList.columns.url'),
      username: () => t('dataSourceList.columns.username'),
      active: () => t('dataSourceList.columns.active'),
    };
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('dataSourceList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({ key, label: columnKeyToLabel[key]?.() ?? key })),
    ]);
    const RESERVED_WIDTH_LEFT = 39 + 50 + 120;
    const RESERVED_WIDTH_RIGHT = 140;
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => columnKeyToLabel[key]?.() ?? key,
        sortable: false,
        getCellText:
          key === 'subSysDictCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSysDictCode)
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
    );
    const tableDataRef = computed(() => (listPage.state as Record<string, unknown>).tableData as Array<Record<string, unknown>>);
    const { columnWidths, run: runColumnAutoWidth } = useTableColumnAutoWidth({
      containerRef: listLayoutRefs.tableWrapRef,
      columns: autoWidthColumns,
      tableData: tableDataRef,
      reservedWidthLeft: RESERVED_WIDTH_LEFT,
      reservedWidthRight: RESERVED_WIDTH_RIGHT,
    });
    function onTableWrapMounted() {
      layoutOnTableWrapMounted();
      nextTick(runColumnAutoWidth);
    }
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    watch(
      () => (listPage.state as Record<string, unknown>).visibleColumnKeys,
      () => { nextTick(forceFixedLeftWidth); },
      { deep: true },
    );
    watch(
      () => (listPage.state as Record<string, unknown>).showOperationColumn,
      () => { nextTick(forceFixedLeftWidth); },
    );
    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
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
