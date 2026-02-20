<!--
 * 缓存列表
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <div>
    <el-card>
      <el-row :gutter="20" class="toolbar">
        <el-col :span="2" class="col-search-name">
          <div class="search-name-input-wrap">
            <span ref="nameInputMirrorRef" class="search-name-input-mirror">{{ searchParams.name || namePlaceholder }}</span>
            <el-input
              v-model="searchParams.name"
              :placeholder="namePlaceholder"
              clearable
              :style="{ width: nameInputWidth + 'px' }"
              class="search-name-input"
              @keyup="(e) => e.key === 'Enter' && search()"
              @input="updateNameInputWidth"
              @change="search"
            />
          </div>
        </el-col>
        <el-col :span="2" class="col-search-subsys">
          <div class="search-select-wrap">
            <span ref="subSysSelectMirrorRef" class="search-name-input-mirror">{{ subSysSelectDisplayText }}</span>
            <el-select
              v-model="searchParams.atomicServiceCode"
              :placeholder="subSysPlaceholder"
              clearable
              :style="{ width: subSysSelectWidth + 'px' }"
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
        </el-col>
        <el-col :span="15">
          <el-button type="primary" round @click="search">{{ t('cacheList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields">{{ t('cacheList.actions.reset') }}</el-button>
          <el-button type="success" @click="openAddDialog">{{ t('cacheList.actions.add') }}</el-button>
          <el-button type="danger" @click="multiDelete">{{ t('cacheList.actions.delete') }}</el-button>
        </el-col>
      </el-row>

      <div
        ref="tableWrapRef"
        class="table-wrap"
        @mousemove="handleTableWrapMouseMove"
        @mouseleave="handleTableWrapMouseLeave"
      >
        <operation-column-fold-toggle
          :visible="columnVisibilityPanelVisible"
          :show-text="t('cacheList.actions.showColumnPanel')"
          :hide-text="t('cacheList.actions.hideColumnPanel')"
          position="left"
          @toggle-pin="toggleColumnVisibilityPanel"
        />
        <div v-if="columnVisibilityPanelVisible" ref="columnVisibilityPanelRef" class="column-visibility-panel">
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
        </div>
        <operation-column-fold-toggle
          :visible="showOperationColumn"
          :show-text="t('cacheList.actions.showOperationColumn')"
          :hide-text="t('cacheList.actions.hideOperationColumn')"
          position="right"
          @fold-mouseenter="handleFoldMouseEnter"
          @fold-mouseleave="handleFoldMouseLeave"
          @toggle-pin="toggleOperationColumnPin"
        />

        <el-table
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
        <el-table-column type="selection" width="39" fixed="left" />
        <el-table-column type="index" width="50" fixed="left" />
        <el-table-column :label="t('cacheList.columns.name')" prop="name" sortable="custom" width="350" fixed="left" />
        <el-table-column
          v-if="isColumnVisible('atomicServiceCode')"
          :label="t('cacheList.columns.subSystem')"
          prop="atomicServiceCode"
          min-width="120"
          sortable="custom"
        >
          <template #default="scope">
            {{ transDict('kuark:sys', 'sub_sys', scope.row.atomicServiceCode) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('strategyDictCode')"
          :label="t('cacheList.columns.strategy')"
          prop="strategyDictCode"
          min-width="140"
          column-key="strategyDictCode"
          :filters="strategyFilters"
          :filtered-value="searchParams.strategyDictCode ? [searchParams.strategyDictCode] : []"
        >
          <template #default="scope">
            {{ transDict('kuark:sys', 'cache_strategy', scope.row.strategyDictCode) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('active')"
          :label="t('cacheList.columns.active')"
          prop="active"
          width="80"
          column-key="active"
          :filter-multiple="false"
          :filters="boolFilters"
          :filtered-value="searchParams.active === null || searchParams.active === undefined ? [] : [searchParams.active]"
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
          v-if="isColumnVisible('writeOnBoot')"
          :label="t('cacheList.columns.writeOnBoot')"
          prop="writeOnBoot"
          min-width="120"
          column-key="writeOnBoot"
          :filter-multiple="false"
          :filters="boolFilters"
          :filtered-value="searchParams.writeOnBoot === null || searchParams.writeOnBoot === undefined ? [] : [searchParams.writeOnBoot]"
        >
          <template #default="scope">
            {{ formatBoolText(scope.row.writeOnBoot) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('writeInTime')"
          :label="t('cacheList.columns.writeInTime')"
          prop="writeInTime"
          min-width="120"
          column-key="writeInTime"
          :filter-multiple="false"
          :filters="boolFilters"
          :filtered-value="searchParams.writeInTime === null || searchParams.writeInTime === undefined ? [] : [searchParams.writeInTime]"
        >
          <template #default="scope">
            {{ formatBoolText(scope.row.writeInTime) }}
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('ttl')" :label="t('cacheList.columns.ttlSeconds')" prop="ttl" min-width="90" />
        <el-table-column v-if="isColumnVisible('remark')" :label="t('cacheList.columns.remark')" prop="remark" />
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

      <el-pagination
        ref="paginationRef"
        class="pagination-right"
        :current-page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />

      <el-dialog v-model="keyDialogVisible" :title="t('cacheList.dialog.keyTitle')" width="20%">
        <el-input v-model="cacheKey" />
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="keyDialogVisible = false; cacheKey = null">{{ t('cacheList.common.cancel') }}</el-button>
            <el-button type="primary" @click="commitCacheOperation(cacheKey)">{{ t('cacheList.common.confirm') }}</el-button>
          </span>
        </template>
      </el-dialog>

      <cache-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
      <cache-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
      <cache-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Edit, Delete, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import CacheAddEdit from './CacheAddEdit.vue';
import CacheDetail from './CacheDetail.vue';
import OperationColumnFoldToggle from '../../../components/widgets/OperationColumnFoldToggle.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';

interface CacheCommandPayload {
  item: number;
  row: Record<string, unknown>;
}

function tr(key: string): string {
  return i18n.global.t(key) as string;
}

class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadDicts([
      new Pair('kuark:sys', 'sub_sys'),
      new Pair('kuark:sys', 'cache_strategy'),
    ]);
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null,
        atomicServiceCode: null,
        strategyDictCode: null,
        active: null,
        writeOnBoot: null,
        writeInTime: null,
      },
      keyDialogVisible: false,
      cacheKey: null as string | null,
      cacheOperation: null as string | null,
      currentRow: null as Record<string, unknown> | null,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  commandValue(item: number, row: Record<string, unknown>): CacheCommandPayload {
    return { item, row };
  }

  operateCache(payload: CacheCommandPayload): void {
    const { item, row } = payload;
    if (item === 1) this.reload(row);
    else if (item === 2) this.reloadAll(row);
    else if (item === 3) this.evict(row);
    else if (item === 4) this.clear(row);
    else if (item === 5) this.isExists(row);
    else if (item === 6) this.valueInfo(row);
  }

  commitCacheOperation(key: string | null): void {
    this.doCommitCacheOperation(key);
  }

  private async doCommitCacheOperation(key: string | null): Promise<void> {
    (this.state as Record<string, unknown>).keyDialogVisible = false;
    const row = (this.state as Record<string, unknown>).currentRow as Record<string, unknown>;
    const operation = (this.state as Record<string, unknown>).cacheOperation as string;
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

  private reload(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'reload';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private reloadAll(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'reloadAll';
    this.commitCacheOperation(null);
  }

  private evict(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'evict';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private clear(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'clear';
    this.commitCacheOperation(null);
  }

  private isExists(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'isExists';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private valueInfo(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'valueInfo';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  protected async doUpdateActive(row: Record<string, unknown>): Promise<void> {
    ElMessage.info(tr('cacheList.messages.activeChangeTakesEffectAfterRestart'));
    await super.doUpdateActive(row);
  }

  protected convertThis(): void {
    super.convertThis();
  }
}

const NAME_INPUT_PADDING = 40;
const SELECT_INPUT_PADDING = 50;
const OPERATION_COLUMN_WIDTH = 180;
const OPERATION_COLUMN_BAND_PADDING = 12;
const OPERATION_COLUMN_HIDE_DELAY_MS = 120;
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'cacheList.operationColumnPinned';
const CACHE_LIST_STATE_STORAGE_KEY = 'cacheList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'cacheList.visibleColumns';
const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'atomicServiceCode',
  'strategyDictCode',
  'active',
  'writeOnBoot',
  'writeInTime',
  'ttl',
  'remark',
];

export default defineComponent({
  name: 'CacheList',
  components: {
    CacheAddEdit,
    CacheDetail,
    OperationColumnFoldToggle,
    Edit,
    Delete,
    Tickets,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(CACHE_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const tableWrapRef = ref<HTMLElement | null>(null);
    const paginationRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
    const columnVisibilityPanelRef = ref<HTMLElement | null>(null);
    const operationColumnPinned = ref(false);
    const operationColumnHideTimer = ref<number | null>(null);
    const visibleColumnKeys = computed<string[]>({
      get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const nameInputMirrorRef = ref<HTMLElement | null>(null);
    const nameInputWidth = ref(120);
    const namePlaceholder = computed(() => t('cacheList.placeholders.name'));

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
    const subSysSelectDisplayText = computed(() => {
      const params = listPage.state.searchParams as { atomicServiceCode?: string } | undefined;
      const code = params?.atomicServiceCode;
      if (!code) return subSysPlaceholder.value;
      const items = listPage.getDictItems('kuark:sys', 'sub_sys') as Array<{ first: string; second: string }>;
      const found = items.find((p) => p.first === code);
      return found ? found.second : subSysPlaceholder.value;
    });
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
    const boolFilters = computed(() => listPage.createBooleanFilters(t('cacheList.common.yes'), t('cacheList.common.no')));
    const columnVisibilityOptions = computed(() => [
      { key: 'atomicServiceCode', label: t('cacheList.columns.subSystem') },
      { key: 'strategyDictCode', label: t('cacheList.columns.strategy') },
      { key: 'active', label: t('cacheList.columns.active') },
      { key: 'writeOnBoot', label: t('cacheList.columns.writeOnBoot') },
      { key: 'writeInTime', label: t('cacheList.columns.writeInTime') },
      { key: 'ttl', label: t('cacheList.columns.ttlSeconds') },
      { key: 'remark', label: t('cacheList.columns.remark') },
    ]);

    function formatBoolText(value: unknown): string {
      return listPage.formatBoolean(value, t('cacheList.common.yes'), t('cacheList.common.no'));
    }

    function setOperationColumnVisible(visible: boolean) {
      (listPage.state as { showOperationColumn: boolean }).showOperationColumn = visible;
    }

    function clearOperationColumnHideTimer() {
      if (operationColumnHideTimer.value !== null) {
        window.clearTimeout(operationColumnHideTimer.value);
        operationColumnHideTimer.value = null;
      }
    }

    function scheduleHideOperationColumn() {
      clearOperationColumnHideTimer();
      operationColumnHideTimer.value = window.setTimeout(() => {
        if (!operationColumnPinned.value) {
          setOperationColumnVisible(false);
        }
        operationColumnHideTimer.value = null;
      }, OPERATION_COLUMN_HIDE_DELAY_MS);
    }

    function persistOperationColumnPinned() {
      window.localStorage.setItem(
        OPERATION_COLUMN_PINNED_STORAGE_KEY,
        JSON.stringify(operationColumnPinned.value),
      );
    }

    function getPaginationEl(): HTMLElement | null {
      return (
        paginationRef.value instanceof HTMLElement
          ? paginationRef.value
          : paginationRef.value?.$el ?? null
      );
    }

    function updateTableMaxHeight() {
      listPage.updateTableMaxHeightByElements(tableWrapRef.value, getPaginationEl());
    }

    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    function toggleColumnVisibilityPanel() {
      listPage.toggleColumnVisibilityPanel();
    }

    function handleGlobalPointerDown(event: MouseEvent) {
      listPage.applyColumnVisibilityOutsideClick(
        event.target as EventTarget | null,
        columnVisibilityPanelRef.value,
        '.table-corner-fold.is-left',
      );
    }

    function handleFoldMouseEnter() {
      if (!operationColumnPinned.value) {
        clearOperationColumnHideTimer();
        setOperationColumnVisible(true);
      }
    }

    function handleFoldMouseLeave() {
      // 折角离开后是否隐藏由操作列区域命中判定控制
    }

    function handleTableWrapMouseMove(event: MouseEvent) {
      if (operationColumnPinned.value) return;
      if (!(listPage.state as { showOperationColumn: boolean }).showOperationColumn) return;
      const wrap = event.currentTarget as HTMLElement | null;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const target = event.target as HTMLElement | null;
      const inOperationColumnByTarget = Boolean(
        target && typeof target.closest === 'function' && target.closest('.operation-column')
      );
      const inOperationBand =
        event.clientX >= rect.right - OPERATION_COLUMN_WIDTH - OPERATION_COLUMN_BAND_PADDING &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (inOperationColumnByTarget || inOperationBand) {
        clearOperationColumnHideTimer();
      } else {
        scheduleHideOperationColumn();
      }
    }

    function handleTableWrapMouseLeave() {
      if (!operationColumnPinned.value) {
        scheduleHideOperationColumn();
      }
    }

    function toggleOperationColumnPin() {
      if (operationColumnPinned.value) {
        operationColumnPinned.value = false;
        clearOperationColumnHideTimer();
        setOperationColumnVisible(false);
      } else {
        operationColumnPinned.value = true;
        clearOperationColumnHideTimer();
        setOperationColumnVisible(true);
      }
      persistOperationColumnPinned();
    }
    function updateSubSysSelectWidth() {
      nextTick(() => {
        const el = subSysSelectMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + SELECT_INPUT_PADDING;
        subSysSelectWidth.value = w;
      });
    }

    function handleTableFilterChange(filters: Record<string, Array<string | number | boolean>>) {
      listPage.applyRemoteTableFilters(filters, {
        strategyDictCode: {
          paramName: 'strategyDictCode',
          emptyValue: null,
        },
        active: {
          paramName: 'active',
          parser: (value) => listPage.parseBooleanFilterValue(value),
          emptyValue: null,
        },
        writeOnBoot: {
          paramName: 'writeOnBoot',
          parser: (value) => listPage.parseBooleanFilterValue(value),
          emptyValue: null,
        },
        writeInTime: {
          paramName: 'writeInTime',
          parser: (value) => listPage.parseBooleanFilterValue(value),
          emptyValue: null,
        },
      });
    }

    onMounted(() => {
      listPage.restorePersistedListState();
      updateNameInputWidth();
      updateSubSysSelectWidth();
      nextTick(() => updateTableMaxHeight());
      document.addEventListener('mousedown', handleGlobalPointerDown);
      window.addEventListener('resize', updateTableMaxHeight);
      const pinnedRaw = window.localStorage.getItem(OPERATION_COLUMN_PINNED_STORAGE_KEY);
      if (pinnedRaw) {
        try {
          operationColumnPinned.value = JSON.parse(pinnedRaw) === true;
          if (operationColumnPinned.value) {
            setOperationColumnVisible(true);
          }
        } catch {
          // ignore invalid local storage
        }
      }
    });
    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', handleGlobalPointerDown);
      window.removeEventListener('resize', updateTableMaxHeight);
      clearOperationColumnHideTimer();
    });
    watch(() => (listPage.state as Record<string, unknown>).searchParams, () => {
      updateNameInputWidth();
      updateSubSysSelectWidth();
      listPage.persistListState();
    }, { deep: true });
    watch(() => (listPage.state as Record<string, unknown>).sort, () => {
      listPage.persistListState();
    }, { deep: true });
    watch(() => (listPage.state as Record<string, unknown>).pagination, () => {
      listPage.persistListState();
    }, { deep: true });
    watch(() => (listPage.state as Record<string, unknown>).tableData, () => {
      listPage.persistListState();
      nextTick(() => updateTableMaxHeight());
    }, { deep: true });
    return {
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      commandValue: listPage.commandValue.bind(listPage),
      operateCache: listPage.operateCache.bind(listPage),
      commitCacheOperation: listPage.commitCacheOperation.bind(listPage),
      columnVisibilityPanelRef,
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
      columnVisibilityPanelVisible: computed(() => Boolean((listPage.state as Record<string, unknown>).columnVisibilityPanelVisible)),
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      toggleColumnVisibilityPanel,
      formatBoolText,
      toggleOperationColumnPin,
      handleFoldMouseEnter,
      handleFoldMouseLeave,
      handleTableWrapMouseMove,
      handleTableWrapMouseLeave,
      handleTableFilterChange,
      updateSubSysSelectWidth,
      tableWrapRef,
      paginationRef,
    };
  },
});
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}

.col-search-name,
.col-search-subsys {
  flex: 0 0 auto;
  max-width: none;
}

.search-name-input-wrap,
.search-select-wrap {
  position: relative;
  display: inline-block;
}

.search-name-input-mirror {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: pre;
  font-size: 14px;
  font-family: inherit;
  line-height: 32px;
  padding: 0 11px;
  box-sizing: border-box;
}

.search-name-input,
.search-select-input {
  min-width: 0;
}

.table-wrap {
  position: relative;
  margin-top: 8px;
}

.column-visibility-panel {
  position: absolute;
  top: 22px;
  left: 8px;
  z-index: 35;
  min-width: 200px;
  max-width: 260px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color-overlay);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.column-visibility-title {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.operate-column-icon {
  cursor: pointer;
  vertical-align: middle;
  margin-right: 6px;
}

.operation-column-hover-area {
  width: 100%;
  height: 100%;
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
}
</style>
