<!--
 * SoD role-exclusion detail + live violation scan.
 *
 * Backend (AuthRoleExclusionAdminController, kudos-ms-auth):
 *   GET /api/admin/auth/roleExclusion/getDetail?id=...        → AuthRoleExclusionDetail
 *   GET /api/admin/auth/roleExclusion/findViolations?id=...   → AuthRoleExclusionViolationVo
 *
 * Role + violating-user IDs are resolved to display names via the respective pagingSearch.
 * The violation scan is "lax-mode": it surfaces users who currently hold BOTH roles (a state
 * that can pre-exist a rule, since adding a rule doesn't retroactively unbind anyone).
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('roleExclusionDetail.title')" v-model="visible" width="48%" center @close="close">
    <div v-loading="loading" class="rx-body">
      <section class="rx-section">
        <h3 class="rx-section-title">{{ t('roleExclusionDetail.sections.pair') }}</h3>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('roleExclusionDetail.fields.roleA')">{{ roleALabel }}</el-descriptions-item>
          <el-descriptions-item :label="t('roleExclusionDetail.fields.roleB')">{{ roleBLabel }}</el-descriptions-item>
          <el-descriptions-item :label="t('roleExclusionDetail.fields.description')">{{ detail.description || '—' }}</el-descriptions-item>
          <el-descriptions-item :label="t('roleExclusionDetail.fields.createUser')">{{ detail.createUserName || '—' }}</el-descriptions-item>
          <el-descriptions-item :label="t('roleExclusionDetail.fields.createTime')">{{ formatDate(detail.createTime) }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="rx-section">
        <h3 class="rx-section-title">
          {{ t('roleExclusionDetail.sections.violations') }}
          <span class="rx-count" :class="{ 'rx-count--bad': violationRows.length > 0 }">({{ violationRows.length }})</span>
        </h3>
        <el-alert
          v-if="violationRows.length === 0 && !loading"
          :title="t('roleExclusionDetail.noViolations')"
          type="success"
          :closable="false"
          show-icon
        />
        <el-table v-else-if="violationRows.length" :data="violationRows" stripe border max-height="280" size="small">
          <el-table-column type="index" width="50" />
          <el-table-column :label="t('roleExclusionDetail.columns.userId')" prop="userId" show-overflow-tooltip />
          <el-table-column :label="t('roleExclusionDetail.columns.username')" prop="username" show-overflow-tooltip />
        </el-table>
      </section>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('roleExclusionDetail.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import { type TransferItem, normalizeIdSet, resolveAssignedItems } from '../_shared/assignmentTransferUtils';

interface ViolationRow {
  userId: string;
  username: string;
}

const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');
const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

class RoleExclusionDetailPage extends BaseDetailPage {
  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'auth/roleExclusion';
  }

  protected initState(): any {
    return {
      loading: true,
      detail: {} as Record<string, unknown>,
      roleALabel: '',
      roleBLabel: '',
      violationRows: [] as ViolationRow[],
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    this.state.detail = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    void this.resolveRoleLabels();
    void this.loadViolations();
    super.postLoadDataSuccessfully(data);
  }

  /** Resolve roleAId / roleBId → display names in one batched pagingSearch. */
  private async resolveRoleLabels(): Promise<void> {
    const d = this.state.detail as Record<string, unknown>;
    const ids = [d.roleAId, d.roleBId].filter(Boolean).map(String);
    if (ids.length === 0) return;
    const items = await resolveAssignedItems({ searchUrl: 'auth/role/pagingSearch', ids, pickLabel: roleLabel });
    const byId = new Map(items.map(i => [i.key, i.label]));
    this.state.roleALabel = byId.get(String(d.roleAId ?? '')) ?? String(d.roleAId ?? '');
    this.state.roleBLabel = byId.get(String(d.roleBId ?? '')) ?? String(d.roleBId ?? '');
  }

  private async loadViolations(): Promise<void> {
    try {
      const result = await backendRequest({
        url: this.getRootActionPath() + '/findViolations',
        method: 'get',
        params: { id: this.props.rid },
      });
      if (!isApiSuccessResponse(result)) return;
      const payload = getApiResponseData<{ violatingUserIds?: unknown }>(result);
      const userIds = normalizeIdSet(payload?.violatingUserIds);
      if (userIds.length === 0) { this.state.violationRows = []; return; }
      const items: TransferItem[] = await resolveAssignedItems({
        searchUrl: 'user/account/pagingSearch',
        ids: userIds,
        pickLabel: userLabel,
      });
      const nameById = new Map(items.map(i => [i.key, i.label]));
      this.state.violationRows = userIds.map(uid => ({ userId: uid, username: nameById.get(uid) ?? uid }));
    } finally {
      this.state.loading = false;
    }
  }
}

export default defineComponent({
  name: 'RoleExclusionDetailPage',
  props: {
    modelValue: Boolean,
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const page = reactive(new RoleExclusionDetailPage(props, context));
    return {
      t,
      ...toRefs(page),
      ...toRefs(page.state),
    };
  },
});
</script>

<style lang="css" scoped>
.rx-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
}
.rx-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.rx-count {
  margin-left: 6px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}
.rx-count--bad {
  color: var(--el-color-danger);
}
</style>
