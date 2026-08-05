<!--
 * Delegate a role — hand it to somebody on the current operator's own authority, rather than as a
 * plain administrative assignment.
 *
 * Backend (kudos-ms-auth):
 *   POST /api/admin/auth/role/grant  { roleId, userIds, delegableDepth, startTime, endTime }
 *
 * Why this is a separate dialog from "bind users": a delegation is screened against what the
 * operator actually holds (reach, power, population, lifetime) and records a chain, so revoking the
 * operator later takes these grants with it. The two extra inputs here — how far it may travel on,
 * and when it ends — are exactly what makes that possible, and neither has a sensible default the
 * dialog could hide.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('roleDelegation.title', { role: props.roleName })"
    width="620px"
    center
    class="add-edit-dialog role-delegation-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-alert :title="t('roleDelegation.intro')" type="info" :closable="false" show-icon class="rdl-intro" />
      <el-form label-width="130px" label-position="right" class="add-edit-dialog-form">
        <el-form-item :label="t('roleDelegation.labels.users')" class="is-required">
          <el-select
            v-model="selectedUserIds"
            multiple
            filterable
            remote
            clearable
            :remote-method="searchUsers"
            :loading="userLoading"
            :placeholder="t('roleDelegation.placeholders.users')"
            class="rdl-full"
          >
            <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('roleDelegation.labels.depth')">
          <el-input-number v-model="delegableDepth" :min="0" :max="8" :step="1" controls-position="right" />
          <span class="form-item-hint">{{ t('roleDelegation.hints.depth') }}</span>
        </el-form-item>
        <el-form-item :label="t('roleDelegation.labels.window')">
          <el-date-picker
            v-model="window"
            type="datetimerange"
            :start-placeholder="t('roleDelegation.placeholders.startTime')"
            :end-placeholder="t('roleDelegation.placeholders.endTime')"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="rdl-full"
          />
          <span class="form-item-hint">{{ t('roleDelegation.hints.window') }}</span>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('roleDelegation.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" :disabled="selectedUserIds.length === 0" @click="submit">
          {{ t('roleDelegation.buttons.confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface UserOption {
  id: string;
  label: string;
}

export default defineComponent({
  name: 'RoleDelegationDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
    roleName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const submitting = ref(false);
    const userLoading = ref(false);
    const userCandidates = ref<UserOption[]>([]);
    const selectedUserIds = ref<string[]>([]);
    const delegableDepth = ref(0);
    const window = ref<string[] | null>(null);

    async function searchUsers(keyword: string): Promise<void> {
      userLoading.value = true;
      try {
        const result = await backendRequest({
          url: 'user/account/search',
          method: 'post',
          data: { username: keyword || null, pageNo: 1, pageSize: 20 },
        });
        const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>> }>(result);
        const rows = Array.isArray(payload?.rows) ? payload!.rows! : [];
        userCandidates.value = rows.map(row => ({
          id: String(row.id ?? ''),
          label: String(row.displayName ?? row.username ?? row.id ?? ''),
        }));
      } finally {
        userLoading.value = false;
      }
    }

    function handleClose(): void {
      selectedUserIds.value = [];
      delegableDepth.value = 0;
      window.value = null;
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      submitting.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/role/grant',
          method: 'post',
          data: {
            roleId: props.rid,
            userIds: selectedUserIds.value,
            delegableDepth: delegableDepth.value,
            startTime: window.value?.[0] ?? null,
            endTime: window.value?.[1] ?? null,
          },
        });
        if (isApiSuccessResponse(result)) {
          const ids = getApiResponseData<string[]>(result) ?? [];
          ElMessage.success(t('roleDelegation.messages.granted', { n: ids.length }));
          context.emit('response', result);
          handleClose();
        } else {
          // The backend rejects the whole call when any recipient is inadmissible and names which
          // rule stopped it — surfacing that verbatim is the point, a generic "failed" would send
          // the operator to the logs.
          ElMessage.error(resolveApiResponseMessage(result, t('roleDelegation.messages.failed')));
        }
      } finally {
        submitting.value = false;
      }
    }

    return {
      props,
      t,
      loading,
      submitting,
      userLoading,
      userCandidates,
      selectedUserIds,
      delegableDepth,
      window,
      searchUsers,
      handleClose,
      submit,
    };
  },
});
</script>

<style scoped>
.rdl-full {
  width: 100%;
}

.rdl-intro {
  margin-bottom: 12px;
}

.form-item-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
