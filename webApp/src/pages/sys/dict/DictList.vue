<!--
 * 字典列表：左侧字典类型树、右侧表格，支持工具栏筛选、栏位可见性、分页，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="dict-list-page list-page-common">
    <el-card class="dict-list-card">
      <div ref="splitContainerRef" class="dict-list-split">
        <div class="resource-tree-col" :style="{ width: treePanelWidthPercent + '%' }">
          <div class="resource-tree-wrap">
            <el-tree
              ref="tree"
              :props="dictTreeProps"
              :load="loadTree"
              :expand-on-click-node="false"
              node-key="id"
              accordion
              lazy
              @node-expand="expandTreeNode"
              @node-click="(nodeData, node) => clickTreeNode(nodeData, node)"
            >
              <template #default="{ node, data }">
                <span>{{ getTreeNodeLabel(data) }}</span>
              </template>
            </el-tree>
          </div>
        </div>
        <div class="dict-list-resizer" @mousedown="startTreeResize" />
        <div class="resource-table-col">
          <list-page-layout
            :table-wrap-ref="listLayoutRefs.tableWrapRef"
            :list-page="listPage"
            :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
            :column-panel-show-text="t('dictList.actions.showColumnPanel')"
            :column-panel-hide-text="t('dictList.actions.hideColumnPanel')"
            :operation-column-show-text="t('dictList.actions.showOperationColumn')"
            :operation-column-hide-text="t('dictList.actions.hideOperationColumn')"
            @table-wrap-mounted="onTableWrapMounted"
          >
            <template #toolbar>
              <div class="toolbar-cell toolbar-subsys toolbar-module-large">
                <el-select
                  v-model="searchParams.module"
                  :placeholder="t('dictList.placeholders.module')"
                  clearable
                  filterable
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
              <div class="toolbar-cell toolbar-subsys toolbar-dict-type">
                <el-input
                  v-model="searchParams.dictType"
                  :placeholder="t('dictList.placeholders.dictType')"
                  clearable
                  class="search-select-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.dictName"
                  :placeholder="t('dictList.placeholders.dictName')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.itemCode"
                  :placeholder="t('dictList.placeholders.itemCode')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.itemName"
                  :placeholder="t('dictList.placeholders.itemName')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                />
              </div>
              <div class="toolbar-extra">
                <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
                  {{ t('dictList.actions.activeOnly') }}
                </el-checkbox>
              </div>
              <div class="toolbar-buttons">
                <el-button type="primary" round @click="search">
                  <el-icon><Search /></el-icon>
                  {{ t('dictList.actions.search') }}
                </el-button>
                <el-button type="primary" round @click="resetSearchFields">
                  <el-icon><RefreshLeft /></el-icon>
                  {{ t('dictList.actions.reset') }}
                </el-button>
              </div>
            </template>
            <template #tableToolbar>
              <el-button type="success" @click="openAddDialog">
                <el-icon><Plus /></el-icon>
                {{ t('dictList.actions.addDict') }}
              </el-button>
              <el-button type="success" @click="openAddItemDialog">
                <el-icon><Plus /></el-icon>
                {{ t('dictList.actions.addDictItem') }}
              </el-button>
              <el-button type="danger" @click="multiDelete">
                <el-icon><Delete /></el-icon>
                {{ t('dictList.actions.delete') }}
              </el-button>
            </template>
            <template #columnVisibilityPanel>
              <div class="column-visibility-title">{{ t('dictList.actions.columnVisibility') }}</div>
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
                <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" />
                <el-table-column
                  v-if="isColumnVisible('dictType')"
                  :label="t('dictList.columns.dictType')"
                  prop="dictType"
                  :min-width="columnWidths['dictType'] ?? 120"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('dictName')"
                  :label="t('dictList.columns.dictName')"
                  prop="dictName"
                  :min-width="columnWidths['dictName'] ?? 120"
                />
                <el-table-column
                  v-if="isColumnVisible('atomicServiceCode')"
                  :label="t('dictList.columns.atomicServiceCode')"
                  prop="atomicServiceCode"
                  :min-width="columnWidths['atomicServiceCode'] ?? 100"
                  sortable="custom"
                >
                  <template #default="scope">
                    {{ transAtomicService(scope.row.atomicServiceCode) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('itemCode') && !searchParams.isDict"
                  :label="t('dictList.columns.itemCode')"
                  prop="itemCode"
                  :min-width="columnWidths['itemCode'] ?? 100"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('itemName') && !searchParams.isDict"
                  :label="t('dictList.columns.itemName')"
                  prop="itemName"
                  :min-width="columnWidths['itemName'] ?? 120"
                />
                <el-table-column
                  v-if="isColumnVisible('parentCode') && !searchParams.isDict"
                  :label="t('dictList.columns.parentCode')"
                  prop="parentCode"
                  :min-width="columnWidths['parentCode'] ?? 100"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('orderNum') && !searchParams.isDict"
                  :label="t('dictList.columns.orderNum')"
                  prop="orderNum"
                  :min-width="columnWidths['orderNum'] ?? 80"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('remark') && searchParams.isDict"
                  :label="t('dictList.columns.remark')"
                  prop="remark"
                  :min-width="columnWidths['remark'] ?? 120"
                  show-overflow-tooltip
                />
                <el-table-column
                  v-if="isColumnVisible('active')"
                  :label="t('dictList.columns.active')"
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
                  :label="t('dictList.columns.operation')"
                  align="center"
                  fixed="right"
                  min-width="160"
                  class-name="operation-column"
                >
                  <template #default="scope">
                    <el-tooltip :content="t('dictList.actions.edit')" placement="top" :enterable="false">
                      <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                        <Edit />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip :content="t('dictList.actions.delete')" placement="top" :enterable="false">
                      <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                        <Delete />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip :content="t('dictList.actions.detail')" placement="top" :enterable="false">
                      <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                        <Tickets />
                      </el-icon>
                    </el-tooltip>
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
        </div>
      </div>

      <dict-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAddDict" :atomic-service-code="searchParams.module" />
      <dict-item-add-edit v-if="addItemDialogVisible" v-model="addItemDialogVisible" @response="afterAddDictItem" :module="searchParams.module" :dict-type="searchParams.dictType" />
      <dict-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
      <dict-item-add-edit v-if="editItemDialogVisible" v-model="editItemDialogVisible" @response="afterEdit" :rid="rid" :module="searchParams.module" :dict-type="searchParams.dictType" />
      <dict-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
      <dict-item-detail v-if="itemDetailDialogVisible" v-model="itemDetailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, provide, watch } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { i18n } from '../../../i18n';
import DictAddEdit from './DictAddEdit.vue';
import DictItemAddEdit from './DictItemAddEdit.vue';
import DictDetail from './DictDetail.vue';
import DictItemDetail from './DictItemDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';
import { loadMessagesForConfig } from '../../../i18n';

function tr(key: string): string {
  return i18n.global.t(key) as string;
}

class DictListPage extends BaseListPage {
  private tree: { value?: { remove: (obj: { id: string }) => void } };

  constructor(
    props: Record<string, unknown>,
    context: { emit: (event: string, ...args: unknown[]) => void },
    tree: { value?: { remove: (obj: { id: string }) => void } }
  ) {
    super(props, context);
    this.tree = tree;
    this.loadAtomicServices();
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      ...super.initBaseState(),
      dictTreeProps: { label: 'name' },
      searchParams: {
        parentId: null,
        level: null,
        module: null,
        dictType: null,
        dictName: null,
        itemCode: null,
        itemName: null,
        active: true,
        isDict: false,
      },
      searchSource: null as string | null,
      isDict: false,
      rootNode: null,
      rootResolve: null,
      itemDetailDialogVisible: false,
      addItemDialogVisible: false,
      editItemDialogVisible: false,
      /** 下次 search 时强制使用的 isDict（新增字典/字典项后刷新用），用后清空 */
      pendingSearchIsDict: null as boolean | null,
      /** 已加载过的 dict-item 国际化配置，用于切换语言时重载 */
      dictI18nLoaded: [] as Array<{ atomicServiceCode: string; dictType: string }>,
    };
  }

  /** dict=false（字典项）时请求走 sys/dictItem，否则 sys/dict */
  protected getRootActionPath(): string {
    return (this.state.searchParams as Record<string, unknown>)?.isDict === true ? 'sys/dict' : 'sys/dictItem';
  }

  protected getUpdateActiveUrl(): string {
    return this.getRootActionPath() + '/updateActive';
  }

  public openAddItemDialog: () => void;

  protected doOpenAddItemDialog(): void {
    (this.state as Record<string, unknown>).addItemDialogVisible = true;
  }

  protected getSearchUrl(): string {
    const base = this.getRootActionPath();
    return base === 'sys/dict' ? base + '/pagingSearchDict' : base + '/pagingSearchDictItem';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    const pending = (this.state as Record<string, unknown>).pendingSearchIsDict as boolean | null | undefined;
    if (pending !== null && pending !== undefined) {
      sp.isDict = pending;
      (this.state as Record<string, unknown>).pendingSearchIsDict = null;
    } else {
      const hasItemCondition = sp.dictType || sp.dictName || sp.itemCode || sp.itemName;
      sp.isDict = !hasItemCondition;
    }
    params.active = sp.active === true ? true : null;
    params.atomicServiceCode = sp.module ?? null;
    delete params.module;
    delete params.level;
    delete params.isDict;
    delete params.parentId;
    return params;
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['module', 'dictType', 'itemCode'];
  }

  public afterAddDict: (params: unknown) => void;
  public afterAddDictItem: (params: unknown) => void;

  protected doAfterAddDict(params: unknown): void {
    (this.state as Record<string, unknown>).pendingSearchIsDict = true;
    this.doAfterAdd(params);
    const sp = this.state.searchParams as Record<string, unknown>;
    const p = params as Record<string, unknown> | undefined;
    if (p?.atomicServiceCode != null) sp.module = p.atomicServiceCode;
    else if (p?.module != null) sp.module = p.module;
  }

  protected doAfterAddDictItem(params: unknown): void {
    (this.state as Record<string, unknown>).pendingSearchIsDict = false;
    this.doAfterAdd(params);
    const sp = this.state.searchParams as Record<string, unknown>;
    const p = params as Record<string, unknown> | undefined;
    if (p?.atomicServiceCode != null) sp.module = p.atomicServiceCode;
    else if (p?.module != null) sp.module = p.module;
  }

  protected createDeleteParams(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: this.getRowId(row),
      isDict: (row as { itemId?: unknown }).itemId == null,
    };
  }

  protected createBatchDeleteParams(): Record<string, boolean> {
    const params: Record<string, boolean> = {};
    for (const row of this.state.selectedItems as Array<Record<string, unknown>>) {
      params[String(this.getRowId(row))] = (row as { itemId?: unknown }).itemId == null;
    }
    return params;
  }

  /** 按 dict 标识分别请求 sys/dict/batchDelete 与 sys/dictItem/batchDelete */
  protected async doMultiDelete(): Promise<void> {
    const t = i18n.global.t.bind(i18n.global);
    const rows = this.state.selectedItems as Array<Record<string, unknown>> | undefined;
    if (!rows || rows.length === 0) {
      ElMessage.info(t('listPage.selectDataFirst') as string);
      return;
    }
    const confirmResult = await ElMessageBox.confirm(
      this.getBatchDeleteMessage(rows),
      t('listPage.confirmTitle') as string,
      { confirmButtonText: t('listPage.confirmButton') as string, cancelButtonText: t('listPage.cancelButton') as string, type: 'warning' }
    ).catch((err: unknown) => err);
    if (confirmResult !== 'confirm') return;

    const dictRows = rows.filter((r) => (r as { itemId?: unknown }).itemId == null);
    const itemRows = rows.filter((r) => (r as { itemId?: unknown }).itemId != null);
    const dictIds = dictRows.map((r) => this.getRowId(r));
    const itemIds = itemRows.map((r) => this.getRowId(r));

    try {
      if (dictIds.length > 0) {
        const result = await backendRequest({ url: 'sys/dict/batchDelete', method: 'post', params: dictIds });
        if (result !== true && result?.data !== true) {
          ElMessage.error(t('listPage.deleteFailed') as string);
          return;
        }
      }
      if (itemIds.length > 0) {
        const result = await backendRequest({ url: 'sys/dictItem/batchDelete', method: 'post', params: itemIds });
        if (result !== true && result?.data !== true) {
          ElMessage.error(t('listPage.deleteFailed') as string);
          return;
        }
      }
      ElMessage.success(t('listPage.deleteSuccess') as string);
      this.doAfterDelete(this.getSelectedIds());
    } catch {
      ElMessage.error(t('listPage.deleteFailed') as string);
    }
  }

  protected async doSearch(): Promise<void> {
    (this.state as Record<string, unknown>).searchSource = 'button';
    await super.doSearch();
  }

  protected doAfterDelete(ids: unknown[]): void {
    super.doAfterDelete(ids);
    const t = this.tree?.value;
    if (t) {
      for (const id of ids) {
        t.remove({ id: String(id) });
      }
    }
  }

  protected doHandleSizeChange(newSize: number): void {
    this.state.pagination.pageSize = newSize;
    if ((this.state as Record<string, unknown>).searchSource === 'button') {
      this.search();
    } else {
      this.pagingSearch();
    }
  }

  protected doHandleCurrentChange(newCurrent: number): void {
    if (newCurrent) {
      this.state.pagination.pageNo = newCurrent;
      if ((this.state as Record<string, unknown>).searchSource === 'button') {
        this.search();
      } else {
        this.pagingSearch();
      }
    }
  }

  protected getDeleteMessage(row: Record<string, unknown>): string {
    return (row as { itemCode?: unknown }).itemCode == null
      ? tr('dictList.messages.deleteDictConfirm')
      : tr('dictList.messages.deleteItemConfirm');
  }

  protected getBatchDeleteMessage(rows: Record<string, unknown>[]): string {
    const existDict = rows.findIndex((row) => (row as { itemCode?: unknown }).itemCode == null) !== -1;
    if (existDict) {
      return tr('dictList.messages.batchDeleteConfirm') + super.getBatchDeleteMessage(rows);
    }
    return tr('dictList.messages.batchDeleteItemPrefix') + super.getBatchDeleteMessage(rows);
  }

  protected getRowId(row: Record<string, unknown>): string | number {
    const isDict = (row as { itemId?: unknown }).itemId == null;
    return isDict
      ? (row as { id?: string; dictId?: string }).id ?? (row as { dictId: string }).dictId
      : (row as { itemId: string }).itemId;
  }

  protected doHandleEdit(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).rid = this.getRowId(row);
    const sp = this.state.searchParams as Record<string, unknown>;
    const isDict = sp?.isDict === true;
    (this.state as Record<string, unknown>).isDict = isDict;
    const state = this.state as Record<string, unknown>;
    if (isDict) {
      state.editItemDialogVisible = false;
      state.editDialogVisible = true;
    } else {
      state.editDialogVisible = false;
      state.editItemDialogVisible = true;
    }
  }

  protected doHandleDetail(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).rid = this.getRowId(row);
    const isDict = (this.state.searchParams as Record<string, unknown>)?.isDict === true;
    const state = this.state as Record<string, unknown>;
    if (isDict) {
      state.itemDetailDialogVisible = false;
      state.detailDialogVisible = true;
    } else {
      state.detailDialogVisible = false;
      state.itemDetailDialogVisible = true;
    }
  }

  private setParamsForTree(node: { level: number; data?: { code: string; id: string }; parent?: { data?: { code: string } } }, expand: boolean): void {
    (this.state as Record<string, unknown>).searchSource = 'tree';
    const sp = this.state.searchParams as Record<string, unknown>;
    sp.level = node.level;
    if (node.level !== 0) {
      if (node.level === 1) {
        sp.module = (node.data as { code: string }).code;
        sp.dictType = null;
        sp.itemCode = null;
        sp.isDict = true;
      } else if (node.level === 2) {
        sp.module = (node.parent!.data as { code: string }).code;
        sp.dictType = (node.data as { code: string }).code;
        sp.itemCode = null;
        sp.isDict = !expand;
      } else {
        sp.module = DictListPage.getAtomicServiceByNode(node);
        sp.dictType = DictListPage.getDictTypeByNode(node);
        if (!expand) {
          sp.itemCode = (node.data as { code: string }).code;
        }
        sp.isDict = false;
      }
      sp.parentId = node.level === 1 ? (node.data as { code: string }).code : (node.data as { id: string }).id;
    }
  }

  private static getAtomicServiceByNode(node: { level: number; parent?: { level: number; data?: { code: string } } }): string {
    let n = node;
    while (n.level !== 1) {
      n = n.parent!;
    }
    return (n as { data: { code: string } }).data.code;
  }

  private static getDictTypeByNode(node: { level: number; parent?: { level: number; data?: { code: string } } }): string {
    let n = node;
    while (n.level !== 2) {
      n = n.parent!;
    }
    return (n as { data: { code: string } }).data.code;
  }

  /** 第三层及以下树节点名称：优先用 dict-item 国际化 t(dictType.itemCode)，否则用 itemName 或 code。需先 loadMessagesForConfig dict-item+dictType。 */
  private static transDictItemName(dictType: string, itemCode: string, itemName: string): string {
    if (!itemCode) return itemName || '';
    const key = dictType + '.' + itemCode;
    const translated = i18n.global.t(key) as string;
    return (translated !== key ? translated : null) ?? itemName ?? itemCode;
  }

  public loadTree: (node: unknown, resolve: (data: unknown[]) => void) => void;

  private async doLoadTree(node: { level: number; data?: { code: string; id: string } }, resolve: (data: unknown[]) => void): Promise<void> {
    if (node.level === 0) {
      (this.state as Record<string, unknown>).rootNode = node;
      (this.state as Record<string, unknown>).rootResolve = resolve;
    }
    this.setParamsForTree(node as Parameters<InstanceType<typeof DictListPage>['setParamsForTree']>[0], true);
    const sp = this.state.searchParams as Record<string, unknown>;
    const activeOnly = sp.active === true;

    try {
      if (node.level === 0) {
        if (this.getAtomicServices().length === 0) {
          await this.loadAtomicServices();
        }
        const items = this.getAtomicServices();
        const nodes = items.map((item: { code: string; name: string }) => ({
          id: item.code,
          code: item.code,
          name: item.name,
        }));
        resolve(nodes);
        return;
      }

      if (node.level === 1) {
        const atomicServiceCode = (node.data as { code: string }).code;
        const result = await backendRequest({
          url: 'sys/dict/getDictTypesByAtomicServiceCode',
          method: 'get',
          params: { atomicServiceCode, activeOnly },
        });
        const raw = result != null && typeof result === 'object' && !Array.isArray(result)
          ? (result.data != null && typeof result.data === 'object' ? result.data : result)
          : {};
        const map = raw as Record<string, string>;
        const nodes = Object.entries(map).map(([id, dictType]) => ({
          id,
          code: dictType,
          name: dictType,
        }));
        resolve(nodes);
        return;
      }

      if (node.level === 2) {
        const atomicServiceCode = DictListPage.getAtomicServiceByNode(node as { level: number; parent?: { level: number; data?: { code: string } } });
        const dictType = (node.data as { code: string }).code;
        const loaded = this.state.dictI18nLoaded as Array<{ atomicServiceCode: string; dictType: string }>;
        if (!loaded.some((c) => c.atomicServiceCode === atomicServiceCode && c.dictType === dictType)) {
          loaded.push({ atomicServiceCode, dictType });
        }
        await loadMessagesForConfig([{ i18nTypeDictCode: 'dict-item', namespaces: [dictType], atomicServiceCode }]);
        const result = await backendRequest({
          url: 'sys/dictItem/getDirectChildrenOfDict',
          method: 'get',
          params: { atomicServiceCode, dictType, activeOnly },
        });
        const list = Array.isArray(result) ? result : (result?.data != null && Array.isArray(result.data) ? result.data : []);
        const nodes = list.map((item: { id: string; itemCode?: string; itemName?: string }) => {
          const code = item.itemCode ?? '';
          return {
            id: item.id,
            code,
            nameKey: dictType + '.' + code,
            name: item.itemName ?? code,
          };
        });
        resolve(nodes);
        return;
      }

      const atomicServiceCode = DictListPage.getAtomicServiceByNode(node as { level: number; parent?: { level: number; data?: { code: string } } });
      const dictType = DictListPage.getDictTypeByNode(node as { level: number; parent?: { level: number; data?: { code: string } } });
      const itemCode = (node.data as { code: string }).code;
      const result = await backendRequest({
        url: 'sys/dictItem/getDirectChildrenOfItem',
        method: 'get',
        params: { atomicServiceCode, dictType, itemCode, activeOnly },
      });
      const list = Array.isArray(result) ? result : (result?.data != null && Array.isArray(result.data) ? result.data : []);
      const nodes = list.map((item: { id: string; itemCode?: string; itemName?: string }) => {
        const code = item.itemCode ?? '';
        return {
          id: item.id,
          code,
          nameKey: dictType + '.' + code,
          name: item.itemName ?? code,
        };
      });
      resolve(nodes);
    } catch {
      ElMessage.error(tr('dictList.messages.loadTreeFailed'));
    }
  }

  public expandTreeNode: (nodeData: unknown, node: unknown) => void;

  private doExpandTreeNode(nodeData: unknown, node: { data?: unknown }): void {
    if (node.data) {
      this.setParamsForTree(node as Parameters<InstanceType<typeof DictListPage>['setParamsForTree']>[0], true);
      this.pagingSearch();
    }
  }

  public clickTreeNode: (nodeData: Record<string, unknown>, node: { level: number; data?: { id: string; code: string } }) => void;

  private async doClickTreeNode(nodeData: Record<string, unknown>, node: { level: number; data?: { id: string; code: string } }): Promise<void> {
    if (node.level === 1) return;
    (this.state as Record<string, unknown>).searchSource = 'tree';
    this.setParamsForTree(node as Parameters<InstanceType<typeof DictListPage>['setParamsForTree']>[0], false);
    const params = { id: nodeData.id };
    const url = node.level === 2 ? 'sys/dict/getDict' : 'sys/dictItem/getDictItem';
    try {
      const result = await backendRequest({ url, params });
      if (result != null && typeof result === 'object') {
        this.state.tableData = [result];
        this.state.pagination.total = 1;
      } else {
        ElMessage.error(tr('dictList.messages.loadFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadFailed'));
    }
  }

  /**
   * 树节点展开时 pagingSearchDict 的请求参数，按层级独立构造（不再传 dict，由 URL 区分）：
   * 第一层：active、atomicServiceCode、pageNo、pageSize
   * 第二层：active、atomicServiceCode、dictType、pageNo、pageSize
   * 第三层及之后：active、parentId、pageNo、pageSize
   */
  private buildPagingSearchDictParams(): Record<string, unknown> {
    const sp = this.state.searchParams as Record<string, unknown>;
    const level = sp.level as number | undefined;
    const active = sp.active === true ? true : null;
    const pageNo = this.state.pagination?.pageNo ?? 1;
    const pageSize = this.state.pagination?.pageSize ?? 10;
    if (level === 1) {
      return {
        active,
        atomicServiceCode: sp.module ?? null,
        pageNo,
        pageSize,
      };
    }
    if (level === 2) {
      return {
        active,
        atomicServiceCode: sp.module ?? null,
        dictType: sp.dictType ?? null,
        pageNo,
        pageSize,
      };
    }
    return {
      active,
      parentId: sp.parentId ?? null,
      pageNo,
      pageSize,
    };
  }

  private async pagingSearch(): Promise<void> {
    (this.state as Record<string, unknown>).searchSource = 'tree';
    const params = this.buildPagingSearchDictParams();
    if (this.state.sort.orderProperty) {
      (params as Record<string, unknown>).orders = [{ property: this.state.sort.orderProperty, direction: this.state.sort.orderDirection }];
    }
    const level = (this.state.searchParams as Record<string, unknown>).level as number | undefined;
    const url = level === 1 ? 'sys/dict/pagingSearchDict' : 'sys/dictItem/pagingSearchDictItem';
    try {
      const result = await backendRequest({ url, method: 'post', params });
      if (result != null && typeof result === 'object' && 'data' in result && 'totalCount' in result) {
        this.state.tableData = (result as { data: unknown[] }).data ?? [];
        this.state.pagination.total = (result as { totalCount: number }).totalCount ?? 0;
      } else {
        ElMessage.error(tr('dictList.messages.loadFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadFailed'));
    }
  }

  public override restorePersistedListState(): void {
    super.restorePersistedListState();
    const sp = this.state.searchParams as Record<string, unknown>;
    if (sp) {
      sp.active = true;
    }
  }

  private convertThis(): void {
    super.convertThis();
    this.afterAddDict = (params: unknown) => this.doAfterAddDict(params);
    this.afterAddDictItem = (params: unknown) => this.doAfterAddDictItem(params);
    this.openAddItemDialog = () => this.doOpenAddItemDialog();
    this.loadTree = (node, resolve) => this.doLoadTree(node as Parameters<InstanceType<typeof DictListPage>['doLoadTree']>[0], resolve as (data: unknown[]) => void);
    this.expandTreeNode = (nodeData, node) => this.doExpandTreeNode(nodeData, node);
    this.clickTreeNode = (nodeData, node) => this.doClickTreeNode(nodeData as Record<string, unknown>, node);
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'dictList.operationColumnPinned';
const DICT_LIST_STATE_STORAGE_KEY = 'dictList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'dictList.visibleColumns';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['dictType', 'dictName', 'atomicServiceCode', 'itemCode', 'itemName', 'parentCode', 'orderNum', 'remark', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'DictList',
  components: { DictAddEdit, DictItemAddEdit, DictDetail, DictItemDetail, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t, te } = useI18n();
    const tree = ref<{ remove: (obj: { id: string }) => void } | null>(null);
    const listPage = reactive(new DictListPage(props, context, tree)) as DictListPage & { state: Record<string, unknown> };
    // 切换语言时重载已加载的 dict-item 国际化，使树节点 t(nameKey) 随新语言生效
    watch(
      () => i18n.global.locale.value,
      () => {
        const loaded = listPage.state.dictI18nLoaded as Array<{ atomicServiceCode: string; dictType: string }>;
        if (loaded?.length) {
          loadMessagesForConfig(
            loaded.map((c) => ({ i18nTypeDictCode: 'dict-item' as const, namespaces: [c.dictType], atomicServiceCode: c.atomicServiceCode }))
          );
        }
      }
    );
    /** 树节点文案：有 nameKey 则 t(nameKey) 以随 locale 更新，否则用 name/code（level0/1 无 nameKey） */
    function getTreeNodeLabel(data: Record<string, unknown>): string {
      const key = data.nameKey != null ? String(data.nameKey) : '';
      if (key && te(key)) return t(key);
      return (data.name != null ? String(data.name) : '') || (data.code != null ? String(data.code) : '');
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
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('dictList.columns.index') : t('dictList.columns.' + key)),
      },
    });

    const RESERVED_WIDTH_LEFT = 39 + 50;
    const RESERVED_WIDTH_RIGHT = 140;
    const autoWidthColumns = computed(() => [
      { key: 'dictType', getLabel: () => t('dictList.columns.dictType'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.dictType ?? '') },
      { key: 'dictName', getLabel: () => t('dictList.columns.dictName'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.dictName ?? '') },
      { key: 'atomicServiceCode', getLabel: () => t('dictList.columns.atomicServiceCode'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.transAtomicService(row.atomicServiceCode) },
      { key: 'itemCode', getLabel: () => t('dictList.columns.itemCode'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.itemCode ?? '') },
      { key: 'itemName', getLabel: () => t('dictList.columns.itemName'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.itemName ?? '') },
      { key: 'parentCode', getLabel: () => t('dictList.columns.parentCode'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.parentCode ?? '') },
      { key: 'orderNum', getLabel: () => t('dictList.columns.orderNum'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.orderNum ?? '') },
      { key: 'remark', getLabel: () => t('dictList.columns.remark'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.remark ?? '') },
      { key: 'active', getLabel: () => t('dictList.columns.active'), sortable: false, getCellText: (row: Record<string, unknown>) => '' },
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

    const splitContainerRef = ref<HTMLElement | null>(null);
    const treePanelWidthPercent = ref(15.75);
    function startTreeResize(e: MouseEvent) {
      e.preventDefault();
      document.addEventListener('mousemove', onTreeResizeMove);
      document.addEventListener('mouseup', onTreeResizeEnd);
    }
    function onTreeResizeMove(e: MouseEvent) {
      const el = splitContainerRef.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      treePanelWidthPercent.value = Math.min(50, Math.max(10, pct));
    }
    function onTreeResizeEnd() {
      document.removeEventListener('mousemove', onTreeResizeMove);
      document.removeEventListener('mouseup', onTreeResizeEnd);
    }

    return {
      listPage,
      splitContainerRef,
      treePanelWidthPercent,
      startTreeResize,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      getTreeNodeLabel,
      tree,
      listLayoutRefs,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
      onTableWrapMounted,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.dict-list-page {
  box-sizing: border-box;
}
.dict-list-page .dict-list-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 3px; /* 卡片上外边距 */
}
.dict-list-page .dict-list-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 5px 5px 5px; /* 上内边距 8px（5+3） */
}
.dict-list-page .dict-list-split {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}
.dict-list-page .resource-tree-col {
  flex-shrink: 0;
  padding-left: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 120px;
}
.dict-list-page .dict-list-resizer {
  flex-shrink: 0;
  width: 6px;
  cursor: col-resize;
  background: var(--el-border-color-lighter);
  transition: background 0.15s;
}
.dict-list-page .dict-list-resizer:hover {
  background: var(--el-color-primary-light-5);
}
.dict-list-page .resource-tree-wrap {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 8px 6px 8px 0;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.dict-list-page .resource-tree-wrap :deep(.el-tree-node__content) {
  height: 32px;
}
.dict-list-page .resource-table-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dict-list-page .list-page-toolbar .toolbar-name .search-name-input,
.dict-list-page .list-page-toolbar .toolbar-subsys .search-select-input {
  width: 100%;
  min-width: 0;
}
.dict-list-page .list-page-toolbar .toolbar-subsys :deep(.el-input__wrapper) {
  min-width: 0;
}
.dict-list-page .list-page-toolbar .toolbar-cell {
  flex: 1 1 auto;
  min-width: 120px;
  max-width: 200px;
}
.dict-list-page .list-page-toolbar .toolbar-module-large {
  flex: 1.5 1 auto;
  min-width: 150px;
  max-width: 280px;
}
.dict-list-page .list-page-toolbar .toolbar-dict-type {
  flex: 0.8 1 auto;
  min-width: 100px;
  max-width: 160px;
}
.dict-list-page .list-page-toolbar .toolbar-buttons {
  gap: 4px;
  min-width: 0;
}
.dict-list-page .list-page-toolbar .toolbar-buttons .el-button {
  margin-left: 0;
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
</style>
