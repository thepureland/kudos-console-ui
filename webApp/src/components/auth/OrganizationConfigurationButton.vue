<template>
  <el-button v-if="organizationContext.current && userId" size="small" @click="openMemberAuthorization(userId)">{{ t('organizationConsole.memberButton') }}</el-button>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { organizationContext, openMemberAuthorization } from '../../store/organizationContext';
/** Opens the member authorization dialog (default roles and per-tenant role overrides) for one account row. */
defineProps<{ userId?: string }>();
const { t } = useI18n();
</script>
