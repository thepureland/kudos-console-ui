<!--
 * Revoke a grant, after showing what else goes with it.
 *
 * Backend (kudos-ms-auth):
 *   GET    /api/admin/auth/role/getRevokeImpact?grantId=...        → the cascade preview
 *   DELETE /api/admin/auth/role/revoke?grantId=&reason=...         → soft-revoke the subtree
 *
 * The preview is not a nicety. Revocation cascades down the delegation chain, and the size of that
 * chain is invisible from the grant being revoked — without showing it first, "take this person's
 * access away" silently becomes "take forty people's access away". So the dialog loads the impact
 * before it will let the button be pressed.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('grantRevoke.title')"
    width="640px"
    center
    class="add-edit-dialog grant-revoke-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-alert
        :title="cascadeCount > 0 ? t('grantRevoke.warning', { n: cascadeCount, users: impact?.affectedUserCount ?? 0 }) : t('grantRevoke.noCascade')"
        :type="cascadeCount > 0 ? 'warning' : 'info'"
        :closable="false"
        show-icon
        class="grd-alert"
      />

      <el-table v-if="cascadeCount > 0" :data="impact?.cascadedGrants ?? []" size="small" max-height="240" class="grd-table">
        <el-table-column prop="userId" :label="t('grantRevoke.columns.user')" min-width="200" />
        <el-table-column prop="roleId" :label="t('grantRevoke.columns.role')" min-width="200" />
        <el-table-column prop="depth" :label="t('grantRevoke.columns.depth')" width="90" align="center" />
      </el-table>

      <el-form label-width="90px" label-position="right" class="add-edit-dialog-form grd-form">
        <el-form-item :label="t('grantRevoke.labels.reason')">
          <el-input
            v-model="reason"
            type="textarea"
            :rows="2"
            :placeholder="t('grantRevoke.placeholders.reason')"
            maxlength="256"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('grantRevoke.buttons.cancel') }}</el-button>
        <el-button type="danger" :loading="submitting" :disabled="loading" @click="submit">
          {{ t('grantRevoke.buttons.confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface CascadedGrant {
  grantId: string;
  roleId: string;
  userId: string;
  depth: number;
}

interface RevokeImpact {
  grantId: string;
  roleId: string;
  userId: string;
  cascadedGrants: CascadedGrant[];
  affectedUserCount: number;
}

export default defineComponent({
  name: 'GrantRevokeDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    grantId: { type: String, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const submitting = ref(false);
    const reason = ref('');
    const impact = ref<RevokeImpact | null>(null);

    const cascadeCount = computed(() => impact.value?.cascadedGrants?.length ?? 0);

    async function loadImpact(): Promise<void> {
      if (!props.grantId) return;
      loading.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/role/getRevokeImpact',
          method: 'get',
          params: { grantId: props.grantId },
        });
        impact.value = getApiResponseData<RevokeImpact>(result) ?? null;
      } finally {
        loading.value = false;
      }
    }

    // Load whenever the dialog opens, never from a stale previous grant.
    watch(
      () => [props.modelValue, props.grantId],
      ([visible]) => {
        if (visible) {
          impact.value = null;
          reason.value = '';
          void loadImpact();
        }
      },
      { immediate: true },
    );

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      submitting.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/role/revoke',
          method: 'delete',
          params: { grantId: props.grantId, reason: reason.value || null },
        });
        if (isApiSuccessResponse(result)) {
          const revoked = getApiResponseData<number>(result) ?? 0;
          ElMessage.success(t('grantRevoke.messages.revoked', { n: revoked }));
          context.emit('response', result);
          handleClose();
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('grantRevoke.messages.failed')));
        }
      } finally {
        submitting.value = false;
      }
    }

    return { props, t, loading, submitting, reason, impact, cascadeCount, handleClose, submit };
  },
});
</script>

<style scoped>
.grd-alert {
  margin-bottom: 12px;
}

.grd-table {
  margin-bottom: 12px;
}

.grd-form {
  margin-top: 4px;
}
</style>
