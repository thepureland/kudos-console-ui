<!--
 * Menu permission list: filter by subsystem/tenant; renders the menu permission table.
 *
 * @author: K
 * @since 1.0.0
 -->


<template>
  <div>
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/home' }">Home</el-breadcrumb-item>
      <el-breadcrumb-item>Permission Management</el-breadcrumb-item>
      <el-breadcrumb-item>Menu Permission List</el-breadcrumb-item>
    </el-breadcrumb>

    <el-card class="menu-list-card">
      <el-row :gutter="20" class="toolbar">
        <el-col :span="2">
          <el-cascader :options="subSysOrTenants" v-model="searchParams.subSysOrTenant"
                       :props="cascaderProps" :placeholder="t('organizationList.placeholders.subSysTenant')"/>
        </el-col>

        <el-col :span="16">
          <el-button type="primary" round @click="search">Search</el-button>
          <el-button type="primary" round @click="resetSearchFields">Reset</el-button>
        </el-col>
      </el-row>

      <div ref="tableWrapRef">
      <el-table border stripe :data="tableData" :max-height="tableMaxHeight" @selection-change="handleSelectionChange"
                :header-cell-style="{textAlign: 'center'}" @sort-change="handleSortChange" default-expand-all
                row-key="id">
        <el-table-column type="index" min-width="50"/>
        <el-table-column label="Name" prop="name" :min-width="columnWidths['name'] ?? 120" show-overflow-tooltip/>
        <el-table-column label="URL" prop="url" :min-width="columnWidths['url'] ?? 120" show-overflow-tooltip/>
        <el-table-column label="Associated Roles" prop="roleNames" :min-width="columnWidths['roleNames'] ?? 140" show-overflow-tooltip/>

        <el-table-column :label="t('menuPermissionList.columns.operation')" align="center" min-width="120">
          <template #default="scope">
            <el-tooltip :content="t('menuPermissionList.actions.edit')" placement="top" :enterable="false">
              <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                <Edit />
              </el-icon>
            </el-tooltip>
            <el-tooltip :content="t('menuPermissionList.actions.viewRoles')" placement="top" :enterable="false">
              <el-icon :size="20" class="operate-column-icon" @click="openRoleList(scope.row)">
                <View />
              </el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <menu-role-assign-dialog v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit"
                               :rid="rid" :subSystemCode="subSystemCode" :tenantId="tenantId"/>
      <resource-role-list-dialog v-if="roleListDialogVisible" v-model="roleListDialogVisible" :rid="rid"/>

    </el-card>

  </div>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Edit, View } from '@element-plus/icons-vue';
import MenuRoleAssignDialog from './MenuRoleAssignDialog.vue';
import ResourceRoleListDialog from '../role/ResourceRoleListDialog.vue';
import { useListPageLayout, useTableAutoWidthContext } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';


class MenuPermissionListPage extends TenantSupportListPage {

  constructor(props, context) {
    super(props, context)
  }

  protected initState(): any {
    return {
      roleListDialogVisible: false,
    };
  }

  protected getRootActionPath(): String {
    return "auth/resourcepermission"
  }

  protected getSearchUrl(): String {
    return this.getRootActionPath() + "/searchTree"
  }

  protected isCheckStrictly(): boolean {
    return false
  }

  openRoleList(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.roleListDialogVisible = true;
  }

}

export default defineComponent({
  name: "~index",
  components: { MenuRoleAssignDialog, ResourceRoleListDialog, Edit, View },
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
      { key: 'name', getLabel: () => 'Name', getCellText: (row: Record<string, unknown>) => String(row.name ?? '') },
      { key: 'url', getLabel: () => 'URL', getCellText: (row: Record<string, unknown>) => String(row.url ?? '') },
      { key: 'roleNames', getLabel: () => 'Associated Roles', getCellText: (row: Record<string, unknown>) => String(row.roleNames ?? '') },
    ],
    });
    return {
      t,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      ...listLayoutRefs,
      columnWidths,
      openRoleList: (row: Record<string, unknown>) => listPage.openRoleList(row),
    };
  },
})
</script>

<style lang='css' scoped>
.menu-list-card :deep(.el-card__body) {
  padding: 5px;
}
</style>
