<template>
  <el-config-provider :locale="elementPlusLocale">
    <Login v-if="!isAuthenticated" />
    <router-view v-else />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import zhTw from 'element-plus/es/locale/lang/zh-tw';
import en from 'element-plus/es/locale/lang/en';
import Login from './components/Login/Login.vue';
import { i18n, loadMessagesFromServer } from './i18n';
import type { LocaleId } from './i18n';

const store = useStore();
/** 是否已登录，来自 store（与 localStorage 同步）；登录成功后 commit 更新以便立即切换为 router-view */
const isAuthenticated = computed(() => store.state.isAuthenticated);
const elementPlusLocale = computed(() => {
  const locale = i18n.global.locale.value as LocaleId;
  if (locale === 'zh-TW') return zhTw;
  if (locale === 'en-US') return en;
  return zhCn;
});

onMounted(() => {
  loadMessagesFromServer(i18n.global.locale.value as LocaleId);
});
</script>
