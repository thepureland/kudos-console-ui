<!--
 * Role-grant request detail.
 *
 * Backend (AuthRoleGrantRequestAdminController, kudos-ms-auth):
 *   GET /api/admin/auth/roleGrantRequest/getDetail?id=...  → AuthRoleGrantRequestDetail
 *
 * Role + user (target / requester / approver) ids are resolved to display names via the
 * respective pagingSearch. Read-only — workflow actions live on the list page.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('grantRequestDetail.title')" v-model="visible" width="46%" center @close="close">
    <div v-loading="loading" class="gr-body">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item :label="t('grantRequestDetail.fields.role')">{{ roleLabelText }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.user')">{{ userLabelText }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.status')">
          <el-tag :type="statusTagType(detail.status)" disable-transitions>{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.reason')">{{ detail.reason || '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.requester')">{{ requesterLabelText }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.requestTime')">{{ formatDate(detail.requestTime) }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.approver')">{{ approverLabelText }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.decisionComment')">{{ detail.decisionComment || '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.decisionTime')">{{ detail.decisionTime ? formatDate(detail.decisionTime) : '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.createUser')">{{ detail.createUserName || '—' }}</el-descriptions-item>
        <el-descriptions-item :label="t('grantRequestDetail.fields.createTime')">{{ formatDate(detail.createTime) }}</el-descriptions-item>
      </el-descriptions>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('grantRequestDetail.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { resolveAssignedItems } from '../_shared/assignmentTransferUtils';

// Label extractors: try the most-descriptive field first, fall back to id.
// NOTE: identical copies live in GrantRequestFormPage.vue — keep in sync if field names change.
const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');
const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

class GrantRequestDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'auth/roleGrantRequest';
  }

  protected initState(): any {
    return {
      loading: true,
      detail: {} as Record<string, unknown>,
      roleLabelText: '',
      userLabelText: '',
      requesterLabelText: '—',
      approverLabelText: '—',
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    this.state.detail = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
    // Kick off label resolution in parallel with the super call; loading flag cleared after both.
    void this.resolveLabels();
    super.postLoadDataSuccessfully(data);
    this.state.loading = false;
  }

  /** Resolve roleId + (userId / requesterId / approverId) → display names in two batched searches. */
  private async resolveLabels(): Promise<void> {
    const d = this.state.detail as Record<string, unknown>;
    const userIds = [d.userId, d.requesterId, d.approverId].filter(Boolean).map(String);
    const [roleItems, userItems] = await Promise.all([
      d.roleId ? resolveAssignedItems({ searchUrl: 'auth/role/pagingSearch', ids: [String(d.roleId)], pickLabel: roleLabel }) : Promise.resolve([]),
      userIds.length ? resolveAssignedItems({ searchUrl: 'user/account/pagingSearch', ids: userIds, pickLabel: userLabel }) : Promise.resolve([]),
    ]);
    const roleById = new Map(roleItems.map(i => [i.key, i.label]));
    const userById = new Map(userItems.map(i => [i.key, i.label]));
    this.state.roleLabelText = d.roleId ? (roleById.get(String(d.roleId)) ?? String(d.roleId)) : '—';
    this.state.userLabelText = d.userId ? (userById.get(String(d.userId)) ?? String(d.userId)) : '—';
    this.state.requesterLabelText = d.requesterId ? (userById.get(String(d.requesterId)) ?? String(d.requesterId)) : '—';
    this.state.approverLabelText = d.approverId ? (userById.get(String(d.approverId)) ?? String(d.approverId)) : '—';
  }
}

export default defineComponent({
  name: 'GrantRequestDetailPage',
  props: {
    modelValue: Boolean,
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const page = reactive(new GrantRequestDetailPage(props, context));

    const statusLabel = (s: string | null | undefined): string => (s ? t(`grantRequestList.status.${s}`) : '—');
    const statusTagType = (s: string | null | undefined): 'warning' | 'success' | 'danger' | 'info' => {
      switch (s) {
        case 'PENDING': return 'warning';
        case 'APPROVED': return 'success';
        case 'REJECTED': return 'danger';
        default: return 'info';
      }
    };

    return {
      t,
      statusLabel,
      statusTagType,
      ...toRefs(page),
      ...toRefs(page.state),
    };
  },
});
</script>

<style lang="css" scoped>
.gr-body {
  min-height: 120px;
}
</style>
