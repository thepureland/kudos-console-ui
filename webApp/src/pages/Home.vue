<template>
  <!-- Home 布局：Header + Sidebar + 可拖拽分界线 + (Tags + 主内容)。content-box 的 left 随 collapse/sidebarWidth 变化 -->
  <div class="home">
    <v-header />
    <v-sidebar />
    <!-- 侧栏与内容区之间的可拖拽分界线，仅展开时显示；left 比 sidebarWidth 少 3px 使竖线视觉上贴边 -->
    <div
      v-show="!collapse"
      class="resizer"
      role="separator"
      aria-label="拖拽调整侧栏宽度"
      :style="{ left: (sidebarWidth - 3) + 'px' }"
      @mousedown="onResizerMouseDown"
    />
    <div
      class="content-box"
      :class="{ 'content-collapse': collapse, 'content-box--resizing': isResizing }"
      :style="contentBoxStyle"
    >
      <v-tags />
      <div class="content">
        <!-- 路由切换时的加载态，避免白屏 -->
        <div v-show="contentLoading" class="content-skeleton" aria-hidden="true">
          <div class="skeleton-hero">
            <div class="skeleton-line skeleton-title" />
            <div class="skeleton-line skeleton-date" />
            <div class="skeleton-line skeleton-subtitle" />
          </div>
          <div class="skeleton-cards">
            <div v-for="i in 4" :key="i" class="skeleton-card" />
          </div>
        </div>
        <div
          class="content-inner"
          :class="{ 'content-inner--visible': !contentLoading }"
        >
          <router-view v-slot="{ Component }">
            <transition name="move" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import vHeader from '../components/widgets/Header.vue';
import vSidebar from '../components/widgets/Sidebar.vue';
import vTags from '../components/widgets/Tags.vue';

const store = useStore();
const router = useRouter();

// ---------- 侧栏与内容区布局（含可拖拽分界线） ----------
/** 侧栏是否折叠，来自 store，与 content-box 的 left 联动 */
const collapse = computed(() => store.state.collapse);
/** 侧栏展开时的宽度（px），来自 store，用于 content-box 的 left 与 resizer 的 left */
const sidebarWidth = computed(() => store.state.sidebarWidth);

/** content-box 的 left：折叠时 64px（与 el-menu 折叠宽度一致），展开时为 sidebarWidth */
const contentBoxStyle = computed(() => ({
  left: collapse.value ? '64px' : `${sidebarWidth.value}px`,
}));

/** 是否正在拖拽分界线；拖拽时去掉 content-box 的 left 过渡，使边界跟手 */
const isResizing = ref(false);
let resizeStartX = 0;
let resizeStartWidth = 0;

/** 分界线 mousedown：只响应左键，记录起始位置与当前宽度，挂 document 的 mousemove/mouseup */
function onResizerMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  isResizing.value = true;
  resizeStartX = e.clientX;
  resizeStartWidth = store.state.sidebarWidth;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

/** 拖拽中：根据水平位移更新 store.sidebarWidth（store 内会钳制到 200～480） */
function onResizeMove(e: MouseEvent) {
  const delta = e.clientX - resizeStartX;
  store.commit('setSidebarWidth', resizeStartWidth + delta);
}

/** 拖拽结束：移除监听并恢复 body 的 user-select、cursor */
function onResizeEnd() {
  isResizing.value = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

/** 路由切换中时显示骨架屏，避免白屏 */
const contentLoading = ref(false);
let removeBefore: (() => void) | undefined;
let removeAfter: (() => void) | undefined;

onMounted(() => {
  removeBefore = router.beforeEach(() => {
    contentLoading.value = true;
  });
  removeAfter = router.afterEach(() => {
    nextTick(() => {
      contentLoading.value = false;
    });
  });
});

onUnmounted(() => {
  removeBefore?.();
  removeAfter?.();
});
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

/* 主内容区容器：left 由 contentBoxStyle 动态设置（折叠 64px，展开为 sidebarWidth） */
.content-box {
  position: absolute;
  top: 56px;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  transition: left 0.2s ease;
}

/* 拖拽分界线时取消 left 过渡，避免跟手延迟 */
.content-box.content-box--resizing {
  transition: none;
}

/* 可拖拽分界线：6px 宽、透明背景，竖线用 ::after 画在中间，hover/active 时高亮 */
.resizer {
  position: absolute;
  top: 56px;
  bottom: 0;
  z-index: 10;
  width: 6px;
  cursor: col-resize;
  background: transparent;
}

.resizer:hover,
.resizer:active {
  background: var(--el-color-primary);
  opacity: 0.25;
}

/* 中间 2px 竖线，默认用边框色，hover 时用主题色 */
.resizer::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--theme-border);
  border-radius: 1px;
}

.resizer:hover::after,
.resizer:active::after {
  background: var(--el-color-primary);
  opacity: 0.8;
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

/* 骨架屏消失后首屏内容轻淡入，减少闪一下的感觉 */
.content-inner {
  min-height: 100%;
  opacity: 0;
}

.content-inner--visible {
  animation: content-fade-in 0.3s ease-out forwards;
}

@keyframes content-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 骨架屏：路由切换时覆盖在内容区上方，避免白屏 */
.content-skeleton {
  position: absolute;
  inset: 0;
  z-index: 1;
  padding: 12px;
  background: var(--theme-bg-content);
  pointer-events: none;
}

.skeleton-hero {
  margin-bottom: 32px;
  padding: 28px 24px;
  background: var(--theme-bg-card);
  border-radius: 12px;
}

.skeleton-line {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--theme-border) 25%,
    var(--theme-bg-card-hover) 50%,
    var(--theme-border) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shine 1s ease-in-out infinite;
}

.skeleton-title {
  width: 45%;
  height: 20px;
  margin-bottom: 12px;
}

.skeleton-date {
  width: 55%;
  margin-bottom: 12px;
}

.skeleton-subtitle {
  width: 70%;
}

.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.skeleton-card {
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    var(--theme-border) 25%,
    var(--theme-bg-card-hover) 50%,
    var(--theme-border) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shine 1s ease-in-out infinite;
}

@keyframes skeleton-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
