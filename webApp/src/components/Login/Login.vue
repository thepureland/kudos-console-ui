<template>
  <div class="login-page">
    <RainEffect />
    <div class="login-card-wrapper">
      <el-card class="login-card" shadow="always">
        <template #header>
          <div class="login-header">
            <h1 class="login-title">Kudos Console</h1>
            <p class="login-subtitle">Please sign in</p>
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
          <el-form-item label="Username" prop="username">
            <el-input
              v-model="form.username"
              placeholder="Please enter your username"
              size="large"
              clearable
              :prefix-icon="User"
              maxlength="32"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="Password" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="Please enter your password"
              size="large"
              show-password
              clearable
              :prefix-icon="Lock"
              maxlength="64"
              @keyup.enter="focusTotp"
            />
          </el-form-item>

          <el-form-item label="Verification code" prop="totpCode">
            <el-input
              ref="totpInputRef"
              v-model="form.totpCode"
              placeholder="Please enter the 6-digit code"
              size="large"
              clearable
              :prefix-icon="Key"
              maxlength="6"
              show-word-limit
              inputmode="numeric"
              autocomplete="one-time-code"
              @keyup.enter="handleSubmit"
            />
            <div class="totp-tip">Please use the 6-digit one-time code from an app like Google Authenticator</div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              native-type="submit"
            >
              {{ loading ? 'Signing in...' : 'Sign in' }}
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
import { User, Lock, Key } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { LoginRequest, AuthApiFactory } from 'shared';
import RainEffect from './RainEffect.vue';
import './Login.css';

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
    { required: true, message: 'Please enter your username', trigger: 'blur' },
    { min: 2, message: 'Username must be at least 2 characters', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Please enter your password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
  ],
  totpCode: [
    { required: true, message: 'Please enter your Google Authenticator code', trigger: 'blur' },
    { len: 6, message: 'Verification code must be 6 digits', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: 'Verification code must be 6 digits', trigger: 'blur' },
  ],
};

const loading = ref(false);
// Rain-layer container ref (used to dynamically insert raindrops/ripples).

function focusTotp() {
  totpInputRef.value?.focus();
}


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
    ElMessage.success('Login successful');
    await router.push('/home');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Login failed';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

</script>
