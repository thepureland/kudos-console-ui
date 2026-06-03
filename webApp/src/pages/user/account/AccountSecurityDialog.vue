<!--
 * Account security operations dialog (admin side). One component, four input-driven modes:
 *   - resetPassword          POST /api/admin/user/account/resetPassword          { id, newPassword }
 *   - resetSecurityPassword  POST /api/admin/user/account/resetSecurityPassword  { id, newPassword }
 *   - resetAuthKey           POST /api/admin/user/account/resetAuthKey           { id, accountName, issuer? } -> { secret, otpauthUrl }
 *   - freeze                 POST /api/admin/user/account/freezeAccount          { id, freezeType, freezeTitle?, freezeContent?, freezeStartTime?, freezeEndTime? }
 *
 * The toggle-active / cleanAuthKey / unfreeze operations need no input and are handled inline in the list page
 * via a confirm box. Emits `response` on success so the list can refresh; emits `update:modelValue=false` to close.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="title"
    width="520px"
    center
    align-center
    class="add-edit-dialog account-security-dialog"
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- Password reset (login / security password share this form) -->
    <el-form v-if="isPasswordMode" label-width="92px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('accountSecurity.password.newPassword')">
        <el-input
          v-model="newPassword"
          type="password"
          show-password
          :placeholder="t('accountSecurity.password.newPasswordPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('accountSecurity.password.confirmPassword')">
        <el-input
          v-model="confirmPassword"
          type="password"
          show-password
          :placeholder="t('accountSecurity.password.confirmPasswordPlaceholder')"
          @keyup.enter="submit"
        />
      </el-form-item>
    </el-form>

    <!-- Two-factor (TOTP) reset: generate a new secret, then show it for the user to re-enroll -->
    <div v-else-if="mode === 'resetAuthKey'" class="account-security-2fa">
      <el-alert :title="t('accountSecurity.authKey.intro')" type="warning" :closable="false" show-icon class="asd-alert" />
      <template v-if="!authKeyResult">
        <div class="asd-2fa-actions">
          <el-button type="primary" :loading="submitting" @click="generateAuthKey">
            {{ t('accountSecurity.authKey.generate') }}
          </el-button>
        </div>
      </template>
      <template v-else>
        <el-form label-width="92px" label-position="right" class="add-edit-dialog-form">
          <el-form-item :label="t('accountSecurity.authKey.secret')">
            <el-input :model-value="authKeyResult.secret" readonly>
              <template #append>
                <el-button @click="copy(authKeyResult.secret)">{{ t('accountSecurity.authKey.copy') }}</el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item :label="t('accountSecurity.authKey.otpauthUrl')">
            <el-input :model-value="authKeyResult.otpauthUrl" readonly type="textarea" :rows="2">
            </el-input>
          </el-form-item>
        </el-form>
        <el-text size="small" type="info" class="asd-hint">{{ t('accountSecurity.authKey.scanHint') }}</el-text>
      </template>
    </div>

    <!-- Freeze account -->
    <el-form v-else label-width="92px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('accountSecurity.freeze.type')">
        <el-select v-model="freezeType" class="asd-full" :placeholder="t('accountSecurity.freeze.typePlaceholder')">
          <el-option v-for="ft in freezeTypeOptions" :key="ft.value" :value="ft.value" :label="ft.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('accountSecurity.freeze.freezeTitle')">
        <el-input v-model="freezeTitle" :placeholder="t('accountSecurity.freeze.freezeTitlePlaceholder')" />
      </el-form-item>
      <el-form-item :label="t('accountSecurity.freeze.content')">
        <el-input v-model="freezeContent" type="textarea" :rows="2" :placeholder="t('accountSecurity.freeze.contentPlaceholder')" />
      </el-form-item>
      <el-form-item :label="t('accountSecurity.freeze.startTime')">
        <el-date-picker
          v-model="freezeStartTime"
          type="datetime"
          class="asd-full"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :placeholder="t('accountSecurity.freeze.startTimePlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('accountSecurity.freeze.endTime')">
        <el-date-picker
          v-model="freezeEndTime"
          type="datetime"
          class="asd-full"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :placeholder="t('accountSecurity.freeze.endTimePlaceholder')"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">
          {{ mode === 'resetAuthKey' && authKeyResult ? t('accountSecurity.authKey.done') : t('accountSecurity.buttons.cancel') }}
        </el-button>
        <el-button v-if="showConfirmButton" type="primary" :loading="submitting" @click="submit">
          {{ t('accountSecurity.buttons.confirm') }}
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
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

type SecurityMode = 'resetPassword' | 'resetSecurityPassword' | 'resetAuthKey' | 'freeze';
const FREEZE_TYPES = ['manual', 'admin', 'auto', 'scheduled'] as const;

interface AuthKeyResult { secret: string; otpauthUrl: string; }

export default defineComponent({
  name: 'AccountSecurityDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
    username: { type: String, default: '' },
    mode: { type: String, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const submitting = ref(false);

    const mode = computed(() => props.mode as SecurityMode);
    const isPasswordMode = computed(() => mode.value === 'resetPassword' || mode.value === 'resetSecurityPassword');

    // password mode
    const newPassword = ref('');
    const confirmPassword = ref('');

    // 2FA mode
    const authKeyResult = ref<AuthKeyResult | null>(null);

    // freeze mode
    const freezeType = ref<string>('manual');
    const freezeTitle = ref('');
    const freezeContent = ref('');
    const freezeStartTime = ref<string | null>(null);
    const freezeEndTime = ref<string | null>(null);
    const freezeTypeOptions = computed(() => FREEZE_TYPES.map(v => ({ value: v, label: t(`accountSecurity.freeze.types.${v}`) })));

    const title = computed(() => {
      switch (mode.value) {
        case 'resetPassword': return t('accountSecurity.password.title');
        case 'resetSecurityPassword': return t('accountSecurity.password.securityTitle');
        case 'resetAuthKey': return t('accountSecurity.authKey.title');
        case 'freeze': return t('accountSecurity.freeze.title');
        default: return '';
      }
    });

    // The 2FA "generate" button lives in the body; once a result is shown there is no footer confirm.
    const showConfirmButton = computed(() => mode.value !== 'resetAuthKey');

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function copy(text: string): Promise<void> {
      try {
        await navigator.clipboard.writeText(text);
        ElMessage.success(t('accountSecurity.authKey.copied'));
      } catch {
        // Clipboard may be unavailable (insecure context); the field is selectable as a fallback.
      }
    }

    async function submitPassword(): Promise<void> {
      if (!newPassword.value) { ElMessage.warning(t('accountSecurity.password.empty')); return; }
      if (newPassword.value !== confirmPassword.value) { ElMessage.warning(t('accountSecurity.password.mismatch')); return; }
      const url = mode.value === 'resetSecurityPassword' ? 'user/account/resetSecurityPassword' : 'user/account/resetPassword';
      await run(url, { id: props.rid, newPassword: newPassword.value });
    }

    async function submitFreeze(): Promise<void> {
      if (freezeStartTime.value && freezeEndTime.value && freezeEndTime.value <= freezeStartTime.value) {
        ElMessage.warning(t('accountSecurity.freeze.timeRangeError'));
        return;
      }
      const params: Record<string, unknown> = { id: props.rid, freezeType: freezeType.value };
      if (freezeTitle.value) params.freezeTitle = freezeTitle.value;
      if (freezeContent.value) params.freezeContent = freezeContent.value;
      if (freezeStartTime.value) params.freezeStartTime = freezeStartTime.value;
      if (freezeEndTime.value) params.freezeEndTime = freezeEndTime.value;
      await run('user/account/freezeAccount', params);
    }

    /** Shared submit for password + freeze: POST with @RequestParam (query) semantics, then emit + close. */
    async function run(url: string, params: Record<string, unknown>): Promise<void> {
      submitting.value = true;
      try {
        const result = await backendRequest({ url, method: 'post', params, paramsInQuery: true });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('accountSecurity.messages.failed'));
          return;
        }
        ElMessage.success(t('accountSecurity.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err) || t('accountSecurity.messages.failed'));
      } finally {
        submitting.value = false;
      }
    }

    async function generateAuthKey(): Promise<void> {
      submitting.value = true;
      try {
        const result = await backendRequest({
          url: 'user/account/resetAuthKey',
          method: 'post',
          params: { id: props.rid, accountName: props.username || props.rid },
          paramsInQuery: true,
        });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('accountSecurity.messages.failed'));
          return;
        }
        const data = getApiResponseData<AuthKeyResult>(result);
        if (data && data.secret) {
          authKeyResult.value = data;
          context.emit('response');
        } else {
          ElMessage.error(t('accountSecurity.messages.failed'));
        }
      } catch (err) {
        ElMessage.error(String(err) || t('accountSecurity.messages.failed'));
      } finally {
        submitting.value = false;
      }
    }

    function submit(): void {
      if (isPasswordMode.value) void submitPassword();
      else if (mode.value === 'freeze') void submitFreeze();
    }

    return {
      props,
      t,
      mode,
      title,
      submitting,
      isPasswordMode,
      showConfirmButton,
      newPassword,
      confirmPassword,
      authKeyResult,
      freezeType,
      freezeTitle,
      freezeContent,
      freezeStartTime,
      freezeEndTime,
      freezeTypeOptions,
      handleClose,
      submit,
      generateAuthKey,
      copy,
    };
  },
});
</script>

<style lang="css" scoped>
.account-security-dialog .asd-full {
  width: 100%;
}
.account-security-dialog .asd-alert {
  margin-bottom: 16px;
}
.account-security-dialog .asd-2fa-actions {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.account-security-dialog .asd-hint {
  display: block;
  margin-top: 4px;
}
</style>
