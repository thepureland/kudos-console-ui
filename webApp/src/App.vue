<template>
  <Login v-if="!hasToken" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import Login from './components/Login/Login.vue';
import { AuthApiFactory } from 'shared';
import { i18n, loadMessagesFromServer } from './i18n';
import type { LocaleId } from './i18n';

const hasToken = computed(() => AuthApiFactory.getInstance().hasToken());

onMounted(() => {
  loadMessagesFromServer(i18n.global.locale.value as LocaleId);
});
</script>
