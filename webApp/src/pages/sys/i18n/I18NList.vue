<!--
 * 国际化列表：支持按键、国际化类型、原子服务、语言、仅启用筛选，表格前 4 列（键/值/语言/国际化类型）固定，其余列可拖拽排序，支持列可见性与操作列折角，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="i18n-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('i18nList.actions.showColumnPanel')"
      :column-panel-hide-text="t('i18nList.actions.hideColumnPanel')"
      :operation-column-show-text="t('i18nList.actions.showOperationColumn')"
      :operation-column-hide-text="t('i18nList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-key">
          <el-input
            v-model="searchParams.key"
            :placeholder="t('i18nList.placeholders.key')"
            clearable
            class="search-name-input"
            @keyup="(e) => e.key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-i18n-type">
          <el-select
            v-model="searchParams.i18nTypeDictCode"
            :placeholder="t('i18nList.placeholders.i18nTypeDictCode')"
            clearable
            class="search-select-input"
            @change="search"
          >
            <el-option
              v-for="item in (listPage.state.i18nTypeDictOptions || [])"
              :key="item.first"
              :value="item.first"
              :label="t(item.second)"
            />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-atomic">
          <el-select
            v-model="searchParams.atomicServiceCode"
            :placeholder="t('i18nList.placeholders.atomicServiceCode')"
            clearable
            class="search-select-input"
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
        <div class="toolbar-cell toolbar-locale">
          <el-select
            v-model="searchParams.locale"
            :placeholder="t('i18nList.placeholders.locale')"
            clearable
            class="search-select-input"
            @change="search"
          >
            <el-option
              v-for="item in (listPage.state.localeOptions || [])"
              :key="item.first"
              :value="item.first"
              :label="item.second"
            />
          </el-select>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('i18nList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('i18nList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('i18nList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('i18nList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('i18nList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('i18nList.actions.columnVisibility') }}</div>
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
          :table-layout="tableLayout"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('i18nList.columns.key')"
            prop="key"
            sortable="custom"
            min-width="180"
            fixed="left"
            class-name="col-fixed-key"
          />
          <el-table-column
            :label="t('i18nList.columns.value')"
            prop="value"
            min-width="200"
            fixed="left"
            class-name="col-fixed-value"
          />
          <el-table-column
            :label="t('i18nList.columns.locale')"
            prop="locale"
            sortable="custom"
            min-width="100"
            fixed="left"
            class-name="col-fixed-locale"
          />
          <el-table-column
            :label="t('i18nList.columns.i18nTypeDictCode')"
            prop="i18nTypeDictCode"
            min-width="140"
            fixed="left"
            class-name="col-fixed-i18nType"
          >
            <template #default="scope">
              {{ (() => {
                const code = scope.row.i18nTypeDictCode;
                if (!code) return '';
                const opts = (listPage.state.i18nTypeDictOptions || []) as Array<{ first: string; second: string }>;
                const item = opts.find(o => o.first === code);
                return item ? t(item.second) : code;
              })() }}
            </template>
          </el-table-column>
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'atomicServiceCode' && isColumnVisible('atomicServiceCode')"
              prop="atomicServiceCode"
              :min-width="columnWidths['atomicServiceCode'] ?? 120"
              sortable="custom"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="atomicServiceCode"
                  :class="{ 'is-dragging': columnDragKey === 'atomicServiceCode', 'is-drop-target': columnDropTargetKey === 'atomicServiceCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'atomicServiceCode')"
                  @dragover="onHeaderDragOver($event, 'atomicServiceCode')"
                  @drop="onHeaderDrop($event, 'atomicServiceCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('i18nList.columns.atomicServiceCode') }}</div>
              </template>
              <template #default="scope">
                {{ transAtomicService(scope.row.atomicServiceCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              prop="active"
              :min-width="columnWidths['active'] ?? 80"
              sortable="custom"
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
                >{{ t('i18nList.columns.active') }}</div>
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
            <el-table-column
              v-else-if="key === 'builtIn' && isColumnVisible('builtIn')"
              prop="builtIn"
              :min-width="columnWidths['builtIn'] ?? 80"
              sortable="custom"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="builtIn"
                  :class="{ 'is-dragging': columnDragKey === 'builtIn', 'is-drop-target': columnDropTargetKey === 'builtIn' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'builtIn')"
                  @dragover="onHeaderDragOver($event, 'builtIn')"
                  @drop="onHeaderDrop($event, 'builtIn')"
                  @dragend="onHeaderDragEnd"
                >{{ t('i18nList.columns.builtIn') }}</div>
              </template>
              <template #default="scope">
                {{ formatBoolText(scope.row.builtIn) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('i18nList.columns.operation')"
            align="center"
              fixed="right"
              min-width="180"
              class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('i18nList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('i18nList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('i18nList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('i18nList.actions.detail')" placement="top" :enterable="false">
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
    <I18NDetail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { Pair } from '../../../components/model/Pair';
import I18NDetail from './I18NDetail.vue';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'i18nList.operationColumnPinned';
const I18N_LIST_STATE_STORAGE_KEY = 'i18nList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'i18nList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'i18nList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['atomicServiceCode', 'active', 'builtIn'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadAtomicServices();
    this.loadDicts([
      new Pair('kuark:sys', 'locale'),
      new Pair('kuark:sys', 'i18n_type'),
    ]).then(() => {
      (this.state as Record<string, unknown>).localeOptions = this.getDictItems('kuark:sys', 'locale') as Array<{ first: string; second: string }>;
      (this.state as Record<string, unknown>).i18nTypeDictOptions = this.getDictItems('kuark:sys', 'i18n_type') as Array<{ first: string; second: string }>;
    });
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        key: null as string | null,
        i18nTypeDictCode: null as string | null,
        atomicServiceCode: null as string | null,
        locale: null as string | null,
        active: true,
      },
      /** 语言(locale)下拉选项（响应式，loadDicts 完成后更新） */
      localeOptions: [] as Array<{ first: string; second: string }>,
      /** 国际化类型下拉选项（响应式，second 为 i18n key，需用 t() 显示） */
      i18nTypeDictOptions: [] as Array<{ first: string; second: string }>,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/i18n';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.key = sp.key ?? null;
    params.i18nTypeDictCode = sp.i18nTypeDictCode ?? null;
    params.atomicServiceCode = sp.atomicServiceCode ?? null;
    params.locale = sp.locale ?? null;
    params.active = sp.active === true ? true : null;
    return params;
  }
}

export default defineComponent({
  name: 'I18NList',
  components: { ListPageLayout, I18NDetail, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
      stateStorageKey: I18N_LIST_STATE_STORAGE_KEY,
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);

    const FIXED_LEFT_BASE = 39 + 180 + 200 + 100 + 140;
    const FIXED_LEFT_WITH_INDEX = FIXED_LEFT_BASE + 50;
    function forceFixedLeftWidth() {
      nextTick(() => {
        tableRef.value?.doLayout?.();
        nextTick(() => {
          const wrapper = tableRef.value?.$el?.querySelector?.('.el-table__fixed-left') as HTMLElement | null;
          if (wrapper) {
            const w = listPage.isColumnVisible('index') ? FIXED_LEFT_WITH_INDEX : FIXED_LEFT_BASE;
            wrapper.style.setProperty('width', `${w}px`, 'important');
            wrapper.style.setProperty('max-width', `${w}px`, 'important');
          }
        });
      });
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
    });

    const RESERVED_WIDTH_LEFT = 39 + 50 + 180 + 200 + 100 + 140;
    const RESERVED_WIDTH_RIGHT = 140;
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => t('i18nList.columns.' + key),
        sortable: key === 'atomicServiceCode',
        getCellText:
          key === 'atomicServiceCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.atomicServiceCode)
            : key === 'builtIn'
              ? (row: Record<string, unknown>) => listPage.formatBoolean(row.builtIn, t('i18nList.common.yes'), t('i18nList.common.no'))
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

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('i18nList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('i18nList.columns.' + key),
      })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    function formatBoolText(value: unknown): string {
      return listPage.formatBoolean(value, t('i18nList.common.yes'), t('i18nList.common.no'));
    }

    watch(
      () => listPage.state.visibleColumnKeys,
      () => nextTick(forceFixedLeftWidth),
      { deep: true },
    );
    watch(
      () => listPage.state.showOperationColumn,
      () => nextTick(forceFixedLeftWidth),
    );

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      formatBoolText,
      listLayoutRefs,
      tableRef,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
      onTableWrapMounted,
      orderedColumnKeys,
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
.i18n-list-page .list-page-toolbar .toolbar-cell.toolbar-key,
.i18n-list-page .list-page-toolbar .toolbar-cell.toolbar-i18n-type,
.i18n-list-page .list-page-toolbar .toolbar-cell.toolbar-atomic,
.i18n-list-page .list-page-toolbar .toolbar-cell.toolbar-locale {
  margin-right: 8px;
}
.i18n-list-page .list-page-toolbar .toolbar-key .search-name-input,
.i18n-list-page .list-page-toolbar .toolbar-i18n-type .search-select-input,
.i18n-list-page .list-page-toolbar .toolbar-locale .search-select-input,
.i18n-list-page .list-page-toolbar .toolbar-atomic .search-select-input {
  width: 100%;
  min-width: 0;
}
.i18n-list-page .list-page-toolbar .toolbar-atomic :deep(.el-input__wrapper),
.i18n-list-page .list-page-toolbar .toolbar-locale :deep(.el-input__wrapper),
.i18n-list-page .list-page-toolbar .toolbar-i18n-type :deep(.el-input__wrapper) {
  min-width: 0;
}
.table-drag-drop-zone {
  flex: 1;
  min-height: 0;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
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
:deep(.el-table th.col-fixed-key),
:deep(.el-table td.col-fixed-key) {
  width: 180px !important;
  min-width: 180px !important;
  max-width: 180px !important;
}
:deep(.el-table th.col-fixed-value),
:deep(.el-table td.col-fixed-value) {
  width: 200px !important;
  min-width: 200px !important;
  max-width: 200px !important;
}
:deep(.el-table th.col-fixed-locale),
:deep(.el-table td.col-fixed-locale) {
  width: 100px !important;
  min-width: 100px !important;
  max-width: 100px !important;
}
:deep(.el-table th.col-fixed-i18nType),
:deep(.el-table td.col-fixed-i18nType) {
  width: 140px !important;
  min-width: 140px !important;
  max-width: 140px !important;
}
:deep(.el-table th.operation-column),
:deep(.el-table td.operation-column) {
  width: 180px !important;
  min-width: 180px !important;
  max-width: 180px !important;
}
:deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
:deep(.column-header-draggable:active) {
  cursor: grabbing;
}
:deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
:deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
:deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
:deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
:deep(th .cell:has(.column-header-draggable) .el-table__column-filter-trigger),
:deep(th .cell:has(.column-header-draggable) .el-table__sort-icon),
:deep(th .cell:has(.column-header-draggable) .caret-wrapper) {
  display: none !important;
}
</style>
