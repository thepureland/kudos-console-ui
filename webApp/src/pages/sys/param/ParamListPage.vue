<!--
 * 参数列表：支持按模块、参数名、参数值、仅启用筛选，表格支持分页，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="param-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('paramList.actions.showColumnPanel')"
      :column-panel-hide-text="t('paramList.actions.hideColumnPanel')"
      :operation-column-show-text="t('paramList.actions.showOperationColumn')"
      :operation-column-hide-text="t('paramList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <!-- 工具栏：布局由 ListPageLayout + list-page-common 提供 -->
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <el-select
            v-model="searchParams.atomicServiceCode"
            :placeholder="t('paramList.placeholders.module')"
            class="search-name-input"
            clearable
            filterable
            @change="search"
          >
            <el-option
              v-for="item in getAtomicServices()"
              :key="item.code"
              :value="item.code"
              :label="item.name"
            />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-param-name">
          <el-input
            v-model="searchParams.paramName"
            :placeholder="t('paramList.placeholders.paramName')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-param-value">
          <el-input
            v-model="searchParams.paramValue"
            :placeholder="t('paramList.placeholders.paramValue')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('paramList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('paramList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('paramList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('paramList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('paramList.actions.delete') }}
        </el-button>
      </template>
      <!-- 栏位可见性面板：含顺序列、备注列等可勾选 -->
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('paramList.actions.columnVisibility') }}</div>
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
      <!-- 参数表格 -->
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
            :label="t('paramList.columns.paramName')"
            prop="paramName"
            min-width="120"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name"
          />
          <el-table-column
            v-if="isColumnVisible('paramValue')"
            :label="t('paramList.columns.paramValue')"
            prop="paramValue"
            :min-width="columnWidths['paramValue'] ?? 140"
          />
          <el-table-column
            v-if="isColumnVisible('defaultValue')"
            :label="t('paramList.columns.defaultValue')"
            prop="defaultValue"
            :min-width="columnWidths['defaultValue'] ?? 120"
          />
          <el-table-column
            v-if="isColumnVisible('atomicServiceCode')"
            :label="t('paramList.columns.atomicServiceCode')"
            prop="atomicServiceCode"
            :min-width="columnWidths['atomicServiceCode'] ?? 100"
            sortable="custom"
          >
            <template #default="scope">
              {{ transAtomicService(scope.row.atomicServiceCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('orderNum')"
            :label="t('paramList.columns.orderNum')"
            prop="orderNum"
            :min-width="columnWidths['orderNum'] ?? 80"
            sortable="custom"
          />
          <el-table-column
            v-if="isColumnVisible('remark')"
            :label="t('paramList.columns.remark')"
            prop="remark"
            :min-width="columnWidths['remark'] ?? 120"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('active')"
            :label="t('paramList.columns.active')"
            prop="active"
            :min-width="columnWidths['active'] ?? 80"
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
            :label="t('paramList.columns.operation')"
            align="center"
            fixed="right"
            min-width="160"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('paramList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('paramList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('paramList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('paramList.actions.detail')" placement="top" :enterable="false">
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

    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <param-form-page
        :model-value="formVisible"
        :rid="formRid"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <param-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch, provide } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ParamFormPage from './ParamFormPage.vue';
import ParamDetailPage from './ParamDetailPage.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useFixedLeftTableWidth } from '../../../components/pages/useFixedLeftTableWidth';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';

class ParamListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        atomicServiceCode: null as string | null,
        paramName: null as string | null,
        paramValue: null as string | null,
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/param';
  }

  /** 仅当勾选「仅启用」时传 active=true；不勾选时传 null */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['atomicServiceCode', 'paramName', 'paramValue'];
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'paramList.operationColumnPinned';
const PARAM_LIST_STATE_STORAGE_KEY = 'paramList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'paramList.visibleColumns';
/** 可配置可见性的列（顺序列、备注列等）；paramName 固定左侧不参与 */
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['paramValue', 'defaultValue', 'atomicServiceCode', 'orderNum', 'remark', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;
const RESERVED_WIDTH_LEFT = 39 + 50 + 120;
const RESERVED_WIDTH_RIGHT = 140;

export default defineComponent({
  name: 'ParamListPage',
  components: {
    ParamFormPage,
    ParamDetailPage,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t } = useI18n();
    const listPage = reactive(new ParamListPage(props, context)) as ParamListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const formVisible = computed(() => !!(state.addDialogVisible || state.editDialogVisible));
    const formRid = computed(() => (state.editDialogVisible ? String(state.rid ?? '') : ''));
    const hasFormEverOpened = ref(false);
    watch(formVisible, (v) => { if (v) hasFormEverOpened.value = true; }, { immediate: true });
    const currentFormMode = ref<'add' | 'edit'>('add');
    watch(() => state.addDialogVisible, (v) => { if (v) currentFormMode.value = 'add'; }, { immediate: true });
    watch(() => state.editDialogVisible, (v) => { if (v) currentFormMode.value = 'edit'; }, { immediate: true });
    function onFormClose(v: boolean) {
      if (!v) { state.addDialogVisible = false; state.editDialogVisible = false; }
    }
    function onFormResponse(payload: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, payload);
    }
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }
    const {
      listLayoutRefs,
      onTableWrapMounted: layoutOnTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
    } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('paramList.columns.index') : t('paramList.columns.' + key)),
      },
    });

    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);

    const autoWidthColumns = computed(() => [
      { key: 'paramValue', getLabel: () => t('paramList.columns.paramValue'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.paramValue ?? '') },
      { key: 'defaultValue', getLabel: () => t('paramList.columns.defaultValue'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.defaultValue ?? '') },
      { key: 'atomicServiceCode', getLabel: () => t('paramList.columns.atomicServiceCode'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.transAtomicService(row.atomicServiceCode) },
      { key: 'orderNum', getLabel: () => t('paramList.columns.orderNum'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.orderNum ?? '') },
      { key: 'remark', getLabel: () => t('paramList.columns.remark'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.remark ?? '') },
      { key: 'active', getLabel: () => t('paramList.columns.active'), sortable: false, getCellText: () => '' },
    ]);
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

    watch(
      () => (listPage.state as Record<string, unknown>).showOperationColumn,
      () => nextTick(forceFixedLeftWidth),
    );

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
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
      handleFormSaved,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.param-list-page .list-page-toolbar .toolbar-param-name,
.param-list-page .list-page-toolbar .toolbar-param-value {
  margin-right: 8px;
}
.param-list-page .list-page-toolbar .toolbar-name .search-name-input,
.param-list-page .list-page-toolbar .toolbar-param-name .search-name-input,
.param-list-page .list-page-toolbar .toolbar-param-value .search-name-input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.param-list-page .list-page-toolbar .toolbar-name :deep(.el-input__wrapper),
.param-list-page .list-page-toolbar .toolbar-param-name :deep(.el-input__wrapper),
.param-list-page .list-page-toolbar .toolbar-param-value :deep(.el-input__wrapper) {
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
  width: 120px !important;
  min-width: 120px !important;
  max-width: 120px !important;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
