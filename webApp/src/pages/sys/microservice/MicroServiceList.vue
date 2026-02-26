<!--
 * 微服务列表：ListPageLayout + 编码(code)/名称(name)/仅启用、编码列树结构(parentCode)、列可见性、操作列折角、可拖拽排序列。
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
          <el-button type="primary" round @click="search">{{ t('microServiceList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields">{{ t('microServiceList.actions.reset') }}</el-button>
          <el-button type="success" @click="openAddDialog">{{ t('microServiceList.actions.add') }}</el-button>
          <el-button type="danger" @click="multiDelete">{{ t('microServiceList.actions.delete') }}</el-button>
        </div>
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
          <el-table-column v-if="isColumnVisible('index')" type="index" width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('microServiceList.columns.code')"
            prop="code"
            min-width="140"
            fixed="left"
            class-name="col-fixed-code"
          />
          <el-table-column
            :label="t('microServiceList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'atomicService' && isColumnVisible('atomicService')"
              prop="atomicService"
              width="110"
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
              min-width="120"
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
              width="80"
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
              width="80"
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
              min-width="140"
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
            width="120"
            fixed="right"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('microServiceList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('microServiceList.actions.edit')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('microServiceList.actions.delete')" placement="top">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('microServiceList.actions.detail')" placement="top">
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
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { Edit, Delete, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'microServiceList.operationColumnPinned';
const MICROSERVICE_LIST_STATE_STORAGE_KEY = 'microServiceList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'microServiceList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'microServiceList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['atomicService', 'context', 'active', 'builtIn', 'remark'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...COLUMN_VISIBILITY_KEYS];

class ListPage extends BaseListPage {
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
    return 'sys/microservice';
  }

  protected getSearchUrl(): string {
    return this.getRootActionPath() + '/searchTree';
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

  /** 树接口直接返回 data 数组，无 first/second */
  protected postSearchSuccessfully(data: unknown): void {
    this.state.tableData = Array.isArray(data) ? data : [];
  }
}

export default defineComponent({
  name: 'MicroServiceList',
  components: { ListPageLayout, Edit, Delete, Tickets },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(MICROSERVICE_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    const listLayoutRefs = { tableWrapRef, paginationRef };
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

    function loadColumnOrder(): string[] {
      if (typeof window === 'undefined') return [...ALL_COLUMN_KEYS];
      try {
        const raw = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
        if (!raw) return [...ALL_COLUMN_KEYS];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [...ALL_COLUMN_KEYS];
        const set = new Set(ALL_COLUMN_KEYS);
        const ordered = (parsed as string[]).filter((k) => set.has(k));
        const missing = ALL_COLUMN_KEYS.filter((k) => !ordered.includes(k));
        return ordered.length ? [...ordered, ...missing] : [...ALL_COLUMN_KEYS];
      } catch {
        return [...ALL_COLUMN_KEYS];
      }
    }
    function saveColumnOrder(order: string[]) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order));
    }
    const columnOrder = ref<string[]>(loadColumnOrder());
    const orderedColumnKeys = computed(() => {
      const order = columnOrder.value;
      if (!order.length) return [...ALL_COLUMN_KEYS];
      const set = new Set(ALL_COLUMN_KEYS);
      const ordered = order.filter((k) => set.has(k));
      const missing = ALL_COLUMN_KEYS.filter((k) => !ordered.includes(k));
      return ordered.length ? [...ordered, ...missing] : [...ALL_COLUMN_KEYS];
    });

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('microServiceList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('microServiceList.columns.' + key),
      })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    const showOperationColumn = computed(() => Boolean(listPage.state?.showOperationColumn));

    const columnDragKey = ref<string | null>(null);
    const columnDropTargetKey = ref<string | null>(null);
    function onHeaderDragStart(e: DragEvent, key: string) {
      columnDragKey.value = key;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }
    function onHeaderDragOver(e: DragEvent, toKey: string) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      columnDropTargetKey.value = toKey;
    }
    function applyColumnDrop(toKey: string) {
      const fromKey = columnDragKey.value;
      columnDragKey.value = null;
      columnDropTargetKey.value = null;
      if (!fromKey || fromKey === toKey) return;
      const order = [...orderedColumnKeys.value];
      const fromIndex = order.indexOf(fromKey);
      const toIndex = order.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const [removed] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, removed);
      columnOrder.value = order;
      saveColumnOrder(order);
    }
    function onHeaderDrop(e: DragEvent, toKey: string) {
      e.preventDefault();
      e.stopPropagation();
      applyColumnDrop(toKey);
    }
    function onTableDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
      if (keyEl) columnDropTargetKey.value = keyEl.getAttribute('data-column-key');
    }
    function onTableDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
      const toKey = keyEl?.getAttribute('data-column-key') ?? columnDropTargetKey.value;
      if (toKey) applyColumnDrop(toKey);
    }
    function onHeaderDragEnd() {
      columnDragKey.value = null;
      columnDropTargetKey.value = null;
    }

    function onTableWrapMounted() {
      nextTick(updateTableMaxHeight);
    }

    onMounted(() => {
      listPage.restorePersistedListState();
    });
    watch(
      () => [listPage.state.searchParams, listPage.state.tableData],
      () => {
        listPage.persistListState();
        nextTick(updateTableMaxHeight);
      },
      { deep: true }
    );

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      listLayoutRefs,
      tableRef,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
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

<style lang="css" scoped>
.microservice-list-page {
  height: 100%;
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
