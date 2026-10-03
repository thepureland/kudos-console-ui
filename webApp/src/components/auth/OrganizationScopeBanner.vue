<template>
  <el-alert v-if="organizationContext.current" type="info" :closable="false" style="margin-bottom:12px">
    <template #title>{{ t('organizationConsole.organization') }}: {{ organizationContext.current.organizationId }}</template>
    {{ t('organizationConsole.shared') }} <el-button link type="primary" @click="openOrganizationManagement()">{{ t('organizationConsole.manage') }}</el-button>
  </el-alert>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { organizationContext, openOrganizationManagement } from '../../store/organizationContext';
const { t } = useI18n();
</script>
