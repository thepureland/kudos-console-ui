<!--
 * Resource permission list: filter resources by type / subsystem-tenant / name, and show which roles
 * are granted each resource.
 *
 * Data sources (kudos-ms-sys owns the resources, kudos-ms-auth owns the role↔resource mapping):
 *   POST sys/resource/pagingSearch                              → paged resource rows
 *   POST auth/resourcepermission/roleNamesByResourceIds [ids]   → { resourceId: [roleName, ...] }
 *
 * Per-row "view roles" opens ResourceRoleListDialog (read-only list of the granting roles).
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="resource-permission-page list-page-common">
    <el-card class="resource-permission-card">
      <el-row :gutter="8" class="toolbar">
        <el-col :span="4">
          <el-select
            v-model="searchParams.resourceTypeDictCode"
            :placeholder="t('resourcePermissionList.placeholders.resourceType')"
            clearable
            class="rp-full"
          >
            <el-option
              v-for="item in getDictItems('sys', 'resource_type')"
              :key="item.first"
              :value="item.first"
              :label="t(item.second)"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants || []"
            :props="cascaderProps"
            :placeholder="t('organizationList.placeholders.subSysTenant')"
            clearable
            class="rp-full"
          />
        </el-col>
        <el-col :span="4">
          <el-input
            v-model="searchParams.name"
            :placeholder="t('resourcePermissionList.placeholders.name')"
            clearable
            @keyup.enter="search"
            @change="search"
          />
        </el-col>
        <el-col :span="12">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('resourcePermissionList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('resourcePermissionList.actions.reset') }}
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
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="index" min-width="50" />
          <el-table-column :label="t('resourcePermissionList.columns.name')" prop="name" :min-width="columnWidths['name'] ?? 140" sortable="custom" show-overflow-tooltip />
          <el-table-column :label="t('resourcePermissionList.columns.url')" prop="url" :min-width="columnWidths['url'] ?? 160" sortable="custom" show-overflow-tooltip />
          <el-table-column :label="t('resourcePermissionList.columns.roleNames')" prop="roleNames" :min-width="columnWidths['roleNames'] ?? 180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.roleNames || '—' }}</template>
          </el-table-column>
          <el-table-column :label="t('resourcePermissionList.columns.operation')" align="center" min-width="100" fixed="right">
            <template #default="scope">
              <el-tooltip :content="t('resourcePermissionList.actions.viewRoles')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="openRoleList(scope.row)">
                  <View />
                </el-icon>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-pagination
        class="pagination-right"
        :current-page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />

      <resource-role-list-dialog v-if="roleListDialogVisible" v-model="roleListDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { RefreshLeft, Search, View } from '@element-plus/icons-vue';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import { useListPageLayout, useTableAutoWidthContext } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import ResourceRoleListDialog from '../role/ResourceRoleListDialog.vue';

class ResourcePermissionListPage extends TenantSupportListPage {

  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context as never);
    this.loadDicts(['resource_type'], 'sys');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        resourceTypeDictCode: null as string | null,
        subSystemCode: null as string | null,
        name: null as string | null,
      },
      roleListDialogVisible: false,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  /** Rows come from sys/resource; the role overlay is fetched separately in postSearchSuccessfully. */
  protected getSearchUrl(): string {
    return 'sys/resource/pagingSearch';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' }];
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  openRoleList(row: Record<string, unknown>): void {
    this.state.rid = this.getRowId(row);
    this.state.roleListDialogVisible = true;
  }

  /**
   * Build the resource query explicitly from searchParams (subSystemCode included) rather than via
   * TenantSupport.createSearchParams, which would overwrite subSystemCode from the cascader pair.
   */
  protected createSearchParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const sort = this.state.sort as { orderProperty?: string; orderDirection?: string } | undefined;
    if (sort?.orderProperty) params.orders = [{ property: sort.orderProperty, direction: sort.orderDirection }];
    const pg = this.state.pagination as { pageNo?: number; pageSize?: number } | undefined;
    if (pg) { params.pageNo = pg.pageNo; params.pageSize = pg.pageSize; }
    const sp = this.state.searchParams as Record<string, unknown>;
    params.resourceTypeDictCode = sp.resourceTypeDictCode ?? null;
    params.subSystemCode = sp.subSystemCode ?? null;
    params.name = sp.name ?? null;
    return params;
  }

  protected async doSearch(): Promise<void> {
    const sp = this.state.searchParams as Record<string, unknown>;
    if (!sp.resourceTypeDictCode) {
      ElMessage.warning(this.tr('resourcePermissionList.messages.selectTypeFirst'));
      return;
    }
    // Subsystem is driven by the cascader's first level; tenant is irrelevant to resource scoping.
    const pair = this.parseSubSysOrTenant();
    sp.subSystemCode = pair?.first ?? null;
    await super.doSearch();
  }

  protected postSearchSuccessfully(data: unknown): void {
    super.postSearchSuccessfully(data);
    void this.enrichRoleNames();
  }

  /** Overlay each resource row with its granting role names via the auth aggregator (best-effort). */
  private async enrichRoleNames(): Promise<void> {
    const rows = this.state.tableData as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return;
    const ids = rows.map(r => String(r.id ?? '')).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const result = await backendRequest({ url: 'auth/resourcepermission/roleNamesByResourceIds', method: 'post', params: ids as unknown as Record<string, unknown> });
      if (!isApiSuccessResponse(result)) return;
      const map = getApiResponseData<Record<string, string[]>>(result) ?? {};
      for (const row of rows) {
        const names = map[String(row.id ?? '')];
        row.roleNames = Array.isArray(names) ? names.join(', ') : '';
      }
    } catch {
      // Aggregator unavailable (e.g. mock mode): leave roleNames blank rather than failing the search.
    }
  }
}

export default defineComponent({
  name: 'ResourcePermissionListPage',
  components: { ResourceRoleListDialog, Search, RefreshLeft, View },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const { t } = useI18n();
    const listPage = reactive(new ResourcePermissionListPage(props, context)) as ResourcePermissionListPage & { state: Record<string, unknown> };
    const { listLayoutRefs } = useListPageLayout(listPage, {});
    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 0,
      reservedWidthRight: 0,
      createAutoWidthColumns: () => [
        { key: 'name', getLabel: () => t('resourcePermissionList.columns.name'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.name ?? '') },
        { key: 'url', getLabel: () => t('resourcePermissionList.columns.url'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.url ?? '') },
        { key: 'roleNames', getLabel: () => t('resourcePermissionList.columns.roleNames'), getCellText: (row: Record<string, unknown>) => String(row.roleNames ?? '') },
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
.resource-permission-page {
  height: 100%;
}
.resource-permission-card {
  height: 100%;
  margin-top: 3px;
}
.resource-permission-card :deep(.el-card__body) {
  padding: 8px 5px 5px 5px;
}
.resource-permission-page .toolbar {
  margin-bottom: 8px;
}
.resource-permission-page .rp-full {
  width: 100%;
}
.resource-permission-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
