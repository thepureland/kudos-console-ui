<!--
 * Home 内容区占位：菜单 path 在 menuPathToComponent 中无对应列表页时渲染，避免 transition/keep-alive 收到空子节点导致 Vue 报错。
 -->
<template>
  <div class="menu-page-fallback">
    <p class="menu-page-fallback__title">{{ t('placeholder.unknownMenuPage') }}</p>
    <p class="menu-page-fallback__path">{{ t('placeholder.menuPath') }}：{{ menuPath }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ menuPath: string }>();

const { t } = useI18n();
</script>

<style scoped>
.menu-page-fallback {
  padding: 24px;
  color: var(--theme-text-muted, #606266);
}
.menu-page-fallback__title {
  margin: 0 0 8px;
  font-size: 15px;
}
.menu-page-fallback__path {
  margin: 0;
  font-size: 13px;
  word-break: break-all;
}
</style>
