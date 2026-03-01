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
      <el-row :gutter="6" class="dict-list-row">
        <el-col :span="3" class="resource-tree-col">
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
            />
          </div>
        </el-col>
        <el-col :span="21" class="resource-table-col">
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
                <el-autocomplete
                  v-model="searchParams.dictType"
                  :placeholder="t('dictList.placeholders.dictType')"
                  :fetch-suggestions="filterDictType"
                  :trigger-on-focus="false"
                  clearable
                  class="search-select-input"
                  @change="search"
                  @select="search"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.dictName"
                  :placeholder="t('dictList.placeholders.dictName')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                  @change="search"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.itemCode"
                  :placeholder="t('dictList.placeholders.itemCode')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                  @change="search"
                />
              </div>
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.itemName"
                  :placeholder="t('dictList.placeholders.itemName')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                  @change="search"
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
                {{ t('dictList.actions.add') }}
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
                <el-table-column type="selection" min-width="39" />
                <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" />
                <el-table-column
                  v-if="isColumnVisible('dictType')"
                  :label="t('dictList.columns.dictType')"
                  prop="dictType"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('dictName')"
                  :label="t('dictList.columns.dictName')"
                  prop="dictName"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('module')"
                  :label="t('dictList.columns.module')"
                  prop="module"
                  sortable="custom"
                >
                  <template #default="scope">
                    {{ transAtomicService(scope.row.module) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('itemCode') && !searchParams.isDict"
                  :label="t('dictList.columns.itemCode')"
                  prop="itemCode"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('itemName') && !searchParams.isDict"
                  :label="t('dictList.columns.itemName')"
                  prop="itemName"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('parentCode') && !searchParams.isDict"
                  :label="t('dictList.columns.parentCode')"
                  prop="parentCode"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('seqNo') && !searchParams.isDict"
                  :label="t('dictList.columns.seqNo')"
                  prop="seqNo"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('active') && !searchParams.isDict"
                  :label="t('dictList.columns.active')"
                  min-width="80"
                >
                  <template #default="scope">
                    <el-switch
                      v-if="scope.row.itemCode"
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
                  min-width="140"
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
        </el-col>
      </el-row>

      <dict-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" :module="searchParams.module" :dict-type="searchParams.dictType" />
      <dict-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" :is-dict="isDict" />
      <dict-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
      <dict-item-detail v-if="itemDetailDialogVisible" v-model="itemDetailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick } from 'vue';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { i18n } from '../../../i18n';
import DictAddEdit from './DictAddEdit.vue';
import DictDetail from './DictDetail.vue';
import DictItemDetail from './DictItemDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useTableMaxHeight } from '../../../components/pages/useTableMaxHeight';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';

function tr(key: string): string {
  return i18n.global.t(key) as string;
}

class ListPage extends BaseListPage {
  private tree: { value?: { remove: (obj: { id: string }) => void } };

  constructor(
    props: Record<string, unknown>,
    context: { emit: (event: string, ...args: unknown[]) => void },
    tree: { value?: { remove: (obj: { id: string }) => void } }
  ) {
    super(props, context);
    this.tree = tree;
    this.loadAtomicServices();
    this.loadDictTypes();
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      ...super.initBaseState(),
      dictTreeProps: { label: 'code' },
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
      dictTypes: [] as Array<{ value: string }>,
      searchSource: null as string | null,
      isDict: false,
      rootNode: null,
      rootResolve: null,
      itemDetailDialogVisible: false,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/dict';
  }

  protected getUpdateActiveUrl(): string {
    return 'sys/dictItem/updateActive';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams() as Record<string, unknown> | null;
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    params.active = sp.active === true ? true : null;
    if (params.dictType || params.dictName || params.itemCode || params.itemName) {
      (this.state as Record<string, unknown>).isDict = false;
    } else {
      (this.state as Record<string, unknown>).isDict = true;
    }
    (params as Record<string, unknown>).isDict = (this.state as Record<string, unknown>).isDict;
    params.parentId = null;
    return params;
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
      this.searchByTree();
    }
  }

  protected doHandleCurrentChange(newCurrent: number): void {
    if (newCurrent) {
      this.state.pagination.pageNo = newCurrent;
      if ((this.state as Record<string, unknown>).searchSource === 'button') {
        this.search();
      } else {
        this.searchByTree();
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
    return (row as { itemId?: unknown }).itemId == null ? (row as { dictId: string }).dictId : (row as { itemId: string }).itemId;
  }

  protected doHandleEdit(row: Record<string, unknown>): void {
    super.doHandleEdit(row);
    (this.state as Record<string, unknown>).isDict = (row as { itemId?: unknown }).itemId == null;
  }

  protected doHandleDetail(row: Record<string, unknown>): void {
    if ((row as { itemId?: unknown }).itemId == null) {
      (this.state as Record<string, unknown>).detailDialogVisible = true;
    } else {
      (this.state as Record<string, unknown>).itemDetailDialogVisible = true;
    }
    (this.state as Record<string, unknown>).rid = this.getRowId(row);
  }

  public filterDictType: (queryString: string, cb: (list: Array<{ value: string }>) => void) => void;

  private doFilterDictType(queryString: string, cb: (list: Array<{ value: string }>) => void): void {
    const list = this.state.dictTypes as Array<{ value: string }>;
    cb(queryString ? list.filter(this.createFilter(queryString)) : list);
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
        sp.module = ListPage.getAtomicServiceByNode(node);
        sp.dictType = ListPage.getDictTypeByNode(node);
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

  public loadTree: (node: unknown, resolve: (data: unknown[]) => void) => void;

  private async doLoadTree(node: { level: number; data?: { code: string; id: string } }, resolve: (data: unknown[]) => void): Promise<void> {
    if (node.level === 0) {
      (this.state as Record<string, unknown>).rootNode = node;
      (this.state as Record<string, unknown>).rootResolve = resolve;
    }
    this.setParamsForTree(node as Parameters<InstanceType<typeof ListPage>['setParamsForTree']>[0], true);
    const sp = this.state.searchParams as Record<string, unknown>;
    const params = {
      parentId: node.level === 0 ? null : node.level === 1 ? (node.data as { code: string }).code : (node.data as { id: string }).id,
      firstLevel: node.level === 1,
      active: sp.active === true ? true : null,
    };
    try {
      const result = await backendRequest({ url: 'sys/dict/loadTreeNodes', method: 'post', params }) as { code: number; data?: unknown[] };
      if (result.code === 200) {
        resolve(result.data ?? []);
      } else {
        ElMessage.error(tr('dictList.messages.loadTreeFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadTreeFailed'));
    }
  }

  public expandTreeNode: (nodeData: unknown, node: unknown) => void;

  private doExpandTreeNode(nodeData: unknown, node: { data?: unknown }): void {
    if (node.data) {
      this.setParamsForTree(node as Parameters<InstanceType<typeof ListPage>['setParamsForTree']>[0], true);
      this.searchByTree();
    }
  }

  public clickTreeNode: (nodeData: Record<string, unknown>, node: { level: number; data?: { id: string; code: string } }) => void;

  private async doClickTreeNode(nodeData: Record<string, unknown>, node: { level: number; data?: { id: string; code: string } }): Promise<void> {
    if (node.level === 1) return;
    (this.state as Record<string, unknown>).searchSource = 'tree';
    this.setParamsForTree(node as Parameters<InstanceType<typeof ListPage>['setParamsForTree']>[0], false);
    const params = { id: nodeData.id, isDict: node.level === 2 };
    try {
      const result = await backendRequest({ url: 'sys/dict/getDict', params }) as { code: number; data?: unknown };
      if (result.code === 200) {
        this.state.tableData = result.data ? [result.data] : [];
        this.state.pagination.total = 1;
      } else {
        ElMessage.error(tr('dictList.messages.loadFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadFailed'));
    }
  }

  private createFilter(queryString: string): (item: { value: string }) => boolean {
    return (item) => item.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0;
  }

  private async searchByTree(): Promise<void> {
    (this.state as Record<string, unknown>).searchSource = 'tree';
    const sp = this.state.searchParams as Record<string, unknown>;
    const params: Record<string, unknown> = {
      parentId: sp.parentId,
      firstLevel: sp.level === 1,
      pageNo: this.state.pagination.pageNo,
      pageSize: this.state.pagination.pageSize,
      active: sp.active === true ? true : null,
      isDict: sp.isDict,
    };
    if (this.state.sort.orderProperty) {
      params.orders = [{ property: this.state.sort.orderProperty, direction: this.state.sort.orderDirection }];
    }
    try {
      const result = await backendRequest({ url: 'sys/dict/searchByTree', method: 'post', params }) as { code: number; data?: { first: unknown[]; second: number } };
      if (result.code === 200 && result.data) {
        this.state.tableData = result.data.first;
        this.state.pagination.total = result.data.second;
      } else {
        ElMessage.error(tr('dictList.messages.loadFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadFailed'));
    }
  }

  private async loadDictTypes(): Promise<void> {
    try {
      const result = await backendRequest({ url: 'sys/dict/loadDictTypes' }) as { code: number; data?: string[] };
      if (result.code === 200 && result.data) {
        (this.state as Record<string, unknown>).dictTypes = result.data.map((val) => ({ value: val }));
      } else {
        ElMessage.error(tr('dictList.messages.loadDictTypesFailed'));
      }
    } catch {
      ElMessage.error(tr('dictList.messages.loadDictTypesFailed'));
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
    this.filterDictType = (q, cb) => this.doFilterDictType(q, cb);
    this.loadTree = (node, resolve) => this.doLoadTree(node as Parameters<InstanceType<typeof ListPage>['doLoadTree']>[0], resolve as (data: unknown[]) => void);
    this.expandTreeNode = (nodeData, node) => this.doExpandTreeNode(nodeData, node);
    this.clickTreeNode = (nodeData, node) => this.doClickTreeNode(nodeData as Record<string, unknown>, node);
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'dictList.operationColumnPinned';
const DICT_LIST_STATE_STORAGE_KEY = 'dictList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'dictList.visibleColumns';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['dictType', 'dictName', 'module', 'itemCode', 'itemName', 'parentCode', 'seqNo', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'DictList',
  components: { DictAddEdit, DictDetail, DictItemDetail, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const tree = ref<{ remove: (obj: { id: string }) => void } | null>(null);
    const listPage = reactive(new ListPage(props, context, tree)) as ListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    listPage.configureListStatePersistence(DICT_LIST_STATE_STORAGE_KEY);
    listPage.configureTableMaxHeight();
    const { tableWrapRef, paginationRef, updateTableMaxHeight } = useTableMaxHeight(listPage);
    const listLayoutRefs = { tableWrapRef, paginationRef };

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('dictList.columns.index') },
      ...ALL_COLUMN_KEYS.map((key) => ({ key, label: t('dictList.columns.' + key) })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    function onTableWrapMounted(): void {
      nextTick(updateTableMaxHeight);
    }

    onMounted(() => {
      listPage.restorePersistedListState();
    });
    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      tree,
      listLayoutRefs,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
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
.dict-list-page .dict-list-row {
  flex: 1;
  min-height: 0;
}
.dict-list-page .resource-tree-col {
  padding-left: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
