<template>
  <div class="page">
    <el-card class="card" shadow="always" v-loading="loading">
      <template #header>
        <div class="header">
          <div>
            <div class="title">已登录（Mock）</div>
            <div class="subtitle">用于本地跑通前后端交互流程</div>
          </div>
          <el-button type="danger" plain @click="handleLogout">退出登录</el-button>
        </div>
      </template>

      <el-alert
        title="Mock 说明"
        type="info"
        :closable="false"
        show-icon
        class="mb16"
      >
        <template #default>
          登录接口：<code>/api/auth/login</code>，默认验证码：<code>000000</code>
        </template>
      </el-alert>

      <el-descriptions title="当前用户 (/api/me)" :column="1" border class="mb16">
        <el-descriptions-item label="用户名">{{ me?.username ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="展示名">{{ me?.displayName ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ meRoles }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="菜单 (/api/menus)" :column="1" border>
        <el-descriptions-item label="JSON">
          <pre class="pre">{{ menusText }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { AuthApiFactory } from 'shared';
import type { User, MenuItem } from 'shared';

const me = ref<User | null>(null);
const menus = ref<MenuItem[] | null>(null);
const loading = ref(false);

const meRoles = computed(() => {
  const roles = me.value?.roles ?? [];
  return roles.length > 0 ? roles.join(', ') : '-';
});

const menusText = computed(() => {
  if (!menus.value) {
    return '';
  }
  try {
    return JSON.stringify(menus.value, null, 2);
  } catch {
    return String(menus.value);
  }
});

async function refresh() {
  try {
    loading.value = true;
    const api = AuthApiFactory.getInstance().getAuthApi();
    me.value = await api.getMe();
    menus.value = await api.getMenus();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载失败';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

function handleLogout() {
  AuthApiFactory.getInstance().getAuthApi().logout();
  ElMessage.success('已退出');
  location.reload();
}

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24px;
  background: #f5f7fa;
}
.card {
  max-width: 920px;
  margin: 0 auto;
  border-radius: 12px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.title {
  font-weight: 600;
  font-size: 16px;
}
.subtitle {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.mb16 {
  margin-bottom: 16px;
}
.pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.4;
}
</style>
