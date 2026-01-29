<template>
  <div class="login-page">
    <RainEffect />
    <div class="login-card-wrapper">
      <el-card class="login-card" shadow="always">
        <template #header>
          <div class="login-header">
            <h1 class="login-title">Kudos控制台</h1>
            <p class="login-subtitle">请登录</p>
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
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              size="large"
              clearable
              :prefix-icon="User"
              maxlength="32"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              show-password
              clearable
              :prefix-icon="Lock"
              maxlength="64"
              @keyup.enter="focusTotp"
            />
          </el-form-item>

          <el-form-item label="验证码" prop="totpCode">
            <el-input
              ref="totpInputRef"
              v-model="form.totpCode"
              placeholder="请输入 6 位验证码"
              size="large"
              clearable
              :prefix-icon="Key"
              maxlength="6"
              show-word-limit
              inputmode="numeric"
              autocomplete="one-time-code"
              @keyup.enter="handleSubmit"
            />
            <div class="totp-tip">请使用 Google Authenticator 等应用生成的 6 位动态码</div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              native-type="submit"
            >
              {{ loading ? '登录中...' : '登录' }}
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { User, Lock, Key } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { LoginRequest, AuthApiFactory } from 'shared';
import RainEffect from './RainEffect.vue';
import './Login.css';

const formRef = ref<FormInstance>();
const totpInputRef = ref<{ focus: () => void }>();

const form = reactive({
  username: '',
  password: '',
  totpCode: '',
});

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少 2 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 个字符', trigger: 'blur' },
  ],
  totpCode: [
    { required: true, message: '请输入谷歌动态验证码', trigger: 'blur' },
    { len: 6, message: '验证码为 6 位数字', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
};

const loading = ref(false);
// 雨层容器引用（用于动态插入雨滴/涟漪）

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
      .join('；');
    ElMessage.warning(msg);
    return;
  }

  loading.value = true;
  try {
    const api = AuthApiFactory.getInstance().getAuthApi();
    await api.login(request);
    ElMessage.success('登录成功');
    location.reload();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '登录失败';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

</script>
