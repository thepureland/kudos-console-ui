<template>
  <AdminHome v-if="hasToken" />
  <Login v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Login from './components/Login/Login.vue';
import AdminHome from './pages/AdminHome.vue';
import { AuthApiFactory } from 'shared';

const hasToken = computed(() => AuthApiFactory.getInstance().hasToken());
</script>
