<template>
  <Login v-if="!isAuthenticated" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import Login from './components/Login/Login.vue';
import { i18n, loadMessagesFromServer } from './i18n';
import type { LocaleId } from './i18n';

const store = useStore();
/** 是否已登录，来自 store（与 localStorage 同步）；登录成功后 commit 更新以便立即切换为 router-view */
const isAuthenticated = computed(() => store.state.isAuthenticated);

onMounted(() => {
  loadMessagesFromServer(i18n.global.locale.value as LocaleId);
});
</script>
