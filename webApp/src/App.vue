<template>
  <el-config-provider :locale="elementPlusLocale">
    <Login v-if="showLogin" />
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
import { REQUIRE_AUTH } from './config/auth';
import { ensureAppMessagesLoaded, getGlobalLocale } from './i18n';
import type { LocaleId } from './i18n';

const store = useStore();
/** Whether the user is logged in; sourced from the store (kept in sync with localStorage). After a successful login the store commit updates so the view immediately switches to router-view. */
const isAuthenticated = computed(() => store.state.isAuthenticated);
/** sys mode (REQUIRE_AUTH=false) does not show the login page; user mode shows it when not logged in. */
const showLogin = computed(() => REQUIRE_AUTH && !isAuthenticated.value);
/** Element Plus locale pack follows the app locale; the locale lookup goes through the i18n compatibility helper. */
const elementPlusLocale = computed(() => {
  const locale = getGlobalLocale() as LocaleId;
  if (locale === 'zh-TW') return zhTw;
  if (locale === 'en-US') return en;
  return zhCn;
});

onMounted(() => {
  void ensureAppMessagesLoaded();
});
</script>
