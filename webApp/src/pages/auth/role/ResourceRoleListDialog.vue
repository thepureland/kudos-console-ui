<!--
 * Read-only list of roles that are granted access to a given resource.
 *
 * Backend (kudos-ms-auth AuthRoleAdminController):
 *   GET /api/admin/auth/role/listRoleIdsByResource?resourceId=...  → Set<roleId>
 * Role metadata is resolved via auth/role/pagingSearch.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('resourceRoleList.title')" v-model="visible" width="50%" center @close="close">
    <el-table border stripe :data="tableData" max-height="480"
              :header-cell-style="{textAlign: 'center'}">
      <el-table-column type="index" width="50"/>
      <el-table-column :label="t('resourceRoleList.columns.roleCode')" prop="roleCode" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.roleCode ?? scope.row.code }}</template>
      </el-table-column>
      <el-table-column :label="t('resourceRoleList.columns.roleName')" prop="roleName" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.roleName ?? scope.row.name }}</template>
      </el-table-column>
      <el-table-column :label="t('resourceRoleList.columns.subSystemCode')" prop="subSystemCode" show-overflow-tooltip>
        <template #default="scope">{{ transAtomicService(scope.row.subSystemCode) }}</template>
      </el-table-column>
      <el-table-column :label="t('resourceRoleList.columns.active')" prop="active" width="80">
        <template #default="scope">
          {{ scope.row.active ? t('resourceRoleList.common.yes') : t('resourceRoleList.common.no') }}
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('resourceRoleList.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

class ResourceRoleListDialog extends BaseDetailPage {
  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'auth/role';
  }

  protected initState(): any {
    return {
      tableData: [] as Array<Record<string, unknown>>,
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listRoleIdsByResource';
  }

  protected createDetailLoadParams(): any {
    return { resourceId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const ids: string[] = Array.isArray(data)
      ? data.map(String)
      : (data && typeof data === 'object'
          ? Array.from(Object.values(data as Record<string, unknown>)).map(String)
          : []);
    if (ids.length === 0) {
      this.state.tableData = [];
    } else {
      this.resolveRoles(ids).then(rows => { this.state.tableData = rows; });
    }
    super.postLoadDataSuccessfully(data);
  }

  private async resolveRoles(ids: string[]): Promise<Array<Record<string, unknown>>> {
    const params: Record<string, unknown> = {
      pageNo: 1,
      pageSize: Math.max(ids.length, 50),
      ids,
    };
    const result = await backendRequest({ url: 'auth/role/pagingSearch', method: 'post', params });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Failed to load roles');
      return [];
    }
    const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
    const rows: Array<Record<string, unknown>> = Array.isArray(payload)
      ? payload
      : (payload?.data ?? []);
    const idSet = new Set(ids.map(String));
    return rows.filter(r => idSet.has(String(r.id ?? '')));
  }
}

export default defineComponent({
  name: 'ResourceRoleListDialog',
  props: {
    modelValue: Boolean,
    /** Resource id whose role-grants we are inspecting. */
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new ResourceRoleListDialog(props, context));
    return {
      t,
      ...toRefs(dialog),
      ...toRefs(dialog.state),
    };
  },
});
</script>

<style lang='css' scoped>
</style>
