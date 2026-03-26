<!--
 * 缓存列表：支持按缓存名称、原子服务、缓存策略、仅启用等筛选，表格支持列可见性、操作列折角、列拖拽排序，含缓存管理操作（重载/踢除等），多语言。
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
      <!-- 搜索栏：名称/原子服务/策略/Hash存储/仅启用 + 搜索、重置 -->
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
              filterable
              class="search-select-input"
              @change="() => { updateSubSysSelectWidth(); search(); }"
            >
              <el-option
                v-for="item in getAtomicServices()"
                :key="item.code"
                :value="item.code"
                :label="item.name"
              />
            </el-select>
          </div>
        </div>
        <div class="toolbar-cell toolbar-strategy">
          <el-select
            v-model="searchParams.strategyDictCode"
            :placeholder="t('cacheList.placeholders.strategy')"
            clearable
            class="search-select-input"
            @change="search"
          >
            <el-option
              v-for="item in (listPage.state.strategyDictOptions || [])"
              :key="item.first"
              :value="item.first"
              :label="t(item.second)"
            />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-hash">
          <el-select
            v-model="searchParams.hash"
            :placeholder="t('cacheList.placeholders.hash')"
            clearable
            class="search-select-input"
            @change="search"
          >
            <el-option :value="true" :label="t('cacheList.common.yes')" />
            <el-option :value="false" :label="t('cacheList.common.no')" />
          </el-select>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('cacheList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('cacheList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('cacheList.actions.reset') }}
          </el-button>
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
      <!-- 表格上方工具栏：新增、删除（布局由 ListPageLayout + list-page-common 提供） -->
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('cacheList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('cacheList.actions.delete') }}
        </el-button>
      </template>
      <!-- 缓存列表表格：选择/序号/名称/原子服务/策略/启用/写缓存/写入时机/TTL/备注 + 操作列（编辑/删除/详情/管理下拉） -->
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
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('cacheList.columns.name')" prop="name" sortable="custom" min-width="250" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
            v-if="key === 'atomicServiceCode' && isColumnVisible('atomicServiceCode')"
            prop="atomicServiceCode"
            :min-width="columnWidths['atomicServiceCode'] ?? 95"
            sortable="custom"
            show-overflow-tooltip
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
              {{ transAtomicService(scope.row.atomicServiceCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'strategyDictCode' && isColumnVisible('strategyDictCode')"
            prop="strategyDictCode"
            :min-width="columnWidths['strategyDictCode'] ?? 110"
            column-key="strategyDictCode"
            :filters="strategyFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.strategyDictCode)"
            show-overflow-tooltip
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
              {{ (() => {
                const code = scope.row.strategyDictCode;
                if (!code) return '';
                const opts = (listPage.state.strategyDictOptions || []) as Array<{ first: string; second: string }>;
                const item = opts.find(o => o.first === code);
                return item ? t(item.second) : code;
              })() }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'hash' && isColumnVisible('hash')"
            prop="hash"
            :min-width="columnWidths['hash'] ?? 100"
            column-key="hash"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.hash)"
            show-overflow-tooltip
          >
            <template #header>
              <div
                class="column-header-draggable"
                data-column-key="hash"
                :class="{ 'is-dragging': columnDragKey === 'hash', 'is-drop-target': columnDropTargetKey === 'hash' }"
                draggable="true"
                @dragstart="onHeaderDragStart($event, 'hash')"
                @dragover="onHeaderDragOver($event, 'hash')"
                @drop="onHeaderDrop($event, 'hash')"
                @dragend="onHeaderDragEnd"
              >{{ t('cacheList.columns.hash') }}</div>
            </template>
            <template #default="scope">
              {{ formatBoolText(scope.row.hash) }}
            </template>
          </el-table-column>
          <el-table-column
            v-else-if="key === 'active' && isColumnVisible('active')"
            prop="active"
            :min-width="62"
            column-key="active"
            class-name="col-cache-active-switch"
            label-class-name="col-cache-active-switch"
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
            :min-width="columnWidths['writeOnBoot'] ?? 98"
            column-key="writeOnBoot"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.writeOnBoot)"
            show-overflow-tooltip
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
            :min-width="columnWidths['writeInTime'] ?? 90"
            column-key="writeInTime"
            :filter-multiple="false"
            :filters="boolFilters"
            :filtered-value="getFilteredValueForColumn(searchParams.writeInTime)"
            show-overflow-tooltip
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
            :min-width="columnWidths['ttl'] ?? 90"
            show-overflow-tooltip
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
            :min-width="columnWidths['remark'] ?? 120"
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
              >{{ t('cacheList.columns.remark') }}</div>
            </template>
          </el-table-column>
        </template>
        <el-table-column
          v-if="showOperationColumn"
          :label="t('cacheList.columns.operation')"
          align="center"
          fixed="right"
          min-width="200"
          class-name="operation-column"
          label-class-name="operation-column"
        >
          <template #header>
            <div class="operation-column-hover-area">{{ t('cacheList.columns.operation') }}</div>
          </template>
          <template #default="scope">
            <div class="operation-column-hover-area">
              <el-tooltip :content="t('cacheList.actions.edit')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                  <Edit />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('cacheList.actions.delete')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                  <Delete />
                </el-icon>
              </el-tooltip>
              <el-tooltip :content="t('cacheList.actions.detail')" placement="top" :enterable="false">
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
    <el-dialog v-model="keyDialogVisible" :title="t('cacheList.dialog.keyTitle')" min-width="20%">
        <el-input
          ref="cacheKeyInputRef"
          v-model="cacheKey"
          @keydown.enter.prevent="submitCacheOperationFromInput"
        />
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="keyDialogVisible = false; cacheKey = null">{{ t('cacheList.common.cancel') }}</el-button>
            <el-button type="primary" @click="submitCacheOperationFromInput">{{ t('cacheList.common.confirm') }}</el-button>
          </span>
        </template>
      </el-dialog>

    <!-- 添加/编辑共用一个表单组件，首次打开任一时挂载，getValidationRule 仅触发一次；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <cache-form-page
        :model-value="formVisible"
        :rid="formRid"
        :atomic-service-list="listPage.getAtomicServices()"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <cache-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, nextTick, provide, reactive, ref, toRefs, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {Delete, Edit, Plus, RefreshLeft, Search, Tickets} from '@element-plus/icons-vue';
import {useI18n} from 'vue-i18n';
import CacheFormPage from './CacheFormPage.vue';
import CacheDetailPage from './CacheDetailPage.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import {BaseListPage} from '../../../components/pages/BaseListPage';
import {useListPageLayout} from '../../../components/pages/useListPageLayout';
import {useValidationI18nCacheProvider} from '../../../components/pages/useValidationI18nCacheProvider';
import {createColumnVisibilityConfig} from '../../../components/pages/columnVisibilityConfig';
import {useListPageFormSetup} from '../../../components/pages/useListPageFormSetup';
import {useColumnVisibilityOptions} from '../../../components/pages/useColumnVisibilityOptions';
import {useFixedLeftTableWidth} from '../../../components/pages/useFixedLeftTableWidth';
import {useFixedLeftRelayoutWatcher} from '../../../components/pages/useFixedLeftRelayoutWatcher';
import {useColumnOrderDrag} from '../../../components/pages/useColumnOrderDrag';
import {
  backendRequest,
  getApiFailureMessage,
  getApiResponseMessage,
  getThrownErrorMessage,
  isApiSuccessResponse,
  resolveApiFailureMessage,
  resolveApiResponseMessage,
  resolveThrownErrorMessage
} from '../../../utils/backendRequest';

/** 下拉菜单「管理」操作项的命令参数：操作编号 + 当前行数据 */
interface CacheCommandPayload {
  item: number;
  row: Record<string, unknown>;
}

/** 缓存列表页业务逻辑：搜索、表格、缓存管理操作（重载/驱逐等）及 key 弹窗 */
class CacheListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadAtomicServices();
    this.loadDicts(['cache_strategy'], 'sys').then(() => {
      this.state.strategyDictOptions = this.getDictItems('sys', 'cache_strategy');
    });
  }

  /** 初始化页面状态：搜索条件、key 弹窗可见性、当前操作与当前行 */
  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null,
        atomicServiceCode: null,
        strategyDictCode: null,
        active: true,
        hash: null,
        writeOnBoot: null,
        writeInTime: null,
      },
      keyDialogVisible: false,
      cacheKey: null as string | null,
      cacheOperation: null as string | null,
      currentRow: null as Record<string, unknown> | null,
      /** 缓存策略下拉选项（second 为 i18n key，表格/筛选用 t() 显示） */
      strategyDictOptions: [] as Array<{ first: string; second: string }>,
    };
  }

  /** 接口根路径，用于请求与路由 */
  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  /** 本页需加载的国际化：cacheList + cacheFormPage（弹窗共用） */
  protected getI18nConfig() {
    return [
      { i18nTypeDictCode: 'dict-item', namespaces: ['cache_strategy'], atomicServiceCode: 'sys' },
      { i18nTypeDictCode: 'error-msg', namespaces: ['cache'], atomicServiceCode: 'sys' },
    ];
  }

  /** 缓存行以 id 作为主键，编辑/详情/删除及管理操作均传 id */
  protected getRowId(row: Record<string, unknown>): string | number {
    if (row.id != null && row.id !== '') return row.id as string | number;
    return '';
  }

  /** 仅当勾选「仅启用」时传 active=true；不勾选时传 null，后端返回启用+未启用全部 */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      const p = params as Record<string, unknown>;
      p.active = sp.active === true ? true : null;
      // pagingSearch 不传 writeOnBoot、writeInTime（后端不按此筛选）
      delete p.writeOnBoot;
      delete p.writeInTime;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name', 'atomicServiceCode', 'strategyDictCode', 'hash'];
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
    // 踢除单 key / 踢除全部按后端约定使用 DELETE，其余缓存管理操作沿用默认方法。
    const method = operation === 'evict' || operation === 'evictAll' ? 'delete' : undefined;
    const params: Record<string, unknown> = { id: row?.id };
    if (operation !== 'reloadAll' && operation !== 'evictAll') {
      params.key = key;
    }
    const url = `sys/cache/management/${operation}`;
    try {
      const result = await backendRequest({ url, method, params });
      if (isApiSuccessResponse(result)) {
        let message: string;
        if (operation === 'existsKey') {
          const exists = (result as { data?: unknown })?.data === true;
          message = exists ? '指定的缓存key存在' : '指定的缓存key不存在';
        } else {
          message =
            await resolveApiResponseMessage(result) ?? getApiResponseMessage(result) ?? ((result as { data?: string })?.data ?? '');
        }
        ElMessage.info(message);
      } else {
        ElMessage.error(
          await resolveApiFailureMessage(result)
          || getApiFailureMessage(result)
          || await resolveApiResponseMessage(result)
          || getApiResponseMessage(result)
          || this.tr('cacheList.messages.requestOperationFailed')
        );
      }
    } catch (error) {
      ElMessage.error(
        await resolveThrownErrorMessage(error)
        || getThrownErrorMessage(error)
        || this.tr('cacheList.messages.requestOperationFailed')
      );
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
    s.cacheOperation = 'evictAll';
    this.commitCacheOperation(null);
  }

  /** 检查 key 是否存在：记录当前行与操作，打开 key 输入弹窗 */
  private isExists(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'existsKey';
    s.keyDialogVisible = true;
  }

  /** 查看 key 对应 value 信息：记录当前行与操作，打开 key 输入弹窗 */
  private valueInfo(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'getValueJson';
    s.keyDialogVisible = true;
  }

  /** 更新启用状态前提示「重启后生效」，再调用基类请求 */
  protected async doUpdateActive(row: Record<string, unknown>): Promise<void> {
    ElMessage.info(this.tr('cacheList.messages.activeChangeTakesEffectAfterRestart'));
    await super.doUpdateActive(row);
  }
}

/** 名称搜索框：镜像 span 宽度 + 该值作为 input 的 min-width 余量 */
const NAME_INPUT_PADDING = 40;
/** 原子服务下拉：镜像 span 宽度 + 该值作为 select 的 min-width 余量 */
const SELECT_INPUT_PADDING = 50;
/** 操作列「固定展开」在 localStorage 的 key */
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'cacheList.operationColumnPinned';
/** 栏位可见性持久化的 localStorage key */
const COLUMN_VISIBILITY_STORAGE_KEY = 'cacheList.visibleColumns';
/** 栏位顺序持久化的 localStorage key */
const COLUMN_ORDER_STORAGE_KEY = 'cacheList.columnOrder';
/** 可参与排序的列 key（与栏位可见性一致） */
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  allColumnKeys: ALL_COLUMN_KEYS,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig([
  'atomicServiceCode',
  'strategyDictCode',
  'active',
  'hash',
  'writeOnBoot',
  'writeInTime',
  'ttl',
  'remark',
]);

export default defineComponent({
  name: 'CacheListPage',
  components: {
    CacheFormPage,
    CacheDetailPage,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new CacheListPage(props, context)) as CacheListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const state = listPage.state as Record<string, unknown>;
    const cacheKeyInputRef = ref<{ $el?: HTMLElement; input?: HTMLInputElement; select?: () => void; focus?: () => void } | null>(null);
    const {
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
    } = useListPageFormSetup({ state, listPage });
    function submitCacheOperationFromInput() {
      const value = state.cacheKey;
      if (value == null || String(value).trim() === '') return;
      listPage.commitCacheOperation(String(value));
    }
    watch(
      () => state.keyDialogVisible,
      (visible) => {
        if (!visible) return;
        nextTick(() => {
          const input = cacheKeyInputRef.value;
          input?.focus?.();
          window.setTimeout(() => {
            const nativeInput =
              input?.input
              ?? input?.$el?.querySelector?.('input')
              ?? null;
            nativeInput?.focus?.();
            const value = state.cacheKey;
            if (value != null && String(value).trim() !== '') {
              nativeInput?.select?.();
            }
          }, 0);
        });
      }
    );
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const FIXED_LEFT_TOTAL_WIDTH = 439;
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
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
      const items = listPage.getAtomicServices();
      const found = items.find((p) => p.code === code);
      return found ? found.name : subSysPlaceholder.value;
    });
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
      onAfterMount: () => {
        updateNameInputWidth();
        updateSubSysSelectWidth();
      },
      onAfterPersist: () => {
        updateNameInputWidth();
        updateSubSysSelectWidth();
      },
    });
    function updateSubSysSelectWidth() {
      nextTick(() => {
        const el = subSysSelectMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + SELECT_INPUT_PADDING;
        subSysSelectWidth.value = w;
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
    const RESERVED_WIDTH_LEFT = 439;
    const RESERVED_WIDTH_RIGHT = 180;
    const cacheListColumnLabel = (k: string) => t('cacheList.columns.' + (k === 'atomicServiceCode' ? 'subSystem' : k === 'strategyDictCode' ? 'strategy' : k === 'ttl' ? 'ttlSeconds' : k === 'hash' ? 'hash' : k));
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => cacheListColumnLabel(key),
        sortable: key === 'atomicServiceCode',
        getCellText:
          key === 'atomicServiceCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.atomicServiceCode)
            : key === 'strategyDictCode'
              ? (row: Record<string, unknown>) => {
                  const code = row.strategyDictCode;
                  if (!code) return '';
                  const opts = (listPage.state.strategyDictOptions || []) as Array<{ first: string; second: string }>;
                  const item = opts.find((o) => o.first === code);
                  return item ? t(item.second) : String(code);
                }
              : key === 'active' || key === 'hash' || key === 'writeOnBoot' || key === 'writeInTime'
                ? (row: Record<string, unknown>) => listPage.formatBoolean(row[key], t('cacheList.common.yes'), t('cacheList.common.no'))
                : key === 'ttl'
                  ? (row: Record<string, unknown>) => String(row.ttl ?? '')
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
    /** 栏位可见性勾选与 listPage 状态双向同步 */
    const visibleColumnKeys = computed<string[]>({
      get: () => ((listPage.state as Record<string, unknown>).visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    /** 策略列表头筛选选项：字典项 value 为 i18n key，用 t() 显示 */
    const strategyFilters = computed(() => {
      const items = (listPage.state.strategyDictOptions || []) as Array<{ first: string; second: string }>;
      if (items.length > 0) {
        return items.map((item) => ({ text: t(item.second), value: item.first }));
      }
      return [
        { text: t('cache_strategy.SINGLE_LOCAL'), value: 'SINGLE_LOCAL' },
        { text: t('cache_strategy.REMOTE'), value: 'REMOTE' },
        { text: t('cache_strategy.LOCAL_REMOTE'), value: 'LOCAL_REMOTE' },
      ];
    });
    /** 布尔列（启用/写缓存等）表头筛选：是/否 */
    const boolFilters = computed(() => listPage.createBooleanFilters(t('cacheList.common.yes'), t('cacheList.common.no')));
    const columnKeyToLabel: Record<string, () => string> = {
      atomicServiceCode: () => t('cacheList.columns.subSystem'),
      strategyDictCode: () => t('cacheList.columns.strategy'),
      active: () => t('cacheList.columns.active'),
      hash: () => t('cacheList.columns.hash'),
      writeOnBoot: () => t('cacheList.columns.writeOnBoot'),
      writeInTime: () => t('cacheList.columns.writeInTime'),
      ttl: () => t('cacheList.columns.ttlSeconds'),
      remark: () => t('cacheList.columns.remark'),
    };
    /** 栏位可见性面板中的可选项（按当前顺序），支持拖拽排序 */
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('cacheList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: (key) => columnKeyToLabel[key]?.() ?? key,
    });

    /** 将布尔值格式化为「是/否」文案 */
    function formatBoolText(value: unknown): string {
      return listPage.formatBoolean(value, t('cacheList.common.yes'), t('cacheList.common.no'));
    }

    /** 判断某列是否在「栏位可见性」中勾选 */
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    /** 表格列筛选变化时同步到 searchParams 并请求列表 */
    function       handleTableFilterChange(filters: Record<string, Array<string | number | boolean>>) {
      listPage.applyRemoteTableFilters(filters, {
        strategyDictCode: { paramName: 'strategyDictCode', emptyValue: null },
        active: listPage.createBooleanFilterMapping('active'),
        hash: listPage.createBooleanFilterMapping('hash'),
        writeOnBoot: listPage.createBooleanFilterMapping('writeOnBoot'),
        writeInTime: listPage.createBooleanFilterMapping('writeInTime'),
      });
    }

    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);
    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      hasFormEverOpened,
      formVisible,
      formRid,
      onFormClose,
      onFormResponse,
      cacheKeyInputRef,
      submitCacheOperationFromInput,
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
      columnWidths,
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
.cache-list-page .list-page-toolbar .toolbar-cell.toolbar-strategy,
.cache-list-page .list-page-toolbar .toolbar-cell.toolbar-hash {
  margin-right: 8px;
}
.cache-list-page .list-page-toolbar .toolbar-strategy .search-select-input,
.cache-list-page .list-page-toolbar .toolbar-hash .search-select-input {
  width: 100%;
  min-width: 0;
}
.cache-list-page .list-page-toolbar .toolbar-strategy :deep(.el-input__wrapper),
.cache-list-page .list-page-toolbar .toolbar-hash :deep(.el-input__wrapper) {
  min-width: 0;
}
/* 穿透 Element 表格/分页内部类，需保留在组件内使用 :deep */
:deep(.el-table .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 22px;
}

/* 启用列为开关，不参与省略号，避免列窄时在开关右侧出现 … */
:deep(.el-table th.col-cache-active-switch),
:deep(.el-table td.col-cache-active-switch) {
  overflow: visible;
}
:deep(.el-table th.col-cache-active-switch .cell),
:deep(.el-table td.col-cache-active-switch .cell) {
  overflow: visible;
  text-overflow: clip;
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
/* 表头列名统一颜色，不区分是否带筛选 */
:deep(.el-table th .cell),
:deep(.el-table th .column-header-draggable) {
  color: var(--el-table-header-text-color, var(--el-text-color-regular, #606266)) !important;
}
</style>
