<!--
 * Read-only list of users currently assigned to a role.
 *
 * Backend (kudos-ms-auth AuthRoleAdminController):
 *   GET /api/admin/auth/role/listUserIds?roleId=...  → Set<userId>
 * User metadata is resolved via user/account/pagingSearch.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('roleUserList.title')" v-model="visible" width="60%" center @close="close">
    <el-table border stripe :data="tableData" max-height="480"
              :header-cell-style="{textAlign: 'center'}">
      <el-table-column type="index" width="50"/>
      <el-table-column :label="t('roleUserList.columns.username')" prop="username" show-overflow-tooltip/>
      <el-table-column :label="t('roleUserList.columns.subSystemCode')" prop="subSystemCode" show-overflow-tooltip>
        <template #default="scope">
          {{ transAtomicService(scope.row.subSystemCode) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('roleUserList.columns.userStatus')" prop="userStatusDictCode" show-overflow-tooltip>
        <template #default="scope">
          {{ t(transDict('user', 'user_status', scope.row.userStatusDictCode)) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('roleUserList.columns.userType')" prop="userTypeDictCode" show-overflow-tooltip>
        <template #default="scope">
          {{ t(transDict('user', 'user_type', scope.row.userTypeDictCode)) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('roleUserList.columns.lastLogin')" show-overflow-tooltip>
        <template #default="scope">
          {{ formatDate(scope.row.lastLoginTime) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('roleUserList.columns.createTime')" show-overflow-tooltip>
        <template #default="scope">
          {{ formatDate(scope.row.createTime) }}
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('roleUserList.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { tGlobal } from '../../../i18n';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

class UserListDialog extends BaseDetailPage {
  constructor(props: any, context: any) {
    super(props, context);
    this.loadDicts(['user_status', 'user_type'], 'user');
  }

  protected getRootActionPath(): string {
    return 'auth/role';
  }

  protected initState(): any {
    return {
      tableData: [] as Array<Record<string, unknown>>,
    };
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['user_status', 'user_type'], atomicServiceCode: 'user' }];
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listUserIds';
  }

  protected createDetailLoadParams(): any {
    return { roleId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    // The backend returns the assigned user IDs as either an array or a Set-like object.
    // Normalise to a plain string array before fetching user details.
    const ids: string[] = Array.isArray(data)
      ? data.map(String)
      : (data && typeof data === 'object'
          ? Array.from(Object.values(data as Record<string, unknown>)).map(String)
          : []);
    if (ids.length === 0) {
      this.state.tableData = [];
    } else {
      this.resolveUsers(ids).then(rows => { this.state.tableData = rows; });
    }
    super.postLoadDataSuccessfully(data);
  }

  /**
   * Fetches full user records for the given IDs via a paging search, then
   * filters the result down to exactly those IDs (the search may return extras).
   */
  private async resolveUsers(ids: string[]): Promise<Array<Record<string, unknown>>> {
    const params: Record<string, unknown> = {
      pageNo: 1,
      // Request at least 50 to avoid a tiny page-size when there are few IDs.
      pageSize: Math.max(ids.length, 50),
      ids,
    };
    const result = await backendRequest({ url: 'user/account/pagingSearch', method: 'post', params });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tGlobal('listPage.loadFailed'));
      return [];
    }
    // The paging response may wrap records under a `data` property or return them directly.
    const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
    const rows: Array<Record<string, unknown>> = Array.isArray(payload)
      ? payload
      : (payload?.data ?? []);
    // Guard against the search returning users outside the requested ID set.
    const idSet = new Set(ids.map(String));
    return rows.filter(r => idSet.has(String(r.id ?? r.userId ?? '')));
  }
}

export default defineComponent({
  name: 'UserListDialog',
  props: {
    modelValue: Boolean,
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new UserListDialog(props, context));
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
