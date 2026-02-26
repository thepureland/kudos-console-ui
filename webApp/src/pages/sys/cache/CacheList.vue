<!--
 * 缓存列表
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="cache-list-page list-page-common">
    <!-- 列表页布局：工具栏 + 表格区（栏位可见性/操作列折角）+ 分页 -->
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('cacheList.actions.showColumnPanel')"
      :column-panel-hide-text="t('cacheList.actions.hideColumnPanel')"
      :operation-column-show-text="t('cacheList.actions.showOperationColumn')"
      :operation-column-hide-text="t('cacheList.actions.hideOperationColumn')"
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
        <div class="toolbar-cell toolbar-subsys">
          <div class="search-select-wrap">
            <span ref="subSysSelectMirrorRef" class="search-name-input-mirror">{{ subSysSelectDisplayText }}</span>
            <el-select
              v-model="searchParams.atomicServiceCode"
              :placeholder="subSysPlaceholder"
              clearable
              class="search-select-input"
              @change="() => { updateSubSysSelectWidth(); search(); }"
            >
              <el-option
                v-for="item in getDictItems('kuark:sys', 'sub_sys')"
                :key="item.first"
                :value="item.first"
                :label="item.second"
              />
            </el-select>
          </div>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('cacheList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">{{ t('cacheList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields">{{ t('cacheList.actions.reset') }}</el-button>
          <el-button type="success" @click="openAddDialog">{{ t('cacheList.actions.add') }}</el-button>
          <el-button type="danger" @click="multiDelete">{{ t('cacheList.actions.delete') }}</el-button>
        </div>
      </template>
      <!-- 栏位可见性面板：勾选控制各列显示/隐藏（列顺序在表头拖拽调整） -->
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('cacheList.actions.columnVisibility') }}</div>
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
      <!-- 缓存列表表格：选择/序号/名称/子系统/策略/启用/写盘/写入时机/TTL/备注 + 操作列（编辑/删除/详情/管理下拉） -->
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
          @filter-change="handleTableFilterChange"
        >
        <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
        <el-table-column v-if="isColumnVisible('index')" type="index" width="50" fixed="left" class-name="col-fixed-index" />
        <el-table-column :label="t('cacheList.columns.name')" prop="name" sortable="custom" width="350" fixed="left" class-name="col-fixed-name" />
        <template v-for="key in orderedColumnKeys" :key="key">
          <el-table-column
            v-if="key === 'atomicServiceCode' && isColumnVisible('atomicServiceCode')"
            prop="atomicServiceCode"
            min-width="120"
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
              >{{ t('cacheList.columns.subSystem') }}</div>
            </template>
            <template #default="scope">
              {{ transDict('kuark:sys', 'sub_sys', scope.row.atomicServiceCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'strategyDictCode' && isColumnVisible('strategyDictCode')"
            prop="strategyDictCode"
            min-width="140"
            column-key="strategyDictCode"
            :filters="strategyFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.strategyDictCode)"
          >
            <template #header>
              <div
                class="column-header-draggable"
                data-column-key="strategyDictCode"
                :class="{ 'is-dragging': columnDragKey === 'strategyDictCode', 'is-drop-target': columnDropTargetKey === 'strategyDictCode' }"
                draggable="true"
                @dragstart="onHeaderDragStart($event, 'strategyDictCode')"
                @dragover="onHeaderDragOver($event, 'strategyDictCode')"
                @drop="onHeaderDrop($event, 'strategyDictCode')"
                @dragend="onHeaderDragEnd"
              >{{ t('cacheList.columns.strategy') }}</div>
            </template>
            <template #default="scope">
              {{ transDict('kuark:sys', 'cache_strategy', scope.row.strategyDictCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'active' && isColumnVisible('active')"
            prop="active"
            width="80"
            column-key="active"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.active)"
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
              >{{ t('cacheList.columns.active') }}</div>
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
            v-else-if="key === 'writeOnBoot' && isColumnVisible('writeOnBoot')"
            prop="writeOnBoot"
            min-width="120"
            column-key="writeOnBoot"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.writeOnBoot)"
          >
            <template #header>
              <div
                class="column-header-draggable"
                data-column-key="writeOnBoot"
                :class="{ 'is-dragging': columnDragKey === 'writeOnBoot', 'is-drop-target': columnDropTargetKey === 'writeOnBoot' }"
                draggable="true"
                @dragstart="onHeaderDragStart($event, 'writeOnBoot')"
                @dragover="onHeaderDragOver($event, 'writeOnBoot')"
                @drop="onHeaderDrop($event, 'writeOnBoot')"
                @dragend="onHeaderDragEnd"
              >{{ t('cacheList.columns.writeOnBoot') }}</div>
            </template>
            <template #default="scope">
              {{ formatBoolText(scope.row.writeOnBoot) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'writeInTime' && isColumnVisible('writeInTime')"
            prop="writeInTime"
            min-width="120"
            column-key="writeInTime"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.writeInTime)"
          >
            <template #header>
              <div
                class="column-header-draggable"
                data-column-key="writeInTime"
                :class="{ 'is-dragging': columnDragKey === 'writeInTime', 'is-drop-target': columnDropTargetKey === 'writeInTime' }"
                draggable="true"
                @dragstart="onHeaderDragStart($event, 'writeInTime')"
                @dragover="onHeaderDragOver($event, 'writeInTime')"
                @drop="onHeaderDrop($event, 'writeInTime')"
                @dragend="onHeaderDragEnd"
              >{{ t('cacheList.columns.writeInTime') }}</div>
            </template>
            <template #default="scope">
              {{ formatBoolText(scope.row.writeInTime) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'ttl' && isColumnVisible('ttl')"
            prop="ttl"
            min-width="90"
          >
            <template #header>
              <div
                class="column-header-draggable"
                data-column-key="ttl"
                :class="{ 'is-dragging': columnDragKey === 'ttl', 'is-drop-target': columnDropTargetKey === 'ttl' }"
                draggable="true"
                @dragstart="onHeaderDragStart($event, 'ttl')"
                @dragover="onHeaderDragOver($event, 'ttl')"
                @drop="onHeaderDrop($event, 'ttl')"
                @dragend="onHeaderDragEnd"
              >{{ t('cacheList.columns.ttlSeconds') }}</div>
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'remark' && isColumnVisible('remark')"
            prop="remark"
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
              >{{ t('cacheList.columns.remark') }}</div>
            </template>
          </el-table-column>
        </template>
        <el-table-column
          v-if="showOperationColumn"
          :label="t('cacheList.columns.operation')"
          align="center"
          fixed="right"
          width="180"
          min-width="180"
          class-name="operation-column"
          label-class-name="operation-column"
        >
          <template #header>
            <div class="operation-column-hover-area">{{ t('cacheList.columns.operation') }}</div>
          </template>
          <template #default="scope">
            <div class="operation-column-hover-area">
              <el-tooltip :content="t('cacheList.actions.edit')" placement="top">
                <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                  <Edit />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('cacheList.actions.delete')" placement="top">
                <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                  <Delete />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('cacheList.actions.detail')" placement="top">
                <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                  <Tickets />
                </el-icon>
              </el-tooltip>
              <el-dropdown split-button size="small" type="primary" @command="operateCache">
                {{ t('cacheList.actions.manage') }}
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="commandValue(1, scope.row)">{{ t('cacheList.actions.reload') }}</el-dropdown-item>
                    <el-dropdown-item :command="commandValue(2, scope.row)">{{ t('cacheList.actions.reloadAll') }}</el-dropdown-item>
                    <el-dropdown-item :command="commandValue(3, scope.row)">{{ t('cacheList.actions.evict') }}</el-dropdown-item>
                    <el-dropdown-item :command="commandValue(4, scope.row)">{{ t('cacheList.actions.clearAll') }}</el-dropdown-item>
                    <el-dropdown-item :command="commandValue(5, scope.row)">{{ t('cacheList.actions.checkKeyExists') }}</el-dropdown-item>
                    <el-dropdown-item :command="commandValue(6, scope.row)">{{ t('cacheList.actions.getValueInfo') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>
      <!-- 分页：总数、每页条数、上一页/页码/下一页、跳转 -->
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

    <!-- 缓存操作 key 输入弹窗：重载/驱逐/检查存在/查看 value 等需输入 key 时使用 -->
    <el-dialog v-model="keyDialogVisible" :title="t('cacheList.dialog.keyTitle')" width="20%">
        <el-input v-model="cacheKey" />
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="keyDialogVisible = false; cacheKey = null">{{ t('cacheList.common.cancel') }}</el-button>
            <el-button type="primary" @click="commitCacheOperation(cacheKey)">{{ t('cacheList.common.confirm') }}</el-button>
          </span>
        </template>
      </el-dialog>

    <!-- 新增/编辑/详情弹窗，按需挂载 -->
    <cache-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
    <cache-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
    <cache-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, Delete, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import CacheAddEdit from './CacheAddEdit.vue';
import CacheDetail from './CacheDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';

/** 下拉菜单「管理」操作项的命令参数：操作编号 + 当前行数据 */
interface CacheCommandPayload {
  item: number;
  row: Record<string, unknown>;
}

/** 在非模板代码中获取 i18n 文案（类内部等无法使用 useI18n 时） */
function tr(key: string): string {
  return i18n.global.t(key) as string;
}

/** 缓存列表页业务逻辑：搜索、表格、缓存管理操作（重载/驱逐等）及 key 弹窗 */
class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadDicts([
      new Pair('kuark:sys', 'sub_sys'),
      new Pair('kuark:sys', 'cache_strategy'),
    ]);
  }

  /** 初始化页面状态：搜索条件、key 弹窗可见性、当前操作与当前行 */
  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null,
        atomicServiceCode: null,
        strategyDictCode: null,
        active: true,
        writeOnBoot: null,
        writeInTime: null,
      },
      keyDialogVisible: false,
      cacheKey: null as string | null,
      cacheOperation: null as string | null,
      currentRow: null as Record<string, unknown> | null,
    };
  }

  /** 接口根路径，用于请求与路由 */
  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  /** 仅当勾选「仅启用」时传 active=true；不勾选时传 null，后端返回启用+未启用全部 */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  /** 构造下拉菜单命令参数，供 el-dropdown 的 command 使用 */
  commandValue(item: number, row: Record<string, unknown>): CacheCommandPayload {
    return { item, row };
  }

  /** 根据命令编号分发到对应缓存管理操作 */
  operateCache(payload: CacheCommandPayload): void {
    const { item, row } = payload;
    if (item === 1) this.reload(row);
    else if (item === 2) this.reloadAll(row);
    else if (item === 3) this.evict(row);
    else if (item === 4) this.clear(row);
    else if (item === 5) this.isExists(row);
    else if (item === 6) this.valueInfo(row);
  }

  /** 用户确认 key 后提交当前缓存操作（重载/驱逐/检查存在等） */
  commitCacheOperation(key: string | null): void {
    this.doCommitCacheOperation(key);
  }

  /** 调用后端缓存管理接口，关闭 key 弹窗并提示结果 */
  private async doCommitCacheOperation(key: string | null): Promise<void> {
    const state = this.state as Record<string, unknown>;
    state.keyDialogVisible = false;
    const row = state.currentRow as Record<string, unknown>;
    const operation = state.cacheOperation as string;
    const params: Record<string, unknown> = { cacheName: row?.name };
    if (operation !== 'reloadAll' && operation !== 'clear') {
      params.key = key;
    }
    const url = `sys/cache/management/${operation}`;
    try {
      const result = await backendRequest({ url, params }) as { code: number; data?: string };
      if (result.code === 200) {
        ElMessage.info(result.data ?? '');
      } else {
        ElMessage.error(tr('cacheList.messages.requestOperationFailed'));
      }
    } catch {
      ElMessage.error(tr('cacheList.messages.requestOperationFailed'));
    }
  }

  /** 重载单 key：记录当前行与操作，打开 key 输入弹窗 */
  private reload(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'reload';
    s.keyDialogVisible = true;
  }

  /** 重载整个缓存：无需 key，直接提交 */
  private reloadAll(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'reloadAll';
    this.commitCacheOperation(null);
  }

  /** 驱逐单 key：记录当前行与操作，打开 key 输入弹窗 */
  private evict(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'evict';
    s.keyDialogVisible = true;
  }

  /** 清空整个缓存：无需 key，直接提交 */
  private clear(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'clear';
    this.commitCacheOperation(null);
  }

  /** 检查 key 是否存在：记录当前行与操作，打开 key 输入弹窗 */
  private isExists(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'isExists';
    s.keyDialogVisible = true;
  }

  /** 查看 key 对应 value 信息：记录当前行与操作，打开 key 输入弹窗 */
  private valueInfo(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'valueInfo';
    s.keyDialogVisible = true;
  }

  /** 更新启用状态前提示「重启后生效」，再调用基类请求 */
  protected async doUpdateActive(row: Record<string, unknown>): Promise<void> {
    ElMessage.info(tr('cacheList.messages.activeChangeTakesEffectAfterRestart'));
    await super.doUpdateActive(row);
  }
}

/** 名称搜索框：镜像 span 宽度 + 该值作为 input 的 min-width 余量 */
const NAME_INPUT_PADDING = 40;
/** 子系统下拉：镜像 span 宽度 + 该值作为 select 的 min-width 余量 */
const SELECT_INPUT_PADDING = 50;
/** 操作列「固定展开」在 localStorage 的 key */
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'cacheList.operationColumnPinned';
/** 列表状态（搜索/排序/分页）持久化的 localStorage key */
const CACHE_LIST_STATE_STORAGE_KEY = 'cacheList.queryState';
/** 栏位可见性持久化的 localStorage key */
const COLUMN_VISIBILITY_STORAGE_KEY = 'cacheList.visibleColumns';
/** 栏位顺序持久化的 localStorage key */
const COLUMN_ORDER_STORAGE_KEY = 'cacheList.columnOrder';
/** 可参与排序的列 key（与栏位可见性一致） */
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = [
  'atomicServiceCode',
  'strategyDictCode',
  'active',
  'writeOnBoot',
  'writeInTime',
  'ttl',
  'remark',
];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
/** 默认展示的列 key 列表（除固定列外） */
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'CacheList',
  components: {
    CacheAddEdit,
    CacheDetail,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(CACHE_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    /** 供模板使用且不被 Vue 解包的 ref 容器，避免 tableWrapRef 以 null 传给子组件 */
    const listLayoutRefs = { tableWrapRef, paginationRef };
    /** 表格实例，用于栏位可见性/操作列切换后调用 doLayout 并强制修正左侧固定列宽度 */
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    /** 左侧固定列总宽度（选择 39 + 序号 50 + 名称 350），用于防止被 doLayout 累加 */
    const FIXED_LEFT_TOTAL_WIDTH = 439;
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
    /** 栏位顺序（可拖拽调整），与 localStorage 同步 */
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
    /** 当前栏位顺序（用于面板列表与表格列顺序） */
    const orderedColumnKeys = computed(() => {
      const order = columnOrder.value;
      if (!order.length) return [...ALL_COLUMN_KEYS];
      const set = new Set(ALL_COLUMN_KEYS);
      const ordered = order.filter((k) => set.has(k));
      const missing = ALL_COLUMN_KEYS.filter((k) => !ordered.includes(k));
      return ordered.length ? [...ordered, ...missing] : [...ALL_COLUMN_KEYS];
    });
    /** 栏位可见性勾选与 listPage 状态双向同步 */
    const visibleColumnKeys = computed<string[]>({
      get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const nameInputMirrorRef = ref<HTMLElement | null>(null);
    const nameInputWidth = ref(120);
    const namePlaceholder = computed(() => t('cacheList.placeholders.name'));

    /** 根据镜像 span 宽度更新名称输入框宽度，保证输入时不被截断 */
    function updateNameInputWidth() {
      nextTick(() => {
        const el = nameInputMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + NAME_INPUT_PADDING;
        nameInputWidth.value = w;
      });
    }

    const subSysSelectMirrorRef = ref<HTMLElement | null>(null);
    const subSysSelectWidth = ref(120);
    const subSysPlaceholder = computed(() => t('cacheList.placeholders.atomicService'));
    /** 子系统下拉当前选中项的展示文案（用于镜像测量宽度） */
    const subSysSelectDisplayText = computed(() => {
      const params = listPage.state.searchParams as { atomicServiceCode?: string } | undefined;
      const code = params?.atomicServiceCode;
      if (!code) return subSysPlaceholder.value;
      const items = listPage.getDictItems('kuark:sys', 'sub_sys') as Array<{ first: string; second: string }>;
      const found = items.find((p) => p.first === code);
      return found ? found.second : subSysPlaceholder.value;
    });
    /** 策略列表头筛选选项，优先用字典，无则用默认三项 */
    const strategyFilters = computed(() => {
      const items = listPage.getDictItems('kuark:sys', 'cache_strategy') as Array<{ first: string; second: string }>;
      if (items.length > 0) {
        return items.map((item) => ({ text: item.first, value: item.first }));
      }
      return [
        { text: 'LOCAL_REMOTE', value: 'LOCAL_REMOTE' },
        { text: 'SINGLE_LOCAL', value: 'SINGLE_LOCAL' },
        { text: 'REMOTE', value: 'REMOTE' },
      ];
    });
    /** 布尔列（启用/写盘等）表头筛选：是/否 */
    const boolFilters = computed(() => listPage.createBooleanFilters(t('cacheList.common.yes'), t('cacheList.common.no')));
    const columnKeyToLabel: Record<string, () => string> = {
      atomicServiceCode: () => t('cacheList.columns.subSystem'),
      strategyDictCode: () => t('cacheList.columns.strategy'),
      active: () => t('cacheList.columns.active'),
      writeOnBoot: () => t('cacheList.columns.writeOnBoot'),
      writeInTime: () => t('cacheList.columns.writeInTime'),
      ttl: () => t('cacheList.columns.ttlSeconds'),
      remark: () => t('cacheList.columns.remark'),
    };
    /** 栏位可见性面板中的可选项（按当前顺序），支持拖拽排序 */
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('cacheList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({ key, label: columnKeyToLabel[key]?.() ?? key })),
    ]);
    /** 表头拖拽排序：当前被拖拽的列 key */
    const columnDragKey = ref<string | null>(null);
    /** 当前悬停到的可放置表头（用于高亮「松手即放到这里」） */
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
    /** 执行列顺序插入：fromKey 移到 toKey 位置 */
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
      nextTick(forceFixedLeftWidth);
    }
    function onHeaderDrop(e: DragEvent, toKey: string) {
      e.preventDefault();
      e.stopPropagation();
      applyColumnDrop(toKey);
    }
    /** 表格区域 dragover：保证任意位置都能触发 drop，并更新放置目标高亮 */
    function onTableDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
      if (keyEl) columnDropTargetKey.value = keyEl.getAttribute('data-column-key');
    }
    /** 表格区域 drop：松手时若落在非表头元素上，用当前高亮列或鼠标下元素解析目标列，确保能插入 */
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

    /** 将布尔值格式化为「是/否」文案 */
    function formatBoolText(value: unknown): string {
      return listPage.formatBoolean(value, t('cacheList.common.yes'), t('cacheList.common.no'));
    }

    /** 判断某列是否在「栏位可见性」中勾选 */
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    /** 根据镜像 span 宽度更新子系统下拉框宽度 */
    function updateSubSysSelectWidth() {
      nextTick(() => {
        const el = subSysSelectMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + SELECT_INPUT_PADDING;
        subSysSelectWidth.value = w;
      });
    }

    /** 表格容器挂载后重新计算表格最大高度（供 ListPageLayout 的 table-wrap-mounted 调用） */
    function onTableWrapMounted() {
      nextTick(updateTableMaxHeight);
    }

    /** 表格列筛选变化时同步到 searchParams 并请求列表 */
    function handleTableFilterChange(filters: Record<string, Array<string | number | boolean>>) {
      listPage.applyRemoteTableFilters(filters, {
        strategyDictCode: { paramName: 'strategyDictCode', emptyValue: null },
        active: listPage.createBooleanFilterMapping('active'),
        writeOnBoot: listPage.createBooleanFilterMapping('writeOnBoot'),
        writeInTime: listPage.createBooleanFilterMapping('writeInTime'),
      });
    }

    /** 首屏：恢复持久化状态，并测量名称/子系统输入宽度 */
    onMounted(() => {
      listPage.restorePersistedListState();
      updateNameInputWidth();
      updateSubSysSelectWidth();
    });
    /** 搜索/排序/分页/表格数据变化时持久化状态，并更新输入宽度与表格高度 */
    watch(
      () => [
        (listPage.state as Record<string, unknown>).searchParams,
        (listPage.state as Record<string, unknown>).sort,
        (listPage.state as Record<string, unknown>).pagination,
        (listPage.state as Record<string, unknown>).tableData,
      ],
      () => {
        listPage.persistListState();
        updateNameInputWidth();
        updateSubSysSelectWidth();
        nextTick(updateTableMaxHeight);
      },
      { deep: true },
    );
    /** 栏位可见性变化后重新布局并强制锁定左侧固定列宽度 */
    watch(
      () => (listPage.state as Record<string, unknown>).visibleColumnKeys,
      () => { nextTick(forceFixedLeftWidth); },
      { deep: true },
    );
    /** 操作列显示/隐藏切换后重新布局并强制锁定左侧固定列宽度 */
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
      commandValue: listPage.commandValue.bind(listPage),
      operateCache: listPage.operateCache.bind(listPage),
      commitCacheOperation: listPage.commitCacheOperation.bind(listPage),
      nameInputMirrorRef,
      nameInputWidth,
      namePlaceholder,
      updateNameInputWidth,
      subSysSelectMirrorRef,
      subSysSelectWidth,
      subSysPlaceholder,
      subSysSelectDisplayText,
      strategyFilters,
      boolFilters,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      formatBoolText,
      getFilteredValueForColumn: listPage.getFilteredValueForColumn.bind(listPage),
      onTableWrapMounted,
      handleTableFilterChange,
      updateSubSysSelectWidth,
      listLayoutRefs,
      tableRef,
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
/* 穿透 Element 表格/分页内部类，需保留在组件内使用 :deep */
:deep(.el-table .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 22px;
}

:deep(.el-table__row) {
  height: 32px;
}

/* 固定左列：锁定单元格与左侧固定块总宽，避免栏位可见性切换时被重新计算撑大 */
:deep(.el-table__fixed-left) {
  width: 439px !important;
  max-width: 439px !important;
}
:deep(.el-table__fixed-left .el-table__fixed-body-wrapper) {
  width: 439px !important;
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
  width: 350px !important;
  min-width: 350px !important;
  max-width: 350px !important;
}

:deep(.el-table th.operation-column),
:deep(.el-table td.operation-column) {
  width: 180px !important;
  min-width: 180px !important;
  max-width: 180px !important;
}

:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.table-drag-drop-zone {
  flex: 1;
  min-height: 0;
}

/* 可排序列的表头：仅显示列名、可拖拽，不显示 Element 自带的筛选/排序等任何图标 */
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
/* 正在被拖拽的表头：半透明 + 浅底，明确「这是拖起来的那一列」 */
:deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
/* 当前可放置目标：左侧主题色竖条，松手即放到该列前 */
:deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
/* 可拖拽列表头内只保留列名：先隐藏整格内所有内容，再只显示我们的列名 */
:deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
:deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
:deep(th .cell:has(.column-header-draggable) .el-table__column-filter-trigger),
:deep(th .cell:has(.column-header-draggable) .el-table__column-sort),
:deep(th .cell:has(.column-header-draggable) .caret-wrapper),
:deep(th .cell:has(.column-header-draggable) .el-table__sort-icon) {
  display: none !important;
}
</style>
