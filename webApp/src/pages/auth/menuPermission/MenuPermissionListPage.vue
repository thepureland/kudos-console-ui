<!--
 * Menu permission list: pick a subsystem, then view the menu tree with the roles authorized for each menu.
 *
 * Data sources (kudos-ms-sys owns the menus, kudos-ms-auth owns the role↔resource mapping):
 *   GET  sys/resource/getMenus?subSystemCode=...                → menu tree (MenuTreeNode: title/index/children)
 *   POST auth/resourcepermission/roleNamesByResourceIds [ids]   → { menuId: [roleName, ...] }
 *
 * Per-row "view roles" opens ResourceRoleListDialog (read-only list of the granting roles).
 *
 * @author K
 * @author AI: Codex
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="menu-permission-page list-page-common">
    <el-card class="menu-permission-card">
      <el-row :gutter="8" class="toolbar">
        <el-col :span="4">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants || []"
            :props="cascaderProps"
            :placeholder="t('menuPermissionList.placeholders.subSysTenant')"
            clearable
            class="mp-full"
          />
        </el-col>
        <el-col :span="16">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('menuPermissionList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('menuPermissionList.actions.reset') }}
          </el-button>
        </el-col>
      </el-row>

      <div ref="tableWrapRef">
        <el-table
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          default-expand-all
          row-key="id"
        >
          <el-table-column :label="t('menuPermissionList.columns.name')" prop="title" :min-width="columnWidths['title'] ?? 200" show-overflow-tooltip />
          <el-table-column :label="t('menuPermissionList.columns.url')" prop="index" :min-width="columnWidths['index'] ?? 160" show-overflow-tooltip />
          <el-table-column :label="t('menuPermissionList.columns.roleNames')" prop="roleNames" :min-width="columnWidths['roleNames'] ?? 180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.roleNames || '—' }}</template>
          </el-table-column>
          <el-table-column :label="t('menuPermissionList.columns.operation')" align="center" min-width="100" fixed="right">
            <template #default="scope">
              <el-tooltip :content="t('menuPermissionList.actions.viewRoles')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="openRoleList(scope.row)">
                  <View />
                </el-icon>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <resource-role-list-dialog v-if="roleListDialogVisible" v-model="roleListDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { RefreshLeft, Search, View } from '@element-plus/icons-vue';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { useListPageLayout, useTableAutoWidthContext } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import ResourceRoleListDialog from '../role/ResourceRoleListDialog.vue';

type MenuNode = Record<string, unknown> & { id?: string; children?: MenuNode[] };

class MenuPermissionListPage extends TenantSupportListPage {

  protected initState(): Record<string, unknown> {
    return {
      roleListDialogVisible: false,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  openRoleList(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.roleListDialogVisible = true;
  }

  /** Menus form a tree (no pagination); load the whole subsystem tree, then overlay role names. */
  protected async doSearch(): Promise<void> {
    const pair = this.parseSubSysOrTenant();
    if (!pair?.first) {
      ElMessage.warning(this.tr('menuPermissionList.messages.selectSubSysFirst'));
      return;
    }
    const result = await backendRequest({ url: 'sys/resource/getMenus', method: 'get', params: { subSystemCode: pair.first } });
    if (!isApiSuccessResponse(result)) {
      // Prefer resolved async message, fall back to sync payload message, then hard-coded i18n fallback.
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('menuPermissionList.messages.loadFailed'));
      this.state.tableData = [];
      return;
    }
    const tree = getApiResponseData<MenuNode[]>(result);
    this.state.tableData = Array.isArray(tree) ? tree : [];
    void this.enrichRoleNames();
  }

  /** Walk the tree, batch-resolve role names for every node id, then patch each node (best-effort). */
  private async enrichRoleNames(): Promise<void> {
    const roots = this.state.tableData as MenuNode[];
    if (!Array.isArray(roots) || roots.length === 0) return;

    // Iterative BFS/DFS flatten — avoids call-stack overflow on deep menu trees.
    const nodes: MenuNode[] = [];
    const stack: MenuNode[] = [...roots];
    while (stack.length) {
      const n = stack.pop()!;
      nodes.push(n);
      if (Array.isArray(n.children) && n.children.length) stack.push(...n.children);
    }

    const ids = nodes.map(n => String(n.id ?? '')).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const result = await backendRequest({ url: 'auth/resourcepermission/roleNamesByResourceIds', method: 'post', params: ids as unknown as Record<string, unknown> });
      if (!isApiSuccessResponse(result)) return;
      const map = getApiResponseData<Record<string, string[]>>(result) ?? {};
      for (const n of nodes) {
        const names = map[String(n.id ?? '')];
        n.roleNames = Array.isArray(names) ? names.join(', ') : '';
      }
    } catch {
      // Aggregator unavailable (e.g. mock mode): leave roleNames blank rather than failing the search.
    }
  }
}

export default defineComponent({
  name: 'MenuPermissionListPage',
  components: { ResourceRoleListDialog, Search, RefreshLeft, View },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new MenuPermissionListPage(props, context)) as MenuPermissionListPage & { state: Record<string, unknown> };
    const { listLayoutRefs } = useListPageLayout(listPage, {});
    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 0,
      reservedWidthRight: 0,
      createAutoWidthColumns: () => [
        { key: 'title', getLabel: () => t('menuPermissionList.columns.name'), getCellText: (row: Record<string, unknown>) => String(row.title ?? '') },
        { key: 'index', getLabel: () => t('menuPermissionList.columns.url'), getCellText: (row: Record<string, unknown>) => String(row.index ?? '') },
        { key: 'roleNames', getLabel: () => t('menuPermissionList.columns.roleNames'), getCellText: (row: Record<string, unknown>) => String(row.roleNames ?? '') },
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
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang='css' scoped>
.menu-permission-page {
  height: 100%;
}
.menu-permission-card {
  height: 100%;
  margin-top: 3px;
}
.menu-permission-card :deep(.el-card__body) {
  padding: 8px 5px 5px 5px;
}
.menu-permission-page .toolbar {
  margin-bottom: 8px;
}
.menu-permission-page .mp-full {
  width: 100%;
}
</style>
