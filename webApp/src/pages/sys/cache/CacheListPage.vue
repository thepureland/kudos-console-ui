<!--
 * Cache list: filter by cache name, atomic service, cache strategy, active-only, etc. Table supports column visibility, operation-column fold, column drag-reordering, with cache management actions (reload/evict, etc.), multilingual.
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="cache-list-page list-page-common">
    <!-- List page layout: toolbar + table area (column visibility / operation-column fold) + pagination -->
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
      <!-- Search bar: name / atomic service / strategy / hash storage / active-only + search, reset -->
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
      <!-- Column visibility panel: checkboxes control show/hide of each column (column order is adjusted by dragging the header) -->
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
      <!-- Toolbar above the table: add, delete (layout provided by ListPageLayout + list-page-common) -->
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
      <!-- Cache list table: selection / index / name / atomic service / strategy / active / write-on-boot / write-in-time / TTL / remark + operation column (edit / delete / detail / manage dropdown) -->
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
          min-width="68"
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
      <!-- Pagination: total, page size, prev / pager / next, jumper -->
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

    <!-- Cache operation key input dialog: used when reload / evict / check existence / view value requires entering a key -->
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

    <!-- The add/edit views share one form component, mounted on first open; getValidationRule is triggered only once. v-if/v-show is placed on a native div to avoid the ElDialog non-element root directive warning. -->
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
import {computed, defineComponent, nextTick,  reactive, ref, toRefs, watch} from 'vue';
import {ElMessage, ElMessageBox} from 'element-plus';
import {Delete, Edit, Plus, RefreshLeft, Search, Tickets} from '@element-plus/icons-vue';
import {useI18n} from 'vue-i18n';
import CacheFormPage from './CacheFormPage.vue';
import CacheDetailPage from './CacheDetailPage.vue';
import { BaseListPage } from '../../../components/pages/core';
import type { ListPageContext, ListPageProps, PageContext, PageProps } from '../../../components/pages/core';
import { useListPageLayout, useTableAutoWidthContext, useValidationI18nCacheProvider, createColumnVisibilityConfig, useListPageFormSetup, useListPageVisibilityState, useColumnVisibilityOptions, useVisibleColumnKeys, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useColumnOrderDrag, createI18nColumnLabelGetter } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';
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

/** Command payload for the "Manage" dropdown action items: action code + current row data */
interface CacheCommandPayload {
  item: number;
  row: Record<string, unknown>;
}

/** Cache list page business logic: search, table, cache management actions (reload / evict, etc.) and key input dialog */
class CacheListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
    this.loadAtomicServices();
    this.loadDicts(['cache_strategy'], 'sys').then(() => {
      this.state.strategyDictOptions = this.getDictItems('sys', 'cache_strategy');
    });
  }

  /** Initialize page state: search params, key dialog visibility, current operation, current row */
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
      /** Cache strategy dropdown options (second is an i18n key, table/filter display via t()) */
      strategyDictOptions: [] as Array<{ first: string; second: string }>,
    };
  }

  /** API root path, used for requests and routing */
  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  /** i18n required for this page: cacheList + cacheFormPage (shared dialog) */
  protected getI18nConfig() {
    return [
      { i18nTypeDictCode: 'dict-item', namespaces: ['cache_strategy'], atomicServiceCode: 'sys' },
      { i18nTypeDictCode: 'error-msg', namespaces: ['cache'], atomicServiceCode: 'sys' },
    ];
  }

  /** Cache rows use id as primary key; edit / detail / delete / management actions all pass id. */
  protected getRowId(row: Record<string, unknown>): string | number {
    if (row.id != null && row.id !== '') return row.id as string | number;
    return '';
  }

  /** When "active only" is checked, pass active=true; otherwise pass null and backend returns both active and inactive. */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      const p = params as Record<string, unknown>;
      p.active = sp.active === true ? true : null;
      // pagingSearch does not pass writeOnBoot or writeInTime (backend does not filter by them)
      delete p.writeOnBoot;
      delete p.writeInTime;
    }
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name', 'atomicServiceCode', 'strategyDictCode', 'hash'];
  }

  /** Build dropdown command payload, used by el-dropdown's command. */
  commandValue(item: number, row: Record<string, unknown>): CacheCommandPayload {
    return { item, row };
  }

  /** Dispatch to the corresponding cache management action based on the command code. */
  operateCache(payload: CacheCommandPayload): void {
    const { item, row } = payload;
    if (item === 1) this.reload(row);
    else if (item === 2) this.reloadAll(row);
    else if (item === 3) this.evict(row);
    else if (item === 4) this.clear(row);
    else if (item === 5) this.isExists(row);
    else if (item === 6) this.valueInfo(row);
  }

  /** After the user confirms the key, submit the current cache operation (reload / evict / check existence, etc.). */
  commitCacheOperation(key: string | null): void {
    this.doCommitCacheOperation(key);
  }

  /** Call the backend cache management API, close the key dialog and show the result. */
  private async doCommitCacheOperation(key: string | null): Promise<void> {
    const state = this.state as Record<string, unknown>;
    state.keyDialogVisible = false;
    const row = state.currentRow as Record<string, unknown>;
    const operation = state.cacheOperation as string;
    // Evict single key / evict all use DELETE per the backend convention; the other cache management actions use the default method.
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
          message = exists ? this.tr('cacheList.messages.keyExists') : this.tr('cacheList.messages.keyNotExists');
        } else {
          const rawMessage =
            await resolveApiResponseMessage(result)
            ?? getApiResponseMessage(result)
            ?? (typeof (result as { data?: unknown })?.data === 'string' ? (result as { data?: string }).data : null)
            ?? '';
          const normalizedMessage = String(rawMessage).trim();
          message = normalizedMessage !== '' ? normalizedMessage : this.getDefaultCacheOperationSuccessMessage(operation);
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

  /** When the backend does not return a displayable message, give a local fallback success message per operation. */
  private getDefaultCacheOperationSuccessMessage(operation: string): string {
    const actionKeyMap: Record<string, string> = {
      reload: 'cacheList.actions.reload',
      reloadAll: 'cacheList.actions.reloadAll',
      evict: 'cacheList.actions.evict',
      evictAll: 'cacheList.actions.clearAll',
      existsKey: 'cacheList.actions.checkKeyExists',
      getValueJson: 'cacheList.actions.getValueInfo',
    };
    const actionKey = actionKeyMap[operation];
    const actionText = actionKey ? this.tr(actionKey) : this.tr('cacheList.actions.manage');
    return this.tr('cacheList.messages.operationSucceeded', { action: actionText });
  }

  /** Reload single key: record current row and operation, open the key input dialog. */
  private reload(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'reload';
    s.keyDialogVisible = true;
  }

  /** Reload the whole cache: no key required, submit directly. */
  private reloadAll(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'reloadAll';
    this.commitCacheOperation(null);
  }

  /** Evict single key: record current row and operation, open the key input dialog. */
  private evict(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'evict';
    s.keyDialogVisible = true;
  }

  /** Clear the whole cache: destructive, so ask for confirmation before submitting. */
  private async clear(row: Record<string, unknown>): Promise<void> {
    const confirmResult = await ElMessageBox.confirm(
      this.tr('cacheList.messages.confirmClearAll', { name: String(row?.name ?? '') }),
      this.tr('listPage.confirmTitle'),
      { confirmButtonText: this.tr('listPage.confirmButton'), cancelButtonText: this.tr('listPage.cancelButton'), type: 'warning' }
    ).catch((err: unknown) => err);
    if (confirmResult !== 'confirm') return;
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'evictAll';
    this.commitCacheOperation(null);
  }

  /** Check whether the key exists: record current row and operation, open the key input dialog. */
  private isExists(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'existsKey';
    s.keyDialogVisible = true;
  }

  /** View the value info for a key: record current row and operation, open the key input dialog. */
  private valueInfo(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    s.currentRow = row;
    s.cacheOperation = 'getValueJson';
    s.keyDialogVisible = true;
  }

  /** Before updating active status, show "takes effect after restart"; then call the base class request. */
  protected async doUpdateActive(row: Record<string, unknown>): Promise<void> {
    ElMessage.info(this.tr('cacheList.messages.activeChangeTakesEffectAfterRestart'));
    await super.doUpdateActive(row);
  }
}

/** Name search input: mirror-span width + this value as the input's min-width margin. */
const NAME_INPUT_PADDING = 40;
/** Atomic service dropdown: mirror-span width + this value as the select's min-width margin. */
const SELECT_INPUT_PADDING = 50;
/** localStorage key for "operation column pinned open". */
const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'cacheList.operationColumnPinned';
/** localStorage key for persisting column visibility. */
const COLUMN_VISIBILITY_STORAGE_KEY = 'cacheList.visibleColumns';
/** localStorage key for persisting column order. */
const COLUMN_ORDER_STORAGE_KEY = 'cacheList.columnOrder';
/** Column keys eligible for sorting (consistent with column visibility). */
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
  setup(props: ListPageProps, context: ListPageContext) {
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
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
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
    const cacheListColumnLabel = createI18nColumnLabelGetter(t, 'cacheList.columns', {
      atomicServiceCode: 'subSystem',
      strategyDictCode: 'strategy',
      ttl: 'ttlSeconds',
    });
    // RESERVED_WIDTH_LEFT, RESERVED_WIDTH_RIGHT are echoed-back input constants (not forwarded to template).
    // autoWidthColumns and tableDataRef are reactive refs used internally by the composable's watchers.
    const {
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 439,
      reservedWidthRight: 180,
      createAutoWidthColumns: () =>
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
    });
    /** Column visibility checkboxes are two-way synced with listPage state. */
    const visibleColumnKeys = useVisibleColumnKeys(listPage);
    /** Strategy column header filter options: dict item value is an i18n key, displayed via t(). */
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
    /** Boolean column (active / writeOnBoot, etc.) header filter: Yes / No. */
    const boolFilters = computed(() => listPage.createBooleanFilters(t('cacheList.common.yes'), t('cacheList.common.no')));
    /** Options in the column visibility panel (in current order), supports drag reordering. */
    const columnVisibilityOptions = useColumnVisibilityOptions({
      indexColumnKey: INDEX_COLUMN_KEY,
      getIndexLabel: () => t('cacheList.columns.index'),
      getColumnKeys: () => orderedColumnKeys.value,
      getColumnLabel: cacheListColumnLabel,
    });

    /** Format a boolean as "Yes / No" text. */
    function formatBoolText(value: unknown): string {
      return listPage.formatBoolean(value, t('cacheList.common.yes'), t('cacheList.common.no'));
    }

    /** When table column filters change, sync to searchParams and reload the list. */
    function handleTableFilterChange(filters: Record<string, Array<string | number | boolean>>) {
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
/* Pierce Element table/pagination internal classes; must use :deep inside the component. */
:deep(.el-table .cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 22px;
}

/* The active column is a switch and is excluded from ellipsis to avoid "…" appearing next to it when the column is narrow. */
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

/* Fixed left columns: lock cell and left fixed block total width to avoid being widened when column visibility changes. */
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

/* Sortable column header: only show the column name, draggable, no Element built-in filter/sort icons. */
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
/* Header currently being dragged: semi-transparent + light background to make clear "this is the column being dragged". */
:deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
/* Current drop target: left primary-color vertical bar; release to drop before that column. */
:deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
/* In draggable column headers, keep only the column name: first hide everything in the cell, then show only our column name. */
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
/* Uniform header column name color, regardless of whether the column has a filter. */
:deep(.el-table th .cell),
:deep(.el-table th .column-header-draggable) {
  color: var(--el-table-header-text-color, var(--el-text-color-regular, #606266)) !important;
}
</style>
