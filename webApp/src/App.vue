<template>
  <Login v-if="!hasToken" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Login from './components/Login/Login.vue';
import { AuthApiFactory } from 'shared';

const hasToken = computed(() => AuthApiFactory.getInstance().hasToken());
</script>
