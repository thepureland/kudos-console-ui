<!--
 * Group memberships with validity windows.
 *
 * Backend (kudos-ms-auth):
 *   GET    /api/admin/auth/group/listMemberships?groupId=...   → every membership, windows included
 *   POST   /api/admin/auth/group/bindUserTemporal  { groupId, userId, startTime, endTime }
 *   DELETE /api/admin/auth/group/unbindUser?groupId=&userId=
 *
 * Why membership needs a window at all: joining a group hands the member every role the group
 * carries, so if a direct grant can expire and a membership cannot, "add them to the group instead"
 * becomes the documented way around the expiry somebody set. The list deliberately shows memberships
 * that are *not* currently in force too — a future-dated or lapsed row is a fact about the group
 * that a list of current members would hide.
 *
 * @author K
 * @author AI: Codex
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('groupMembership.title', { group: props.groupName })"
    width="820px"
    center
    class="add-edit-dialog group-membership-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-alert :title="t('groupMembership.intro')" type="info" :closable="false" show-icon class="gm-intro" />

    <el-form :inline="true" class="gm-editor">
      <el-form-item :label="t('groupMembership.labels.user')">
        <el-select
          v-model="draftUserId"
          filterable
          remote
          clearable
          :remote-method="searchUsers"
          :loading="userLoading"
          :placeholder="t('groupMembership.placeholders.user')"
          style="width: 220px"
        >
          <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('groupMembership.labels.window')">
        <el-date-picker
          v-model="draftWindow"
          type="datetimerange"
          :start-placeholder="t('groupMembership.placeholders.startTime')"
          :end-placeholder="t('groupMembership.placeholders.endTime')"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 340px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" :disabled="!draftUserId" @click="save">
          {{ t('groupMembership.buttons.save') }}
        </el-button>
      </el-form-item>
    </el-form>
    <div class="gm-hint">{{ t('groupMembership.hints.window') }}</div>

    <el-table v-loading="loading" :data="memberships" size="small" max-height="320" class="gm-table">
      <el-table-column :label="t('groupMembership.columns.user')" min-width="180">
        <template #default="{ row }">{{ row.userName ?? row.userId }}</template>
      </el-table-column>
      <el-table-column :label="t('groupMembership.columns.startTime')" min-width="160">
        <template #default="{ row }">{{ formatDateTime(row.startTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('groupMembership.columns.endTime')" min-width="160">
        <template #default="{ row }">{{ formatDateTime(row.endTime) }}</template>
      </el-table-column>
      <el-table-column :label="t('groupMembership.columns.status')" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'" size="small">
            {{ row.active ? t('groupMembership.status.active') : t('groupMembership.status.inactive') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('groupMembership.columns.operation')" width="130" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="edit(row)">
            {{ t('groupMembership.buttons.edit') }}
          </el-button>
          <el-button size="small" link type="danger" @click="remove(row)">
            {{ t('groupMembership.buttons.remove') }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="t('groupMembership.empty')" :image-size="72" />
      </template>
    </el-table>

    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('groupMembership.buttons.close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface Membership {
  id: string;
  groupId: string;
  userId: string;
  userName: string | null;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
}

interface UserOption {
  id: string;
  label: string;
}

export default defineComponent({
  name: 'GroupMembershipDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    gid: { type: String, required: true },
    groupName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const saving = ref(false);
    const userLoading = ref(false);
    const memberships = ref<Membership[]>([]);
    const userCandidates = ref<UserOption[]>([]);
    const draftUserId = ref<string>('');
    const draftWindow = ref<string[] | null>(null);

    async function load(): Promise<void> {
      loading.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/group/listMemberships',
          method: 'get',
          params: { groupId: props.gid },
        });
        memberships.value = getApiResponseData<Membership[]>(result) ?? [];
      } finally {
        loading.value = false;
      }
    }

    watch(
      () => props.modelValue,
      visible => {
        if (visible) {
          draftUserId.value = '';
          draftWindow.value = null;
          void load();
        }
      },
      { immediate: true },
    );

    async function searchUsers(keyword: string): Promise<void> {
      userLoading.value = true;
      try {
        const result = await backendRequest({
          url: 'user/account/search',
          method: 'post',
          params: { username: keyword || null, pageNo: 1, pageSize: 20 },
        });
        const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(result);
        const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : [];
        userCandidates.value = rows.map(row => ({
          id: String(row.id ?? ''),
          label: String(row.displayName ?? row.username ?? row.id ?? ''),
        }));
      } finally {
        userLoading.value = false;
      }
    }

    /** Load a row into the editor; saving is replace-by-pair, so this edits rather than duplicates. */
    function edit(row: Membership): void {
      draftUserId.value = row.userId;
      userCandidates.value = [{ id: row.userId, label: row.userName ?? row.userId }];
      draftWindow.value = row.startTime && row.endTime ? [row.startTime, row.endTime] : null;
    }

    async function save(): Promise<void> {
      saving.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/group/bindUserTemporal',
          method: 'post',
          params: {
            groupId: props.gid,
            userId: draftUserId.value,
            startTime: draftWindow.value?.[0] ?? null,
            endTime: draftWindow.value?.[1] ?? null,
          },
        });
        if (isApiSuccessResponse(result)) {
          ElMessage.success(t('groupMembership.messages.saved'));
          draftUserId.value = '';
          draftWindow.value = null;
          await load();
          context.emit('response', result);
        } else {
          // The policy layer refuses a membership that would breach a duty-separation rule and says
          // which — passing that through verbatim is the whole value of the message.
          ElMessage.error(resolveApiResponseMessage(result, t('groupMembership.messages.saveFailed')));
        }
      } finally {
        saving.value = false;
      }
    }

    async function remove(row: Membership): Promise<void> {
      try {
        await ElMessageBox.confirm(
          t('groupMembership.confirm.remove', { user: row.userName ?? row.userId }),
          t('groupMembership.confirm.title'),
          { type: 'warning' },
        );
      } catch {
        return; // dismissed
      }
      const result = await backendRequest({
        url: 'auth/group/unbindUser',
        method: 'delete',
        params: { groupId: props.gid, userId: row.userId },
      });
      if (isApiSuccessResponse(result)) {
        ElMessage.success(t('groupMembership.messages.removed'));
        await load();
        context.emit('response', result);
      } else {
        ElMessage.error(resolveApiResponseMessage(result, t('groupMembership.messages.removeFailed')));
      }
    }

    function formatDateTime(value: string | null): string {
      if (!value) return t('groupMembership.unbounded');
      return String(value).replace('T', ' ').slice(0, 19);
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    return {
      props,
      t,
      loading,
      saving,
      userLoading,
      memberships,
      userCandidates,
      draftUserId,
      draftWindow,
      searchUsers,
      edit,
      save,
      remove,
      formatDateTime,
      handleClose,
    };
  },
});
</script>

<style scoped>
.gm-intro {
  margin-bottom: 12px;
}

.gm-hint {
  margin: 0 0 12px 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.gm-table {
  width: 100%;
}
</style>
