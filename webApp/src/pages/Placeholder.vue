<template>
  <div class="placeholder">
    <h2>{{ title }}</h2>
    <p>{{ t('placeholder.currentPath') }}：{{ path }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();
const path = computed(() => route.path);
const title = computed(() => {
  const key = route.meta?.titleKey as string | undefined;
  return key ? t(key) : path.value;
});
</script>

<style scoped>
.placeholder {
  padding: 20px;
}
</style>
