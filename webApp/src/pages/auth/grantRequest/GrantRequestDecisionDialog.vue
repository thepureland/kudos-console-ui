<!--
 * Approve or reject a pending role-grant request, with an optional approver comment.
 *
 * Backend (AuthRoleGrantRequestAdminController, kudos-ms-auth):
 *   POST /api/admin/auth/roleGrantRequest/approve  body={ id, comment }  → boolean
 *   POST /api/admin/auth/roleGrantRequest/reject   body={ id, comment }  → boolean
 *
 * Approve performs the actual role↔user bind server-side and is still subject to SoD exclusion
 * checks, so it can fail even after the operator confirms — failures surface the backend message.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="isApprove ? t('grantRequestDecision.approveTitle') : t('grantRequestDecision.rejectTitle')"
    width="480px"
    center
    class="add-edit-dialog grant-request-decision-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-descriptions :column="1" border size="small" class="gr-summary">
      <el-descriptions-item :label="t('grantRequestDecision.fields.role')">{{ props.roleName || '—' }}</el-descriptions-item>
      <el-descriptions-item :label="t('grantRequestDecision.fields.user')">{{ props.userName || '—' }}</el-descriptions-item>
    </el-descriptions>
    <el-form label-position="top" class="gr-comment-form">
      <el-form-item :label="t('grantRequestDecision.labels.comment')">
        <el-input
          v-model="comment"
          type="textarea"
          :rows="3"
          :placeholder="isApprove ? t('grantRequestDecision.placeholders.approveComment') : t('grantRequestDecision.placeholders.rejectComment')"
          :maxlength="512"
          show-word-limit
          resize="none"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('grantRequestDecision.buttons.cancel') }}</el-button>
        <el-button :type="isApprove ? 'success' : 'danger'" :loading="submitting" @click="submit">
          {{ isApprove ? t('grantRequestDecision.buttons.approve') : t('grantRequestDecision.buttons.reject') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { backendRequest, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

export default defineComponent({
  name: 'GrantRequestDecisionDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    action: { type: String, required: true }, // 'approve' | 'reject'
    requestId: { type: String, required: true },
    roleName: { type: String, default: '' },
    userName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const comment = ref<string>('');
    const submitting = ref(false);
    const isApprove = computed(() => props.action === 'approve');

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      submitting.value = true;
      try {
        const url = isApprove.value ? 'auth/roleGrantRequest/approve' : 'auth/roleGrantRequest/reject';
        const result = await backendRequest({
          url,
          method: 'post',
          params: { id: props.requestId, comment: comment.value || null },
        });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result)
            || (isApprove.value ? t('grantRequestDecision.messages.approveFailed') : t('grantRequestDecision.messages.rejectFailed')));
          return;
        }
        ElMessage.success(isApprove.value ? t('grantRequestDecision.messages.approveSuccess') : t('grantRequestDecision.messages.rejectSuccess'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        submitting.value = false;
      }
    }

    return {
      props,
      t,
      comment,
      submitting,
      isApprove,
      handleClose,
      submit,
    };
  },
});
</script>

<style lang="css" scoped>
.grant-request-decision-dialog .gr-summary {
  margin-bottom: 12px;
}
.grant-request-decision-dialog .gr-comment-form {
  margin-top: 4px;
}
</style>
