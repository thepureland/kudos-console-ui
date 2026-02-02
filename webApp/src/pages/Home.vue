<template>
  <!-- Home 布局：Header + Sidebar + (Tags + 主内容)。content-box 宽度随 store.state.collapse 变化 -->
  <div class="home">
    <v-header />
    <v-sidebar />
    <div class="content-box" :class="{ 'content-collapse': collapse }">
      <v-tags />
      <div class="content">
        <router-view v-slot="{ Component }">
          <transition name="move" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import vHeader from '../components/widgets/Header.vue';
import vSidebar from '../components/widgets/Sidebar.vue';
import vTags from '../components/widgets/Tags.vue';

const store = useStore();
/** 侧栏是否折叠，来自 store，与 content-box 宽度联动 */
const collapse = computed(() => store.state.collapse);
</script>

<style scoped>
.home {
  padding-top: 56px; /* 为固定 header 留出空间 */
  position: relative;
  min-height: 100vh; /* 保证绝对定位的 sidebar/content-box 有参照高度 */
}

/* header 固定顶部，sidebar 与 content-box 从 56px 起对齐 */
.home :deep(.header) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* 主内容区容器：左侧留出 sidebar 宽度，折叠时 64px */
.content-box {
  position: absolute;
  top: 56px;
  left: 250px;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  transition: left 0.3s;
}

.content-box.content-collapse {
  left: 64px;
}

/* 子页面渲染区域，可滚动 */
.content {
  position: relative;
  z-index: 0;
  flex: 1;
  padding: 12px;
  overflow: auto;
  min-height: 0;
}
</style>
