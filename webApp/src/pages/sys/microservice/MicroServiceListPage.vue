<!--
 * 微服务列表：支持按编码、名称、仅启用、仅原子服务筛选，表格为树形结构（按 parentCode），支持列可见性、操作列折角、可拖拽排序列，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="microservice-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('microServiceList.actions.showColumnPanel')"
      :column-panel-hide-text="t('microServiceList.actions.hideColumnPanel')"
      :operation-column-show-text="t('microServiceList.actions.showOperationColumn')"
      :operation-column-hide-text="t('microServiceList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.code"
            :placeholder="t('microServiceList.placeholders.code')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-name">
          <el-input
            v-model="searchParams.name"
            :placeholder="t('microServiceList.placeholders.name')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.atomicService" class="atomic-service-only-checkbox" @change="search">
            {{ t('microServiceList.actions.atomicServiceOnly') }}
          </el-checkbox>
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('microServiceList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('microServiceList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('microServiceList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('microServiceList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('microServiceList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('microServiceList.actions.columnVisibility') }}</div>
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
          default-expand-all
          row-key="id"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('microServiceList.columns.code')"
            prop="code"
            min-width="140"
            fixed="left"
            class-name="col-fixed-code"
            show-overflow-tooltip
          />
          <el-table-column
            :label="t('microServiceList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'atomicService' && isColumnVisible('atomicService')"
              prop="atomicService"
              :min-width="columnWidths['atomicService'] ?? 110"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="atomicService"
                  :class="{ 'is-dragging': columnDragKey === 'atomicService', 'is-drop-target': columnDropTargetKey === 'atomicService' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'atomicService')"
                  @dragover="onHeaderDragOver($event, 'atomicService')"
                  @drop="onHeaderDrop($event, 'atomicService')"
                  @dragend="onHeaderDragEnd"
                >{{ t('microServiceList.columns.atomicService') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.atomicService ? t('microServiceList.common.yes') : t('microServiceList.common.no') }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'context' && isColumnVisible('context')"
              prop="context"
              :min-width="columnWidths['context'] ?? 120"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="context"
                  :class="{ 'is-dragging': columnDragKey === 'context', 'is-drop-target': columnDropTargetKey === 'context' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'context')"
                  @dragover="onHeaderDragOver($event, 'context')"
                  @drop="onHeaderDrop($event, 'context')"
                  @dragend="onHeaderDragEnd"
                >{{ t('microServiceList.columns.context') }}</div>
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
                >{{ t('microServiceList.columns.active') }}</div>
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
              show-overflow-tooltip
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
                >{{ t('microServiceList.columns.builtIn') }}</div>
              </template>
              <template #default="scope">
                {{ scope.row.builtIn ? t('microServiceList.common.yes') : t('microServiceList.common.no') }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'remark' && isColumnVisible('remark')"
              prop="remark"
              :min-width="columnWidths['remark'] ?? 140"
              show-overflow-tooltip
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="remark"
                  :class="{ 'is-dragging': columnDragKey === 'remark', 'is-drop-target': columnDropTargetKey === 'remark' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'remark')"
                  @dragover="onHeaderDragOver($event, 'remark')"
                  @drop="onHeaderDrop($event, 'remark')"
                  @dragend="onHeaderDragEnd"
                >{{ t('microServiceList.columns.remark') }}</div>
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('microServiceList.columns.operation')"
            align="center"
            min-width="120"
            fixed="right"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('microServiceList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('microServiceList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('microServiceList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('microServiceList.actions.detail')" placement="top" :enterable="false">
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
        <!-- 树列表无分页 -->
      </template>
    </list-page-layout>
    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <micro-service-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <micro-service-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch, provide } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useValidationI18nCacheProvider } from '../../../components/pages/useValidationI18nCacheProvider';
import { useListPageFormSetup } from '../../../components/pages/useListPageFormSetup';
import { useColumnVisibilityOptions } from '../../../components/pages/useColumnVisibilityOptions';
import { createColumnVisibilityConfig } from '../../../components/pages/columnVisibilityConfig';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import MicroServiceFormPage from './MicroServiceFormPage.vue';
import MicroServiceDetailPage from './MicroServiceDetailPage.vue';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'microServiceList.operationColumnPinned';
const MICROSERVICE_LIST_STATE_STORAGE_KEY = 'microServiceList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'microServiceList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'microServiceList.columnOrder';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['atomicService', 'context', 'active', 'builtIn', 'remark']);

class MicroServiceListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        code: null as string | null,
        name: null as string | null,
        active: true,
        atomicService: false,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/microService';
  }

  protected createSearchParams(): Record<string, unknown> {
    const params = super.createSearchParams() as Record<string, unknown>;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.code = sp.code ?? null;
    params.name = sp.name ?? null;
    params.active = sp.active === true ? true : null;
    params.atomicService = sp.atomicService === true ? true : null;
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['code', 'name'];
  }

  /** 将扁平列表按 parentCode 挂成树（父节点为 code === item.parentCode 的节点） */
  protected flatListToTree(flat: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!flat.length) return [];
    const list = flat.map((row) => ({ ...row, children: [] as Record<string, unknown>[] }));
    const byCode = new Map<string, Record<string, unknown>>();
    list.forEach((row) => {
      const k = row.code != null ? String(row.code) : (row.id != null ? String(row.id) : '');
      if (k !== '') byCode.set(k, row);
    });
    const roots: Record<string, unknown>[] = [];
    list.forEach((row) => {
      const parentCode = row.parentCode != null ? String(row.parentCode).trim() : '';
      if (!parentCode) {
        roots.push(row);
        return;
      }
      const parent = byCode.get(parentCode) as Record<string, unknown> | undefined;
      const children = parent?.children as Record<string, unknown>[] | undefined;
      if (parent && Array.isArray(children)) children.push(row);
      else roots.push(row);
    });
    return roots;
  }

  /** 后端返回格式：{ data: 行数组, totalCount }；扁平数据按 parentCode 转成树后赋给 tableData */
  protected postSearchSuccessfully(data: unknown): void {
    const obj = data as { data: unknown[]; totalCount: number };
    const rows = (obj.data ?? []) as Record<string, unknown>[];
    const hasChildren = rows.some((r) => Array.isArray((r as Record<string, unknown>).children));
    this.state.tableData = hasChildren ? rows : this.flatListToTree(rows);
    this.state.pagination.total = typeof obj.totalCount === 'number' ? obj.totalCount : 0;
  }
}

export default defineComponent({
  name: 'MicroServiceListPage',
  components: { ListPageLayout, MicroServiceFormPage, MicroServiceDetailPage, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new MicroServiceListPage(props, context)) as MicroServiceListPage & { state: Record<string, unknown> };
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
    const tableRef = ref<{ doLayout?: () => void } | null>(null);
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
    } = useColumnOrderDrag(COLUMN_ORDER_STORAGE_KEY, ALL_COLUMN_KEYS);

    const RESERVED_WIDTH_LEFT = 39 + 50 + 140 + 120;
    const RESERVED_WIDTH_RIGHT = 120;
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => t('microServiceList.columns.' + key),
        sortable: false,
        getCellText:
          key === 'atomicService'
            ? (row: Record<string, unknown>) => (row.atomicService ? t('microServiceList.common.yes') : t('microServiceList.common.no'))
            : key === 'context'
              ? (row: Record<string, unknown>) => String(row.context ?? '')
              : key === 'builtIn'
                ? (row: Record<string, unknown>) => (row.builtIn ? t('microServiceList.common.yes') : t('microServiceList.common.no'))
                : key === 'remark'
                  ? (row: Record<string, unknown>) => String(row.remark ?? '')
                  : () => '',
      }))
    );
    const tableDataRef = computed(() => (listPage.state as Record<string, unknown>).tableData as Array<Record<string, unknown>>);
    const columnWidths = ref<Record<string, number>>({});
    function onTableWrapMounted() {
      layoutOnTableWrapMounted();
    }

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('microServiceList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: (key) => t('microServiceList.columns.' + key),
    });
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    const showOperationColumn = computed(() => Boolean(listPage.state?.showOperationColumn));

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
      showOperationColumn,
      onTableWrapMounted,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.microservice-list-page {
  height: 100%;
}
.microservice-list-page :deep(.list-page-card) {
  margin-top: 3px; /* 卡片上外边距 */
}
.microservice-list-page .list-page-toolbar .toolbar-name {
  margin-right: 8px;
}
.microservice-list-page .list-page-toolbar .toolbar-name .search-name-input {
  min-width: 140px;
}
.microservice-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}

.microservice-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.microservice-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

.microservice-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.microservice-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.microservice-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.microservice-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.microservice-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.microservice-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
</style>
