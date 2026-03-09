<!--
 * 资源列表：左侧资源树、右侧表格，支持工具栏筛选、栏位可见性、分页，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="resource-list-page list-page-common">
    <el-card class="resource-list-card">
      <el-row :gutter="6" class="resource-list-row">
        <el-col :span="3" class="resource-tree-col">
          <div class="resource-tree-wrap">
            <el-tree
              ref="tree"
              :props="resourceTreeProps"
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
            :column-panel-show-text="t('resourceList.actions.showColumnPanel')"
            :column-panel-hide-text="t('resourceList.actions.hideColumnPanel')"
            :operation-column-show-text="t('resourceList.actions.showOperationColumn')"
            :operation-column-hide-text="t('resourceList.actions.hideOperationColumn')"
            @table-wrap-mounted="onTableWrapMounted"
          >
            <template #toolbar>
              <div class="toolbar-cell toolbar-subsys">
                <el-select
                  v-model="searchParams.resourceTypeDictCode"
                  :placeholder="t('resourceList.placeholders.resourceType')"
                  clearable
                  class="search-select-input"
                  @change="search"
                >
                  <el-option
                    v-for="item in getDictItems('kuark:sys', 'resource_type')"
                    :key="item.first"
                    :value="item.first"
                    :label="t(item.second)"
                  />
                </el-select>
              </div>
              <div class="toolbar-cell toolbar-subsys">
                <el-select
                  v-model="searchParams.subSysDictCode"
                  :placeholder="t('resourceList.placeholders.subSys')"
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
              <div class="toolbar-cell toolbar-name">
                <el-input
                  v-model="searchParams.name"
                  :placeholder="t('resourceList.placeholders.name')"
                  clearable
                  class="search-name-input"
                  @keyup="(e) => e.key === 'Enter' && search()"
                  @change="search"
                />
              </div>
              <div class="toolbar-extra">
                <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
                  {{ t('resourceList.actions.activeOnly') }}
                </el-checkbox>
              </div>
              <div class="toolbar-buttons">
                <el-button type="primary" round @click="search">
                  <el-icon><Search /></el-icon>
                  {{ t('resourceList.actions.search') }}
                </el-button>
                <el-button type="primary" round @click="resetSearchFields">
                  <el-icon><RefreshLeft /></el-icon>
                  {{ t('resourceList.actions.reset') }}
                </el-button>
              </div>
            </template>
            <template #tableToolbar>
              <el-button type="success" @click="openAddDialog">
                <el-icon><Plus /></el-icon>
                {{ t('resourceList.actions.add') }}
              </el-button>
              <el-button type="danger" @click="multiDelete">
                <el-icon><Delete /></el-icon>
                {{ t('resourceList.actions.delete') }}
              </el-button>
            </template>
            <template #columnVisibilityPanel>
              <div class="column-visibility-title">{{ t('resourceList.actions.columnVisibility') }}</div>
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
                  v-if="isColumnVisible('subSysDictCode')"
                  :label="t('resourceList.columns.subSys')"
                  prop="subSysDictCode"
                  :min-width="columnWidths['subSysDictCode'] ?? 100"
                >
                  <template #default="scope">
                    {{ transAtomicService(scope.row.subSysDictCode) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('resourceTypeDictCode')"
                  :label="t('resourceList.columns.resourceType')"
                  prop="resourceTypeDictCode"
                  :min-width="columnWidths['resourceTypeDictCode'] ?? 100"
                >
                  <template #default="scope">
                    {{ formatDictCell('kuark:sys', 'resource_type', scope.row.resourceTypeDictCode) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('name')"
                  :label="t('resourceList.columns.name')"
                  prop="name"
                  :min-width="columnWidths['name'] ?? 120"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('url')"
                  :label="t('resourceList.columns.url')"
                  prop="url"
                  :min-width="columnWidths['url'] ?? 120"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('icon')"
                  :label="t('resourceList.columns.icon')"
                  prop="icon"
                  :min-width="columnWidths['icon'] ?? 100"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('seqNo')"
                  :label="t('resourceList.columns.seqNo')"
                  prop="seqNo"
                  :min-width="columnWidths['seqNo'] ?? 80"
                  sortable="custom"
                />
                <el-table-column
                  v-if="isColumnVisible('active')"
                  :label="t('resourceList.columns.active')"
                  prop="active"
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
                  :label="t('resourceList.columns.operation')"
                  align="center"
                  fixed="right"
                  min-width="160"
                  class-name="operation-column"
                >
                  <template #default="scope">
                    <el-tooltip :content="t('resourceList.actions.edit')" placement="top" :enterable="false">
                      <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                        <Edit />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip :content="t('resourceList.actions.delete')" placement="top" :enterable="false">
                      <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                        <Delete />
                      </el-icon>
                    </el-tooltip>
                    <el-tooltip :content="t('resourceList.actions.detail')" placement="top" :enterable="false">
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
        </el-col>
      </el-row>

      <resource-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
      <resource-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
      <resource-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, onBeforeUnmount, provide } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { i18n } from '../../../i18n';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import ResourceAddEdit from './ResourceAddEdit.vue';
import ResourceDetail from './ResourceDetail.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';

function tr(key: string): string {
  return i18n.global.t(key) as string;
}

class ResourceListPage extends BaseListPage {
  private tree: { value?: { remove: (obj: { id: string }) => void } };

  constructor(
    props: Record<string, unknown>,
    context: { emit: (event: string, ...args: unknown[]) => void },
    tree: { value?: { remove: (obj: { id: string }) => void } },
  ) {
    super(props, context);
    this.tree = tree;
    this.convertThis();
    this.loadAtomicServices();
    this.loadDicts(['resource_type'], 'kuark:sys');
  }

  protected initState(): Record<string, unknown> {
    return {
      resourceTreeProps: { label: 'name' },
      searchParams: {
        parentId: null as string | null,
        subSysDictCode: null as string | null,
        resourceTypeDictCode: null as string | null,
        name: null as string | null,
        active: true,
        level: null as number | null,
      },
      searchSource: null as string | null,
      rootNode: null as { childNodes?: unknown[] } | null,
      rootResolve: null as ((data: unknown) => void) | null,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    (params as Record<string, unknown>).parentId = this.state.searchSource === 'button' ? null : sp.parentId;
    (params as Record<string, unknown>).active = sp.active === true ? true : null;
    return params;
  }

  protected async doSearch(): Promise<void> {
    (this.state as Record<string, unknown>).searchSource = 'button';
    await super.doSearch();
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name', 'parentId', 'subSysDictCode', 'resourceTypeDictCode'];
  }

  protected doAfterAdd(params?: unknown): void {
    super.doAfterAdd(params);
    const root = this.state.rootNode as { childNodes?: unknown[]; level?: number; data?: unknown } | null;
    const resolve = this.state.rootResolve as ((data: unknown) => void) | null;
    if (root) root.childNodes = [];
    if (root && resolve) this.doLoadTree(root, resolve);
  }

  protected doAfterEdit(params: any): void {
    this.doAfterAdd(params);
  }

  protected doAfterDelete(ids: string[]): void {
    super.doAfterDelete(ids);
    const t = this.tree?.value;
    if (t?.remove) ids.forEach((id) => t.remove({ id }));
  }

  public loadTree: (node: unknown, resolve: (data: unknown) => void) => void;

  private async doLoadTree(node: { level: number; data: unknown }, resolve: (data: unknown) => void): Promise<void> {
    if (node.level === 0) {
      this.state.rootNode = node;
      this.state.rootResolve = resolve;
    }
    this.setParamsForTree(node, true);
    const params = this.createSearchParams();
    try {
      const result = await backendRequest({ url: 'sys/resource/loadTreeNodes', method: 'post', params });
      if (Array.isArray(result)) resolve(result);
      else ElMessage.error(tr('resourceList.messages.loadTreeFailed'));
    } catch {
      ElMessage.error(tr('resourceList.messages.loadTreeFailed'));
    }
  }

  public expandTreeNode: (nodeData: unknown, node: { level: number }) => void;

  private doExpandTreeNode(nodeData: unknown, node: { level: number }): void {
    if (node.level === 0 || node.level === 1) return;
    // 若当前是工具栏搜索结果，仅展开树、不刷新表格，并保持 searchSource 为 button，避免搜索结果在切换标签时丢失
    if ((this.state as Record<string, unknown>).searchSource === 'button') {
      this.setParamsForTree(node as { level: number; data: unknown }, true);
      (this.state as Record<string, unknown>).searchSource = 'button';
      return;
    }
    this.resetSearchFields();
    this.setParamsForTree(node as { level: number; data: unknown }, true);
    this.searchByTree();
  }

  public clickTreeNode: (nodeData: { id: string; name?: string }, node: { level: number; data: unknown; parent?: { data: unknown } }) => void;

  private async doClickTreeNode(nodeData: { id: string }, node: { level: number; data: unknown; parent?: { data: unknown } }): Promise<void> {
    if (node.level === 1 || node.level === 2) return;
    // 若当前是工具栏搜索结果，仅更新树选中状态、不刷新表格，并保持 searchSource 为 button，避免搜索结果在切换标签时丢失
    if ((this.state as Record<string, unknown>).searchSource === 'button') {
      this.setParamsForTree(node as { level: number; data: unknown }, false);
      (this.state as Record<string, unknown>).searchSource = 'button';
      return;
    }
    this.resetSearchFields();
    this.setParamsForTree(node as { level: number; data: unknown }, false);
    const params = this.createSearchParams() as Record<string, unknown>;
    if (!params) return;
    params.id = nodeData.id;
    params.resourceTypeDictCode = this.getResourceTypeByNode(node);
    try {
      const result = await backendRequest({ url: 'sys/resource/searchOnClick', method: 'post', params });
      if (result != null && typeof result === 'object' && 'data' in result && 'totalCount' in result) {
        this.state.tableData = (result as { data: unknown[] }).data ?? [];
        (this.state.pagination as Record<string, number>).total = (result as { totalCount: number }).totalCount ?? 0;
      } else ElMessage.error(tr('resourceList.messages.loadFailed'));
    } catch {
      ElMessage.error(tr('resourceList.messages.loadFailed'));
    }
  }

  private setParamsForTree(node: { level: number; data: { id?: string; name?: string }; parent?: { data: { id?: string } } }, expand: boolean): void {
    // 保留工具栏搜索结果场景：若当前是 button 搜索，不改为 tree，避免切换/恢复后表格被清空
    if ((this.state as Record<string, unknown>).searchSource !== 'button') {
      (this.state as Record<string, unknown>).searchSource = 'tree';
    }
    const sp = this.state.searchParams as Record<string, unknown>;
    const next: Record<string, unknown> = { ...sp, level: node.level };
    if (node.level === 0) {
      (this.state as Record<string, unknown>).searchParams = next;
      return;
    }
    if (node.level === 1) {
      next.resourceTypeDictCode = (node.data as { id?: string }).id ?? null;
      next.subSysDictCode = null;
      next.parentId = null;
      next.name = null;
    } else if (node.level === 2) {
      next.resourceTypeDictCode = node.parent?.data?.id ?? null;
      next.subSysDictCode = (node.data as { id?: string }).id ?? null;
      next.parentId = null;
      next.name = null;
    } else {
      next.resourceTypeDictCode = this.getResourceTypeByNode(node as { level: number; parent?: { data: { id?: string } } });
      next.subSysDictCode = this.getSubSysByNode(node as { level: number; parent?: { data: { id?: string } } });
      next.parentId = (node.data as { id?: string }).id ?? null;
      next.name = !expand ? (node.data as { name?: string }).name ?? null : (sp.name as string | null) ?? null;
    }
    (this.state as Record<string, unknown>).searchParams = next;
  }

  private getResourceTypeByNode(node: { level: number; parent?: unknown; data?: { id?: string } }): string | null {
    let n: { level: number; parent?: { level: number; data?: { id?: string } } } = node as { level: number; parent?: { level: number; data?: { id?: string } } };
    while (n.level !== 1 && n.parent) n = n.parent;
    return (n as { data?: { id?: string } }).data?.id ?? null;
  }

  private getSubSysByNode(node: { level: number; parent?: unknown; data?: { id?: string } }): string | null {
    let n: { level: number; parent?: { level: number; data?: { id?: string } } } = node as { level: number; parent?: { level: number; data?: { id?: string } } };
    while (n.level !== 2 && n.parent) n = n.parent;
    return (n as { data?: { id?: string } }).data?.id ?? null;
  }

  private async searchByTree(): Promise<void> {
    const params = this.createSearchParams() as Record<string, unknown>;
    if (!params) return;
    params.pageNo = this.state.pagination?.pageNo ?? 1;
    params.pageSize = this.state.pagination?.pageSize ?? 10;
    const sort = this.state.sort as { orderProperty?: string; orderDirection?: string };
    if (sort?.orderProperty) params.orders = [{ property: sort.orderProperty, direction: sort.orderDirection ?? 'ASC' }];
    try {
      const result = await backendRequest({ url: 'sys/resource/searchByTree', method: 'post', params });
      if (result != null && typeof result === 'object' && 'data' in result && 'totalCount' in result) {
        this.state.tableData = (result as { data: unknown[] }).data ?? [];
        (this.state.pagination as Record<string, number>).total = (result as { totalCount: number }).totalCount ?? 0;
      } else ElMessage.error(tr('resourceList.messages.loadFailed'));
    } catch {
      ElMessage.error(tr('resourceList.messages.loadFailed'));
    }
  }

  /** 持久化时一并保存 searchSource，便于标签切换后恢复树/表格联动状态 */
  public override persistListState(): void {
    super.persistListState();
    if (typeof window === 'undefined') return;
    const key = 'resourceList.queryState';
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      parsed.searchSource = (this.state as Record<string, unknown>).searchSource ?? null;
      window.localStorage.setItem(key, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  }

  /** 恢复时一并恢复 searchSource */
  public override restorePersistedListState(): void {
    super.restorePersistedListState();
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('resourceList.queryState');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const searchSource = parsed.searchSource;
      if (searchSource !== undefined && searchSource !== null) {
        (this.state as Record<string, unknown>).searchSource = searchSource;
      }
    } catch {
      // ignore
    }
  }

  protected convertThis(): void {
    super.convertThis();
    this.loadTree = (node: unknown, resolve: (data: unknown) => void) => this.doLoadTree(node as { level: number; data: unknown }, resolve);
    this.expandTreeNode = (nodeData: unknown, node: { level: number }) => this.doExpandTreeNode(nodeData, node);
    this.clickTreeNode = (nodeData: { id: string; name?: string }, node: { level: number; data: unknown; parent?: { data: unknown } }) => this.doClickTreeNode(nodeData, node);
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'resourceList.operationColumnPinned';
const RESOURCE_LIST_STATE_STORAGE_KEY = 'resourceList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'resourceList.visibleColumns';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['subSysDictCode', 'resourceTypeDictCode', 'name', 'url', 'icon', 'seqNo', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'ResourceList',
  components: { ResourceAddEdit, ResourceDetail, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t } = useI18n();
    const tree = ref<{ remove: (obj: { id: string }) => void } | null>(null);
    const listPage = reactive(new ResourceListPage(props, context, tree)) as ResourceListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
    });
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

    const columnKeyToLabel: Record<string, () => string> = {
      subSysDictCode: () => t('resourceList.columns.subSys'),
      resourceTypeDictCode: () => t('resourceList.columns.resourceType'),
      name: () => t('resourceList.columns.name'),
      url: () => t('resourceList.columns.url'),
      icon: () => t('resourceList.columns.icon'),
      seqNo: () => t('resourceList.columns.seqNo'),
      active: () => t('resourceList.columns.active'),
    };
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('resourceList.columns.index') },
      ...ALL_COLUMN_KEYS.map((key) => ({ key, label: columnKeyToLabel[key]?.() ?? key })),
    ]);
    const RESERVED_WIDTH_LEFT = 39 + 50;
    const RESERVED_WIDTH_RIGHT = 140;
    /** 字典项展示：有 i18n key 时 t(key)，否则不调用 t('') 避免 intlify 报错 */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      return key ? t(key) : '—';
    }
    const autoWidthColumns = computed(() =>
      ALL_COLUMN_KEYS.map((key) => ({
        key,
        getLabel: () => columnKeyToLabel[key]?.() ?? key,
        sortable: key === 'name' || key === 'url' || key === 'icon' || key === 'seqNo',
        getCellText:
          key === 'subSysDictCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSysDictCode)
            : key === 'resourceTypeDictCode'
              ? (row: Record<string, unknown>) => formatDictCell('kuark:sys', 'resource_type', row.resourceTypeDictCode)
              : key === 'name'
                ? (row: Record<string, unknown>) => String(row.name ?? '')
                : key === 'url'
                  ? (row: Record<string, unknown>) => String(row.url ?? '')
                  : key === 'icon'
                    ? (row: Record<string, unknown>) => String(row.icon ?? '')
                    : key === 'seqNo'
                      ? (row: Record<string, unknown>) => String(row.seqNo ?? '')
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
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    onBeforeRouteLeave((_to, _from, next) => {
      listPage.persistListState();
      next();
    });
    onBeforeUnmount(() => {
      listPage.persistListState();
    });

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      formatDictCell,
      tree,
      listLayoutRefs,
      tableRef,
      columnWidths,
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
/* 卡片与行高度传递，使树与表格区域同高 */
.resource-list-page .resource-list-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 3px; /* 卡片上外边距 */
}
.resource-list-page .resource-list-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 5px 5px 5px; /* 上内边距 8px（5+3） */
}
.resource-list-page .resource-list-row {
  flex: 1;
  min-height: 0;
}
.resource-list-page .resource-tree-col {
  padding-left: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
/* 树区：左边栏视觉（右边线 + 浅底）+ 可滚动 */
.resource-list-page .resource-tree-wrap {
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 8px 6px 8px 0;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}
.resource-list-page .resource-table-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 树节点行高与表格接近，风格统一 */
.resource-list-page .resource-tree-wrap :deep(.el-tree-node__content) {
  height: 32px;
}
.resource-list-page .list-page-toolbar .toolbar-name .search-name-input,
.resource-list-page .list-page-toolbar .toolbar-subsys .search-select-input {
  width: 100%;
  min-width: 0;
}
.resource-list-page .list-page-toolbar .toolbar-subsys :deep(.el-input__wrapper) {
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
</style>
