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
      <div ref="splitContainerRef" class="resource-list-split">
        <div class="resource-tree-col" :style="{ width: treePanelWidthPercent + '%' }">
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
            >
              <template #default="{ node, data }">
                <span>{{ getTreeNodeLabel(data) }}</span>
              </template>
            </el-tree>
          </div>
        </div>
        <div class="resource-list-resizer" @mousedown="startTreeResize" />
        <div class="resource-table-col">
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
                  v-model="searchParams.subSystemCode"
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
              <div class="toolbar-cell toolbar-subsys">
                <el-select
                  v-model="searchParams.resourceTypeDictCode"
                  :placeholder="t('resourceList.placeholders.resourceType')"
                  clearable
                  class="search-select-input"
                  @change="search"
                >
                  <el-option
                    v-for="item in resourceTypeOptions"
                    :key="item.first"
                    :value="item.first"
                    :label="getResourceTypeLabel(item.first)"
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
                  v-if="isColumnVisible('subSystemCode')"
                  :label="t('resourceList.columns.subSys')"
                  prop="subSystemCode"
                  :min-width="columnWidths['subSystemCode'] ?? 100"
                  show-overflow-tooltip
                >
                  <template #default="scope">
                    {{ transAtomicService(scope.row.subSystemCode) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('resourceTypeDictCode')"
                  :label="t('resourceList.columns.resourceType')"
                  prop="resourceTypeDictCode"
                  :min-width="columnWidths['resourceTypeDictCode'] ?? 100"
                  show-overflow-tooltip
                >
                  <template #default="scope">
                    {{ getResourceTypeLabel(scope.row.resourceTypeDictCode) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="isColumnVisible('name')"
                  :label="t('resourceList.columns.name')"
                  prop="name"
                  :min-width="columnWidths['name'] ?? 120"
                  sortable="custom"
                  show-overflow-tooltip
                />
                <el-table-column
                  v-if="isColumnVisible('url')"
                  :label="t('resourceList.columns.url')"
                  prop="url"
                  :min-width="columnWidths['url'] ?? 120"
                  sortable="custom"
                  show-overflow-tooltip
                />
                <el-table-column
                  v-if="isColumnVisible('icon')"
                  :label="t('resourceList.columns.icon')"
                  prop="icon"
                  :min-width="columnWidths['icon'] ?? 100"
                  sortable="custom"
                  show-overflow-tooltip
                />
                <el-table-column
                  v-if="isColumnVisible('orderNum')"
                  :label="t('resourceList.columns.seqNo')"
                  prop="orderNum"
                  :min-width="columnWidths['orderNum'] ?? 80"
                  sortable="custom"
                  show-overflow-tooltip
                />
                <el-table-column
                  v-if="isColumnVisible('active')"
                  :label="t('resourceList.columns.active')"
                  prop="active"
                  :min-width="columnWidths['active'] ?? 80"
                  show-overflow-tooltip
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
        </div>
      </div>

    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
      <div v-if="hasFormEverOpened" v-show="formVisible">
        <resource-form-page
          :model-value="formVisible"
          :rid="formRid"
          @update:modelValue="onFormClose"
          @response="onFormResponse"
        />
      </div>
      <resource-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, watch, nextTick, onBeforeUnmount, provide } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { i18n } from '../../../i18n';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import ResourceFormPage from './ResourceFormPage.vue';
import ResourceDetailPage from './ResourceDetailPage.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { loadMessagesForConfig } from '../../../i18n';

const MENU_I18N_CONFIG = [{ i18nTypeDictCode: 'view', namespaces: ['menu'], atomicServiceCode: 'sys' as const }];
/** 本页切换语言时需重新加载的 i18n（与 getI18nConfig 一致），保证 t('resource_type.*') 等随新 locale 生效 */
const RESOURCE_LIST_I18N_CONFIG = [
  { i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' },
  ...MENU_I18N_CONFIG,
];

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
    this.loadSubSystems();
    this.loadDicts(['resource_type'], 'sys').then(() => {
      (this.state as Record<string, unknown>).resourceTypeOptions = this.getDictItems('sys', 'resource_type');
    });
  }

  /** 子系统下拉与表格展示：使用 sys/system/getAllActiveSubSystemCodes，与数据源/域名等页一致 */
  private async loadSubSystems(): Promise<void> {
    try {
      const result = await backendRequest({ url: 'sys/system/getAllActiveSubSystemCodes', method: 'get' });
      const payload = getApiResponseData<unknown[]>(result);
      const raw = Array.isArray(payload) ? payload.map((x) => String(x ?? '')) : [];
      const list = raw.filter((c) => c !== '').map((code) => ({ code, name: code }));
      const asCache = list.map(({ code, name }) => ({
        id: code,
        code,
        name,
        context: null as string | null,
        atomicService: true,
        parentCode: null as string | null,
        remark: null as string | null,
        active: true,
        builtIn: true,
      }));
      this.atomicServiceList = asCache;
      this.state.atomicServiceList = asCache;
    } catch {
      this.atomicServiceList = [];
      this.state.atomicServiceList = [];
    }
  }

  protected initState(): Record<string, unknown> {
    return {
      resourceTreeProps: { label: 'name' },
      resourceTypeOptions: [] as Array<{ first: string; second: string }>,
      searchParams: {
        parentId: null as string | null,
        subSystemCode: null as string | null,
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

  /** 重置搜索条件时保留「仅启用」为打勾，其它条件清空 */
  protected override doResetSearchFields(): void {
    this.state.pagination.pageNo = 1;
    const searchParams = this.state.searchParams as Record<string, unknown>;
    if (searchParams) {
      for (const paramName in searchParams) {
        if (paramName === 'active') {
          searchParams[paramName] = true;
          continue;
        }
        searchParams[paramName] = null;
      }
    }
  }

  /** 本页需加载的国际化：ListPage + FormPage（弹窗共用）；menu 与 Sidebar 一致供树第三层及以下菜单文案 */
  protected getI18nConfig() {
    return [
      { i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' },
      ...MENU_I18N_CONFIG,
    ];
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (!params) return null;
    const sp = this.state.searchParams as Record<string, unknown>;
    (params as Record<string, unknown>).parentId = this.state.searchSource === 'button' ? null : sp.parentId;
    (params as Record<string, unknown>).active = sp.active === true ? true : null;
    return params;
  }

  /**
   * 由树触发的 pagingSearch 参数：不传 name、pageNo、pageSize、level。
   * 用于展开树节点、点击树节点时请求表格数据。
   */
  private buildPagingSearchParamsForTree(): Record<string, unknown> {
    const sp = this.state.searchParams as Record<string, unknown>;
    const params: Record<string, unknown> = {
      subSystemCode: sp?.subSystemCode ?? null,
      resourceTypeDictCode: sp?.resourceTypeDictCode ?? null,
      parentId: sp?.parentId ?? null,
      active: sp?.active === true ? true : null,
    };
    const sort = this.state.sort as { orderProperty?: string; orderDirection?: string };
    if (sort?.orderProperty) {
      params.orders = [{ property: sort.orderProperty, direction: sort.orderDirection ?? 'ASC' }];
    }
    return params;
  }

  /**
   * 由搜索栏触发的 pagingSearch 参数：不传 level、parentId。
   * 用于点击搜索/重置、分页、排序时请求表格数据。
   */
  private buildPagingSearchParamsForSearchBar(): Record<string, unknown> {
    const sp = this.state.searchParams as Record<string, unknown>;
    const params: Record<string, unknown> = {
      name: sp?.name ?? null,
      subSystemCode: sp?.subSystemCode ?? null,
      resourceTypeDictCode: sp?.resourceTypeDictCode ?? null,
      active: sp?.active === true ? true : null,
      pageNo: this.state.pagination?.pageNo ?? 1,
      pageSize: this.state.pagination?.pageSize ?? 10,
    };
    const sort = this.state.sort as { orderProperty?: string; orderDirection?: string };
    if (sort?.orderProperty) {
      params.orders = [{ property: sort.orderProperty, direction: sort.orderDirection ?? 'ASC' }];
    }
    return params;
  }

  protected async doSearch(): Promise<void> {
    (this.state as Record<string, unknown>).searchSource = 'button';
    const params = this.buildPagingSearchParamsForSearchBar();
    if (!params) return;
    try {
      const result = await backendRequest({ url: 'sys/resource/pagingSearch', method: 'post', params });
      const payload = getApiResponseData<{ data?: unknown[]; totalCount?: number }>(result);
      const isSuccess = payload != null && typeof payload === 'object' && 'data' in payload && typeof payload.totalCount === 'number';
      if (isSuccess) {
        this.postSearchSuccessfully(payload as { data: unknown[]; totalCount: number });
      } else {
        ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tr('resourceList.messages.loadFailed'));
      }
    } catch {
      ElMessage.error(tr('resourceList.messages.loadFailed'));
    }
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['name', 'parentId', 'subSystemCode', 'resourceTypeDictCode'];
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

  /**
   * 按四种情况分别构造 loadDirectChildrenForTree 的请求参数：
   * 1. 页面打开时（level=0）：加载资源类型，只传 level=0、active
   * 2. 资源类型展开时（level=1）：加载子系统，只传 active、level=1
   * 3. 子系统展开时（level=2）：加载第一层资源，传 active、level=2、subSystemCode、resourceTypeDictCode
   * 4. 其他情况（level>2）：传 active、level、parentId
   */
  private buildTreeRequestParams(node: { level: number; data: { id?: string }; parent?: { data: { id?: string } } }): Record<string, unknown> {
    const active = (this.state.searchParams as Record<string, unknown>)?.active ?? true;
    if (node.level === 0) {
      return { level: 0, active };
    }
    if (node.level === 1) {
      return { active, level: 1 };
    }
    if (node.level === 2) {
      return {
        active,
        level: 2,
        subSystemCode: node.data?.id ?? null,
        resourceTypeDictCode: node.parent?.data?.id ?? null,
      };
    }
    return {
      active,
      level: node.level,
      parentId: node.data?.id ?? null,
    };
  }

  private async doLoadTree(node: { level: number; data: unknown; parent?: { data: { id?: string } } }, resolve: (data: unknown) => void): Promise<void> {
    if (node.level === 0) {
      this.state.rootNode = node;
      this.state.rootResolve = resolve;
    }
    this.setParamsForTree(node as { level: number; data: { id?: string; name?: string }; parent?: { data: { id?: string } } }, true);
    const treeParams = this.buildTreeRequestParams(node as { level: number; data: { id?: string }; parent?: { data: { id?: string } } });
    if (node.level >= 2) await loadMessagesForConfig(MENU_I18N_CONFIG);
    try {
      const result = await backendRequest({ url: 'sys/resource/loadDirectChildrenForTree', method: 'post', params: treeParams });
      const rawList = getApiResponseData(result);
      const list = Array.isArray(rawList) ? rawList : [];
      const resolved = this.applyTreeNodeI18n(list, node.level);
      resolve(resolved);
    } catch {
      ElMessage.error(tr('resourceList.messages.loadTreeFailed'));
    }
  }

  /** 树节点国际化：存 nameKey 供模板随 locale 用 t(nameKey) 渲染；第一层=resource_type.*，第二层不设，其余层=titleKey 或 name（当为 i18n key 时） */
  private applyTreeNodeI18n(nodes: unknown[], parentLevel: number): Record<string, unknown>[] {
    return nodes.map((n) => {
      const item = (n && typeof n === 'object' ? { ...(n as Record<string, unknown>) } : { id: '', name: '' }) as Record<string, unknown>;
      const id = String(item.id ?? item.value ?? '').trim();
      const name = item.name != null ? String(item.name) : '';
      const titleKey = item.titleKey != null ? String(item.titleKey) : '';
      if (parentLevel === 0) {
        item.nameKey = id ? 'resource_type.' + id : '';
      } else if (parentLevel >= 2) {
        item.nameKey = titleKey || (name && name.includes('.') ? name : '');
      }
      return item;
    });
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
    this.pagingSearch();
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
    const params = {
      ...this.buildPagingSearchParamsForTree(),
      id: nodeData.id,
      resourceTypeDictCode: this.getResourceTypeByNode(node),
      parentId: null,
    };
    try {
      const result = await backendRequest({ url: 'sys/resource/pagingSearch', method: 'post', params });
      const payload = getApiResponseData<{ data?: unknown[]; totalCount?: number }>(result);
      if (payload != null && typeof payload === 'object' && 'data' in payload && 'totalCount' in payload) {
        this.state.tableData = payload.data ?? [];
        (this.state.pagination as Record<string, number>).total = payload.totalCount ?? 0;
      } else ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tr('resourceList.messages.loadFailed'));
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
      next.subSystemCode = null;
      next.parentId = null;
      next.name = null;
    } else if (node.level === 2) {
      if (expand) {
        Object.assign(sp, {
          level: node.level,
          resourceTypeDictCode: node.parent?.data?.id ?? null,
          subSystemCode: (node.data as { id?: string }).id ?? null,
          parentId: null,
          name: null,
        });
        (this.state as Record<string, unknown>).searchParams = sp;
        return;
      }
      next.resourceTypeDictCode = node.parent?.data?.id ?? null;
      next.subSystemCode = (node.data as { id?: string }).id ?? null;
      next.parentId = null;
      next.name = null;
    } else {
      next.resourceTypeDictCode = this.getResourceTypeByNode(node as { level: number; parent?: { data: { id?: string } } });
      next.subSystemCode = this.getSubSysByNode(node as { level: number; parent?: { data: { id?: string } } });
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

  private async pagingSearch(): Promise<void> {
    const params = this.buildPagingSearchParamsForTree();
    try {
      const result = await backendRequest({ url: 'sys/resource/pagingSearch', method: 'post', params });
      const payload = getApiResponseData<{ data?: unknown[]; totalCount?: number }>(result);
      if (payload != null && typeof payload === 'object' && 'data' in payload && 'totalCount' in payload) {
        this.state.tableData = payload.data ?? [];
        (this.state.pagination as Record<string, number>).total = payload.totalCount ?? 0;
      } else ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tr('resourceList.messages.loadFailed'));
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
const ALL_COLUMN_KEYS = ['subSystemCode', 'resourceTypeDictCode', 'name', 'url', 'icon', 'orderNum', 'active'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

export default defineComponent({
  name: 'ResourceListPage',
  components: { ResourceFormPage, ResourceDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t, te } = useI18n();
    const tree = ref<{ remove: (obj: { id: string }) => void } | null>(null);
    const listPage = reactive(new ResourceListPage(props, context, tree)) as ResourceListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const state = listPage.state as Record<string, unknown>;
    const formVisible = computed(() => !!(state.addDialogVisible || state.editDialogVisible));
    const formRid = computed(() => (state.editDialogVisible ? String(state.rid ?? '') : ''));
    const hasFormEverOpened = ref(false);
    watch(formVisible, (v) => { if (v) hasFormEverOpened.value = true; }, { immediate: true });
    const currentFormMode = ref<'add' | 'edit'>('add');
    watch(() => state.addDialogVisible, (v) => { if (v) currentFormMode.value = 'add'; }, { immediate: true });
    watch(() => state.editDialogVisible, (v) => { if (v) currentFormMode.value = 'edit'; }, { immediate: true });
    function onFormClose(v: boolean) {
      if (!v) { state.addDialogVisible = false; state.editDialogVisible = false; }
    }
    function onFormResponse(payload: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.afterAdd : listPage.afterEdit).call(listPage, payload);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
    });
    const tableRef = ref<{ doLayout?: () => void } | null>(null);

    const columnKeyToLabel: Record<string, () => string> = {
      subSystemCode: () => t('resourceList.columns.subSys'),
      resourceTypeDictCode: () => t('resourceList.columns.resourceType'),
      name: () => t('resourceList.columns.name'),
      url: () => t('resourceList.columns.url'),
      icon: () => t('resourceList.columns.icon'),
      orderNum: () => t('resourceList.columns.seqNo'),
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
    /** 资源类型列/下拉：使用 locale resource_type.* 做国际化，无对应 key 时回退到字典/原码；随 locale 切换更新 */
    function getResourceTypeLabel(code: unknown): string {
      const c = String(code ?? '').trim();
      if (!c) return '—';
      const i18nKey = 'resource_type.' + c;
      const translated = t(i18nKey);
      return translated !== i18nKey ? translated : (listPage.transDict('sys', 'resource_type', c) || c);
    }
    /** 树节点文案：有 nameKey 则 t(nameKey) 以随 locale 更新，否则用 name（第二层等） */
    function getTreeNodeLabel(data: Record<string, unknown>): string {
      const key = data.nameKey != null ? String(data.nameKey) : '';
      if (key && te(key)) return t(key);
      return (data.name != null ? String(data.name) : '') || (data.title != null ? String(data.title) : '') || (data.titleKey != null ? String(data.titleKey) : '');
    }
    const autoWidthColumns = computed(() =>
      ALL_COLUMN_KEYS.map((key) => ({
        key,
        getLabel: () => columnKeyToLabel[key]?.() ?? key,
        sortable: key === 'name' || key === 'url' || key === 'icon' || key === 'orderNum',
        getCellText:
          key === 'subSystemCode'
            ? (row: Record<string, unknown>) => listPage.transAtomicService(row.subSystemCode)
            : key === 'resourceTypeDictCode'
              ? (row: Record<string, unknown>) => getResourceTypeLabel(row.resourceTypeDictCode)
              : key === 'name'
                ? (row: Record<string, unknown>) => String(row.name ?? '')
                : key === 'url'
                  ? (row: Record<string, unknown>) => String(row.url ?? '')
                  : key === 'icon'
                    ? (row: Record<string, unknown>) => String(row.icon ?? '')
                    : key === 'orderNum'
                      ? (row: Record<string, unknown>) => String(row.orderNum ?? '')
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
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }

    onBeforeRouteLeave((_to, _from, next) => {
      listPage.persistListState();
      next();
    });
    onBeforeUnmount(() => {
      listPage.persistListState();
      document.removeEventListener('mousemove', onTreeResizeMove);
      document.removeEventListener('mouseup', onTreeResizeEnd);
    });

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
      treePanelWidthPercent.value = Math.min(50, Math.max(15, pct));
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
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      formatDictCell,
      getResourceTypeLabel,
      getTreeNodeLabel,
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
.resource-list-page .resource-list-split {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}
.resource-list-page .resource-tree-col {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 120px;
}
/* 可拖拽分隔线 */
.resource-list-page .resource-list-resizer {
  flex-shrink: 0;
  width: 6px;
  cursor: col-resize;
  background: var(--el-border-color-lighter);
  transition: background 0.15s;
}
.resource-list-page .resource-list-resizer:hover {
  background: var(--el-color-primary-light-5);
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
  flex: 1;
  min-width: 0;
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
