<template>
  <div class="login-page">
    <RainEffect />
    <div class="login-card-wrapper">
      <el-card class="login-card" shadow="always">
        <template #header>
          <div class="login-header">
            <h1 class="login-title">Kudos Console</h1>
            <p class="login-subtitle">{{ t('login.subtitle') }}</p>
          </div>
        </template>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          class="login-form"
          @submit.prevent="handleSubmit"
        >
          <el-form-item :label="t('login.username')" prop="username">
            <el-input
              v-model="form.username"
              :placeholder="t('login.usernamePlaceholder')"
              size="large"
              clearable
              :prefix-icon="User"
              maxlength="32"
              show-word-limit
            />
          </el-form-item>

          <el-form-item :label="t('login.password')" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              :placeholder="t('login.passwordPlaceholder')"
              size="large"
              show-password
              clearable
              :prefix-icon="Lock"
              maxlength="64"
              @keyup.enter="focusTotp"
            />
          </el-form-item>

          <el-form-item :label="t('login.totp')" prop="totpCode">
            <el-input
              ref="totpInputRef"
              v-model="form.totpCode"
              :placeholder="t('login.totpPlaceholder')"
              size="large"
              clearable
              :prefix-icon="Key"
              maxlength="6"
              show-word-limit
              inputmode="numeric"
              autocomplete="one-time-code"
              @keyup.enter="handleSubmit"
            />
            <div class="totp-tip">{{ t('login.totpTip') }}</div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              native-type="submit"
            >
              {{ loading ? t('login.signingIn') : t('login.signIn') }}
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { User, Lock, Key } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { LoginRequest, AuthApiFactory } from 'shared';
import RainEffect from './RainEffect.vue';
import './Login.css';

const { t } = useI18n();
const router = useRouter();
const store = useStore();

const formRef = ref<FormInstance>();
const totpInputRef = ref<{ focus: () => void }>();

const form = reactive({
  username: '',
  password: '',
  totpCode: '',
});

const rules: FormRules = {
  username: [
    { required: true, message: t('login.validation.requiredUsername'), trigger: 'blur' },
    { min: 2, message: t('login.validation.usernameMin'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('login.validation.requiredPassword'), trigger: 'blur' },
    { min: 6, message: t('login.validation.passwordMin'), trigger: 'blur' },
  ],
  totpCode: [
    { required: true, message: t('login.validation.requiredTotp'), trigger: 'blur' },
    // `len` enforces exactly 6 characters; `pattern` separately enforces digits-only.
    // Both reuse the same user-facing message intentionally.
    { len: 6, message: t('login.validation.totpLen'), trigger: 'blur' },
    { pattern: /^\d{6}$/, message: t('login.validation.totpLen'), trigger: 'blur' },
  ],
};

const loading = ref(false);

function focusTotp() {
  totpInputRef.value?.focus();
}

// `async` is required so that Element Plus `validate` (called with a callback) returns a
// settled promise; without it, an invalid form would throw an unhandled rejection.
async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate((valid) => {
    if (!valid) return;
    doLogin();
  });
}

async function doLogin() {
  const request = new LoginRequest(form.username, form.password, form.totpCode);
  const validation = request.validate();
  if (!validation.isValid()) {
    const msg = [validation.usernameError, validation.passwordError, validation.totpError]
      .filter(Boolean)
      .join('; ');
    ElMessage.warning(msg);
    return;
  }

  loading.value = true;
  try {
    const api = AuthApiFactory.getInstance().getAuthApi();
    await api.login(request);
    store.commit('setAuthenticated', true);
    ElMessage.success(t('login.loginSuccess'));
    await router.push('/home');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('login.loginFailed');
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

</script>
