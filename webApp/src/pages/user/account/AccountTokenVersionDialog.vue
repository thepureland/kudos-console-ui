<!--
 * Inspect a user's permission version and invalidate every token currently held by that user.
 *
 * Backend (kudos-ms-auth):
 *   GET  /api/admin/auth/version/current?userId=...
 *   POST /api/admin/auth/version/revokeAllTokens?userId=...&reason=...
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('accountTokenVersion.title', { user: props.userName || props.userId })"
    width="560px"
    center
    class="add-edit-dialog account-token-version-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="close"
  >
    <el-alert
      :title="t('accountTokenVersion.warning')"
      type="warning"
      :closable="false"
      show-icon
      class="atv-warning"
    />
    <el-descriptions :column="1" border class="atv-version">
      <el-descriptions-item :label="t('accountTokenVersion.labels.currentVersion')">
        <span v-if="loading">{{ t('accountTokenVersion.loading') }}</span>
        <code v-else>{{ currentVersion || '-' }}</code>
      </el-descriptions-item>
    </el-descriptions>
    <el-form label-width="100px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('accountTokenVersion.labels.reason')" class="is-required">
        <el-input
          v-model="reason"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          :placeholder="t('accountTokenVersion.placeholders.reason')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="close">{{ t('accountTokenVersion.actions.cancel') }}</el-button>
        <el-button type="danger" :loading="revoking" :disabled="!reason.trim()" @click="revokeAllTokens">
          {{ t('accountTokenVersion.actions.revoke') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

const props = defineProps<{
  modelValue: boolean;
  userId: string;
  userName?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { t } = useI18n();
const loading = ref(false);
const revoking = ref(false);
const currentVersion = ref('');
const reason = ref('');

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return;
    reason.value = '';
    void loadCurrentVersion();
  },
  { immediate: true },
);

async function loadCurrentVersion(): Promise<void> {
  if (!props.userId) return;
  loading.value = true;
  try {
    const result = await backendRequest({
      url: 'auth/version/current',
      method: 'get',
      params: { userId: props.userId, principalType: 'USER' },
    });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(await resolveApiResponseMessage(result) || t('accountTokenVersion.messages.loadFailed'));
      return;
    }
    const value = getApiResponseData<unknown>(result);
    currentVersion.value = value == null ? '' : String(value);
  } finally {
    loading.value = false;
  }
}

async function revokeAllTokens(): Promise<void> {
  const trimmedReason = reason.value.trim();
  if (!trimmedReason) return;
  try {
    await ElMessageBox.confirm(
      t('accountTokenVersion.confirm.body', { user: props.userName || props.userId }),
      t('accountTokenVersion.confirm.title'),
      {
        type: 'warning',
        confirmButtonText: t('accountTokenVersion.actions.confirmRevoke'),
        cancelButtonText: t('accountTokenVersion.actions.cancel'),
      },
    );
  } catch {
    return;
  }

  revoking.value = true;
  try {
    const result = await backendRequest({
      url: 'auth/version/revokeAllTokens',
      method: 'post',
      params: { userId: props.userId, reason: trimmedReason },
    });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(await resolveApiResponseMessage(result) || t('accountTokenVersion.messages.revokeFailed'));
      return;
    }
    ElMessage.success(t('accountTokenVersion.messages.revoked'));
    reason.value = '';
    await loadCurrentVersion();
  } finally {
    revoking.value = false;
  }
}

function close(): void {
  emit('update:modelValue', false);
}
</script>

<style lang="css" scoped>
.atv-warning,
.atv-version {
  margin-bottom: 18px;
}

.atv-version code {
  overflow-wrap: anywhere;
}
</style>
