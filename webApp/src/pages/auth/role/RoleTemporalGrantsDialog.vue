<!--
 * View all temporal role grants for a role: active, expired and future, with usernames resolved.
 *
 * Backend (AuthRoleUserTemporalAdminController):
 *   GET /api/admin/auth/roleUserTemporal/getGrantsByRole?roleId=...
 *       → List<RoleTemporalGrantRow> { id, userId, startTime?, endTime?, active }
 *
 * Row status: active (green) / expired (grey) / future (blue pending).
 * Admins can open the grant dialog from here to set a new window for any user.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :title="t('roleTemporalGrants.title')"
    v-model="visible"
    width="56%"
    center
    @close="close"
  >
    <div v-loading="loading" class="rtg-body">
      <el-alert
        v-if="!loading && rows.length === 0"
        :title="t('roleTemporalGrants.empty')"
        type="info"
        :closable="false"
        show-icon
      />
      <el-table v-else-if="rows.length" :data="rows" stripe border max-height="400" size="small">
        <el-table-column type="index" width="50" />
        <el-table-column :label="t('roleTemporalGrants.columns.user')" min-width="150" show-overflow-tooltip>
          <template #default="scope">{{ scope.row._username ?? scope.row.userId }}</template>
        </el-table-column>
        <el-table-column :label="t('roleTemporalGrants.columns.status')" width="90" align="center">
          <template #default="scope">
            <el-tag :type="statusType(scope.row)" size="small" disable-transitions>{{ statusLabel(scope.row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('roleTemporalGrants.columns.startTime')" min-width="145" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.startTime ? formatDate(scope.row.startTime) : t('roleTemporalGrants.permanent') }}</template>
        </el-table-column>
        <el-table-column :label="t('roleTemporalGrants.columns.endTime')" min-width="145" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.endTime ? formatDate(scope.row.endTime) : t('roleTemporalGrants.permanent') }}</template>
        </el-table-column>
        <el-table-column :label="t('roleTemporalGrants.columns.operation')" align="center" width="90">
          <template #default="scope">
            <el-tooltip :content="t('roleTemporalGrants.actions.regrant')" placement="top" :enterable="false">
              <el-icon :size="18" class="rtg-icon" @click="emit('regrant', scope.row.userId)">
                <Clock />
              </el-icon>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('roleTemporalGrants.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue';
import { Clock } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import { resolveAssignedItems } from '../_shared/assignmentTransferUtils';

interface GrantRow {
  id: string;
  userId: string;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  _username?: string;
}

const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  // ISO string → readable
  return raw.replace('T', ' ').substring(0, 19);
}

export default defineComponent({
  name: 'RoleTemporalGrantsDialog',
  components: { Clock },
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
  },
  emits: ['update:modelValue', 'regrant'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const rows = ref<GrantRow[]>([]);

    const visible = computed({
      get: () => props.modelValue,
      set: (v) => context.emit('update:modelValue', v),
    });

    function statusType(row: GrantRow): 'success' | 'info' | 'primary' {
      if (!row.active) {
        // Distinguish expired (past end) from future (not started)
        const now = new Date().toISOString();
        if (row.endTime && row.endTime < now) return 'info';      // expired
        if (row.startTime && row.startTime > now) return 'primary'; // future
        return 'info';
      }
      return 'success';
    }

    function statusLabel(row: GrantRow): string {
      if (!row.active) {
        const now = new Date().toISOString();
        if (row.endTime && row.endTime < now) return t('roleTemporalGrants.status.expired');
        if (row.startTime && row.startTime > now) return t('roleTemporalGrants.status.future');
        return t('roleTemporalGrants.status.expired');
      }
      return t('roleTemporalGrants.status.active');
    }

    async function load(): Promise<void> {
      loading.value = true;
      rows.value = [];
      try {
        const res = await backendRequest({
          url: 'auth/roleUserTemporal/getGrantsByRole',
          method: 'get',
          params: { roleId: props.rid },
        });
        if (!isApiSuccessResponse(res)) return;
        const data = getApiResponseData<GrantRow[]>(res);
        rows.value = Array.isArray(data) ? data : [];
        if (rows.value.length > 0) {
          const userIds = [...new Set(rows.value.map(r => r.userId))];
          const items = await resolveAssignedItems({ searchUrl: 'user/account/pagingSearch', ids: userIds, pickLabel: userLabel });
          const byId = new Map(items.map(i => [i.key, i.label]));
          for (const r of rows.value) {
            r._username = byId.get(r.userId) ?? r.userId;
          }
        }
      } finally {
        loading.value = false;
      }
    }

    watch(() => props.modelValue, (v) => { if (v) void load(); });

    function close(): void {
      context.emit('update:modelValue', false);
    }

    return {
      t, visible, loading, rows, formatDate, statusType, statusLabel, close,
      emit: (event: string, payload: unknown) => context.emit(event as 'update:modelValue' | 'regrant', payload as string),
    };
  },
});
</script>

<style lang="css" scoped>
.rtg-body {
  min-height: 80px;
}
.rtg-icon {
  cursor: pointer;
  color: var(--el-color-primary);
}
.rtg-icon:hover {
  opacity: 0.7;
}
</style>
