<!--
 * 菜单权限列表：支持按子系统/租户筛选，展示菜单权限表格。
 *
 * @author: K
 * @since 1.0.0
 -->


<template>
  <div>
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/home' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>权限管理</el-breadcrumb-item>
      <el-breadcrumb-item>菜单权限列表</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="menu-list-card">
      <el-row :gutter="20" class="toolbar">
        <el-col :span="2">
          <el-cascader :options="subSysOrTenants" v-model="searchParams.subSysOrTenant"
                       :props="cascaderProps" :placeholder="t('organizationList.placeholders.subSysTenant')"/>
        </el-col>

        <el-col :span="16">
          <el-button type="primary" round @click="search">搜索</el-button>
          <el-button type="primary" round @click="resetSearchFields">重置</el-button>
        </el-col>
      </el-row>

      <div ref="tableWrapRef">
      <el-table border stripe :data="tableData" :max-height="tableMaxHeight" @selection-change="handleSelectionChange"
                :header-cell-style="{textAlign: 'center'}" @sort-change="handleSortChange" default-expand-all
                row-key="id">
        <el-table-column type="index" min-width="50"/>
        <el-table-column label="名称" prop="name" :min-width="columnWidths['name'] ?? 120" show-overflow-tooltip/>
        <el-table-column label="URL" prop="url" :min-width="columnWidths['url'] ?? 120" show-overflow-tooltip/>
        <el-table-column label="关联的角色" prop="roleNames" :min-width="columnWidths['roleNames'] ?? 140" show-overflow-tooltip/>

        <el-table-column label="操作" align="center">
          <template #default="scope">
            <edit @click="handleEdit(scope.row)" class="operate-column-icon"/>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <menu-role-assign-dialog v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit"
                               :rid="rid" :subSystemCode="subSystemCode" :tenantId="tenantId"/>

    </el-card>

  </div>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import MenuRoleAssignDialog from './MenuRoleAssignDialog.vue';
import { useListPageLayout, useTableAutoWidthContext } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';


class MenuPermissionListPage extends TenantSupportListPage {

  constructor(props, context) {
    super(props, context)
  }

  protected initState(): any {
  }

  protected getRootActionPath(): String {
    return "rbac/resourcepermission"
  }

  protected getSearchUrl(): String {
    return this.getRootActionPath() + "/searchTree"
  }

  protected isCheckStrictly(): boolean {
    return false
  }

}

export default defineComponent({
  name: "~index",
  components: {MenuRoleAssignDialog},
  setup(props, context) {
    const { t } = useI18n();
    const listPage = reactive(new MenuPermissionListPage(props, context)) as MenuPermissionListPage & { state: Record<string, unknown> };
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
      { key: 'name', getLabel: () => '名称', getCellText: (row: Record<string, unknown>) => String(row.name ?? '') },
      { key: 'url', getLabel: () => 'URL', getCellText: (row: Record<string, unknown>) => String(row.url ?? '') },
      { key: 'roleNames', getLabel: () => '关联的角色', getCellText: (row: Record<string, unknown>) => String(row.roleNames ?? '') },
    ],
    });
    return {
      t,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      ...listLayoutRefs,
      columnWidths,
    };
  },
})
</script>

<style lang='css' scoped>
.menu-list-card :deep(.el-card__body) {
  padding: 5px;
}
</style>
