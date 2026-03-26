<!--
 * 资源权限列表：支持按子系统/租户、资源类型、资源名称筛选，展示资源权限表格。
 *
 * @author: K
 * @since 1.0.0
 -->


<template>
  <div>
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>系统配置</el-breadcrumb-item>
      <el-breadcrumb-item>资源列表</el-breadcrumb-item>
    </el-breadcrumb>

    <el-row :gutter="20" class="toolbar">
      <el-col :span="2">
        <el-select v-model="searchParams.resourceTypeDictCode" placeholder="资源类型" clearable class="border_red">
          <el-option v-for="item in getDictItems('sys', 'resource_type')"
                     :key="item.first" :value="item.first" :label="t(item.second)"/>
        </el-select>
      </el-col>
      <el-col :span="2">
        <el-cascader :options="subSysOrTenants" v-model="searchParams.subSysOrTenant"
                     :props="cascaderProps" :placeholder="t('organizationList.placeholders.subSysTenant')" class="border_red"/>
      </el-col>
      <el-col :span="2">
        <el-input v-model="searchParams.name" placeholder="资源名称" @change="search" clearable/>
      </el-col>

      <el-col :span="14">
        <el-button type="primary" round @click="search">搜索</el-button>
        <el-button type="primary" round @click="resetSearchFields">重置</el-button>
      </el-col>
    </el-row>

    <el-container style="height: 100%; border: 1px solid #eee">
      <el-aside min-width="200px" style="background-color: rgb(238, 241, 246)">
        <el-scrollbar>
          <el-tree ref="tree" :props="resourceTreeProps" :data="menus"
                   :expand-on-click-node="false" node-key="id"
                   @node-click="(nodeData,node)=>clickTreeNode(nodeData,node)" accordion/>
        </el-scrollbar>
      </el-aside>

      <el-main>
        <div ref="tableWrapRef">
        <el-table border stripe :data="tableData" :max-height="tableMaxHeight" @selection-change="handleSelectionChange"
                  :header-cell-style="{textAlign: 'center'}" @sort-change="handleSortChange">
          <el-table-column type="index" min-width="50"/>
          <el-table-column label="资源名称" prop="name" :min-width="columnWidths['name'] ?? 120" sortable="custom" show-overflow-tooltip/>
          <el-table-column label="URL" prop="url" :min-width="columnWidths['url'] ?? 120" sortable="custom" show-overflow-tooltip/>
          <el-table-column label="关联的角色" prop="roleNames" :min-width="columnWidths['roleNames'] ?? 140" show-overflow-tooltip/>
          <el-table-column label="操作" align="center">
            <template #default="scope">
              <edit @click="handleEdit(scope.row)" class="operate-column-icon"/>
              <tickets @click="handleDetail(scope.row)" class="operate-column-icon"/>
            </template>
          </el-table-column>
        </el-table>
        </div>

      </el-main>
    </el-container>


  </div>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Pair } from '../../../components/model/Pair';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useTableAutoWidthContext } from '../../../components/pages/useTableAutoWidthContext';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';

class ResourcePermissionListPage extends TenantSupportListPage {

  private tree: any

  constructor(props, context, tree) {
    super(props, context)
    this.tree = tree
    this.loadDicts(["resource_type"], "sys")
  }

  protected initState(): any {
    return {
      resourceTreeProps: {
        label: 'title'
      },
      searchParams: {
        parentId: null,
        subSystemCode: null,
        resourceTypeDictCode: null,
        name: null,
        level: null
      },
      resourceTypes: [],
      searchSource: null,
      menus: []
    }
  }

  protected getRootActionPath(): String {
    return "rbac/resourcepermission"
  }

  /** 资源类型字典项译文从后端取 */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' }]
  }

  protected createSearchParams() {
    const params = super.createSearchParams()
    params.parentId = this.state.searchSource == "button" ? null : this.state.searchParams.parentId
    return params
  }

  protected async doSearch(): Promise<void> {
    this.state.searchSource = "button"
    const subSysOrTenant = super.parseSubSysOrTenant()
    if (!this.state.searchParams.resourceTypeDictCode) {
      ElMessage.error('请先选择资源类型！')
      return null
    }
    if (subSysOrTenant) {
      await this.loadMenus(subSysOrTenant.first)
      await super.doSearch()
    }
  }

  protected doAfterEdit(params: any) {
    super.doAfterEdit(params)
  }

  protected doAfterDelete(ids: Array<any>) {
    super.doAfterDelete(ids)
    for (let id of ids) {
      this.tree.value.remove({"id": id})
    }
  }

  private async loadMenus(subSystemCode) {
    const params = {
      subSystemCode: subSystemCode
    }
    // @ts-ignore
    const result = await backendRequest({ url: "sys/resource/loadDirectChildrenForTree", method: "post", params })
    const payload = getApiResponseData<any[]>(result)
    if (Array.isArray(payload)) {
      this.state.menus = payload
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '资源树加载失败！')
    }
  }

  public clickTreeNode: (nodeData, node) => void

  private async doClickTreeNode(nodeData, node) {
    if (node.level === 1 || node.level === 2) {
      return
    }
    this.resetSearchFields()
    this.setParamsForTree(node, false)
    // const params = {
    //   id: nodeData.id,
    //   resourceTypeDictCode: this.getResourceTypeByNode(node),
    // }
    const params = this.createSearchParams()
    params.id = nodeData.id
    params.resourceTypeDictCode = this.getResourceTypeByNode(node)
    // @ts-ignore
    const result = await backendRequest({url: "sys/resource/pagingSearch", method: "post", params});
    const payload = getApiResponseData<{ data?: unknown[]; totalCount?: number }>(result)
    if (payload != null && typeof payload === 'object' && 'data' in payload && 'totalCount' in payload) {
      this.state.tableData = payload.data ?? []
      this.state.pagination.total = payload.totalCount ?? 0
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '数据加载失败！')
    }
  }

  private setParamsForTree(node, expand: Boolean) {
    this.state.searchSource = "tree"
    this.state.searchParams.level = node.level
    if (node.level != 0) {
      if (node.level == 1) {
        this.state.searchParams.resourceTypeDictCode = node.data.id
        this.state.searchParams.subSystemCode = null
        this.state.searchParams.parentId = null
        this.state.searchParams.name = null
      } else if (node.level == 2) {
        this.state.searchParams.resourceTypeDictCode = node.parent.data.id
        this.state.searchParams.subSystemCode = node.data.id
        this.state.searchParams.parentId = null
        this.state.searchParams.name = null
      } else {
        this.state.searchParams.resourceTypeDictCode = this.getResourceTypeByNode(node)
        this.state.searchParams.subSystemCode = this.getSubSysByNode(node)
        this.state.searchParams.parentId = node.data.id
        if (!expand) {
          this.state.searchParams.name = node.data.name
        }
      }
    }
  }

  private getResourceTypeByNode(node) {
    while (node.level != 1) {
      node = node.parent
    }
    return node.data.id
  }

  private getSubSysByNode(node) {
    while (node.level != 2) {
      node = node.parent
    }
    return node.data.id
  }

  private async pagingSearch() {
    const params = this.createSearchParams()
    params["pageNo"] = this.state.pagination.pageNo
    params["pageSize"] = this.state.pagination.pageSize
    if (this.state.sort.orderProperty) {
      params["orders"] = [{
        property: this.state.sort.orderProperty,
        direction: this.state.sort.orderDirection,
      }]
    }
    // @ts-ignore
    const result = await backendRequest({url: "rbac/resourcepermission/searchTree", method: "post", params})
    const payload = getApiResponseData<{ data?: unknown[]; totalCount?: number }>(result)
    if (payload != null && typeof payload === 'object' && 'data' in payload && 'totalCount' in payload) {
      this.state.tableData = payload.data ?? []
      this.state.pagination.total = payload.totalCount ?? 0
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '数据加载失败！')
    }
  }

  protected isCheckStrictly(): boolean {
    return false
  }

  protected convertThis() {
    super.convertThis()
    this.clickTreeNode = (nodeData, node) => {
      this.doClickTreeNode(nodeData, node)
    }
  }

}

export default defineComponent({
  name: "~index",
  components: {},
  setup(props, context) {
    const { t } = useI18n();
    const tree = ref();
    const listPage = reactive(new ResourcePermissionListPage(props, context, tree)) as ResourcePermissionListPage & { state: Record<string, unknown> };
    const { listLayoutRefs } = useListPageLayout(listPage, {
    });
    const {
      RESERVED_WIDTH_LEFT,
      RESERVED_WIDTH_RIGHT,
      autoWidthColumns,
      tableDataRef,
      columnWidths,
    } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 0,
      reservedWidthRight: 0,
      createAutoWidthColumns: () => [
      { key: 'name', getLabel: () => '资源名称', sortable: true, getCellText: (row: Record<string, unknown>) => String(row.name ?? '') },
      { key: 'url', getLabel: () => 'URL', sortable: true, getCellText: (row: Record<string, unknown>) => String(row.url ?? '') },
      { key: 'roleNames', getLabel: () => '关联的角色', getCellText: (row: Record<string, unknown>) => String(row.roleNames ?? '') },
    ],
    });
    return {
      t,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      tree,
      ...listLayoutRefs,
      columnWidths,
    };
  },
})
</script>

<style lang='css' scoped>



</style>
