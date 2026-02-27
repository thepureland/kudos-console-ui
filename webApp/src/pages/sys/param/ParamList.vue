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
            v-model="searchParams.module"
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
          <el-button type="primary" round @click="search">{{ t('paramList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields">{{ t('paramList.actions.reset') }}</el-button>
          <el-button type="success" @click="openAddDialog">{{ t('paramList.actions.add') }}</el-button>
          <el-button type="danger" @click="multiDelete">{{ t('paramList.actions.delete') }}</el-button>
        </div>
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
          <el-table-column v-if="isColumnVisible('index')" type="index" width="50" fixed="left" class-name="col-fixed-index" />
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
            min-width="140"
          />
          <el-table-column
            v-if="isColumnVisible('defaultValue')"
            :label="t('paramList.columns.defaultValue')"
            prop="defaultValue"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible('module')"
            :label="t('paramList.columns.module')"
            prop="module"
            min-width="100"
            sortable="custom"
          >
            <template #default="scope">
              {{ transAtomicService(scope.row.module) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('seqNo')"
            :label="t('paramList.columns.seqNo')"
            prop="seqNo"
            width="80"
            sortable="custom"
          />
          <el-table-column
            v-if="isColumnVisible('remark')"
            :label="t('paramList.columns.remark')"
            prop="remark"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('active')"
            :label="t('paramList.columns.active')"
            prop="active"
            width="80"
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
            width="140"
            min-width="140"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('paramList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('paramList.actions.edit')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('paramList.actions.delete')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('paramList.actions.detail')" placement="top">
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

    <param-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <param-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <param-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, Delete, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ParamAddEdit from './ParamAddEdit.vue';
import ParamDetail from './ParamDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';

class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        module: null as string | null,
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
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'paramList.operationColumnPinned';
const PARAM_LIST_STATE_STORAGE_KEY = 'paramList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'paramList.visibleColumns';
/** 可配置可见性的列（顺序列、备注列等）；paramName 固定左侧不参与 */
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['paramValue', 'defaultValue', 'module', 'seqNo', 'remark', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 120;

export default defineComponent({
  name: 'ParamList',
  components: {
    ParamAddEdit,
    ParamDetail,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(PARAM_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    const listLayoutRefs = { tableWrapRef, paginationRef };
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);

    const columnKeyToLabel: Record<string, () => string> = {
      paramValue: () => t('paramList.columns.paramValue'),
      defaultValue: () => t('paramList.columns.defaultValue'),
      module: () => t('paramList.columns.module'),
      seqNo: () => t('paramList.columns.seqNo'),
      remark: () => t('paramList.columns.remark'),
      active: () => t('paramList.columns.active'),
    };
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('paramList.columns.index') },
      ...ALL_COLUMN_KEYS.map((key) => ({ key, label: columnKeyToLabel[key]?.() ?? key })),
    ]);
    const visibleColumnKeys = computed<string[]>({
      get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    function forceFixedLeftWidth() {
      nextTick(() => {
        tableRef.value?.doLayout?.();
        nextTick(() => {
          const wrapper = tableRef.value?.$el?.querySelector?.('.el-table__fixed-left') as HTMLElement | null;
          if (wrapper) {
            wrapper.style.setProperty('width', `${FIXED_LEFT_TOTAL_WIDTH}px`, 'important');
            wrapper.style.setProperty('max-width', `${FIXED_LEFT_TOTAL_WIDTH}px`, 'important');
          }
        });
      });
    }

    function onTableWrapMounted() {
      nextTick(updateTableMaxHeight);
    }

    onMounted(() => {
      listPage.restorePersistedListState();
      nextTick(updateTableMaxHeight);
    });
    watch(
      () => [
        (listPage.state as Record<string, unknown>).searchParams,
        (listPage.state as Record<string, unknown>).sort,
        (listPage.state as Record<string, unknown>).pagination,
        (listPage.state as Record<string, unknown>).tableData,
      ],
      () => {
        listPage.persistListState();
        nextTick(updateTableMaxHeight);
      },
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
      listLayoutRefs,
      tableRef,
      onTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
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
:deep(.el-table th.operation-column),
:deep(.el-table td.operation-column) {
  width: 140px !important;
  min-width: 140px !important;
  max-width: 140px !important;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
