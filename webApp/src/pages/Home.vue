<template>
  <!-- Home 布局：Header + Sidebar + 可拖拽分界线 + (Tags + 主内容)。content-box 的 left 随 collapse/sidebarWidth 变化 -->
  <div class="home">
    <v-header />
    <v-sidebar />
    <!-- 侧栏与内容区之间的分界线：按钮切换折叠/展开（展开时 <，折叠时 >），仅展开时可拖拽调整宽度 -->
    <div
      class="resizer"
      :class="{ 'resizer--collapsed': collapse }"
      role="separator"
      :aria-label="collapse ? '展开侧栏' : '折叠侧栏，拖拽可调整宽度'"
      :style="resizerStyle"
      @mousedown="onResizerMouseDown"
    >
      <button
        type="button"
        class="resizer-toggle-btn"
        :aria-label="collapse ? '展开侧栏' : '折叠侧栏'"
        @click.stop="toggleCollapse"
      >
        {{ collapse ? '>' : '<' }}
      </button>
    </div>
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
          <transition name="move" mode="out-in">
            <keep-alive :max="30">
              <component v-if="currentComponent" :is="currentComponent" :key="currentMenuPath" />
            </keep-alive>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { getComponentForPath, VALID_MENU_PATHS } from '../config/menuPathToComponent';
import vHeader from '../components/widgets/Header.vue';
import vSidebar from '../components/widgets/Sidebar.vue';
import vTags from '../components/widgets/Tags.vue';

const store = useStore();
const route = useRoute();
const currentMenuPath = computed(() => store.state.currentMenuPath);
const currentComponent = computed(() => getComponentForPath(currentMenuPath.value));

/** 根据路由同步 store.currentMenuPath，使直接访问/刷新 /sys/subsys 等时内容区与侧栏/标签一致；点菜单不改地址栏 */
function syncStoreFromRoute() {
  const path = route.path || '/home';
  const menuPath = path.startsWith('/') ? path : '/' + path;
  if (VALID_MENU_PATHS.has(menuPath) && currentMenuPath.value !== menuPath) {
    store.commit('setCurrentMenuPath', menuPath);
  }
}

// ---------- 侧栏与内容区布局（含可拖拽分界线） ----------
/** 侧栏是否折叠，来自 store，与 content-box 的 left 联动 */
const collapse = computed(() => store.state.collapse);
/** 侧栏展开时的宽度（px），来自 store，用于 content-box 的 left 与 resizer 的 left */
const sidebarWidth = computed(() => store.state.sidebarWidth);

/** 折叠时侧栏宽度（与 Sidebar.vue 的 SIDEBAR_COLLAPSED_WIDTH 一致） */
const SIDEBAR_COLLAPSED_WIDTH = 43;
/** content-box 的 left：折叠时与侧栏宽度一致，展开时为 sidebarWidth */
const contentBoxStyle = computed(() => ({
  left: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${sidebarWidth.value}px`,
}));

/** 分界线位置：折叠时贴侧栏右缘，展开时贴 sidebarWidth-3 */
const resizerStyle = computed(() => ({
  left: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH - 3}px` : `${sidebarWidth.value - 3}px`,
}));

/** 是否正在拖拽分界线；拖拽时去掉 content-box 的 left 过渡，使边界跟手 */
const isResizing = ref(false);
let resizeStartX = 0;
let resizeStartWidth = 0;

/** 分界线 mousedown：只响应左键；折叠时不进入拖拽逻辑（不显示拖拽光标），仅展开时可拖拽调宽 */
function onResizerMouseDown(e: MouseEvent) {
  if (e.button !== 0 || collapse.value) return;
  resizeStartX = e.clientX;
  resizeStartWidth = store.state.sidebarWidth;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

/** 拖拽中：位移超过 5px 则视为拖拽（仅展开时生效），根据水平位移更新 store.sidebarWidth */
function onResizeMove(e: MouseEvent) {
  if (Math.abs(e.clientX - resizeStartX) > 5 && !collapse.value) {
    isResizing.value = true;
    const delta = e.clientX - resizeStartX;
    store.commit('setSidebarWidth', resizeStartWidth + delta);
  }
}

/** 拖拽结束：移除监听并恢复 body 样式（折叠/展开仅由分隔线按钮触发） */
function onResizeEnd() {
  isResizing.value = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

/** 分隔线按钮：切换侧栏折叠/展开 */
function toggleCollapse() {
  store.commit('handleCollapse', !collapse.value);
}

/** 菜单切换时显示骨架屏，避免白屏 */
const contentLoading = ref(false);
let loadingTimer: ReturnType<typeof setTimeout> | undefined;

watch(currentMenuPath, () => {
  contentLoading.value = true;
  loadingTimer = setTimeout(() => {
    contentLoading.value = false;
    loadingTimer = undefined;
  }, 50);
});

watch(() => route.path, syncStoreFromRoute);

onMounted(() => {
  syncStoreFromRoute();
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  if (loadingTimer) clearTimeout(loadingTimer);
});
</script>

<style scoped>
.home {
  box-sizing: border-box; /* padding 计入 height，避免 100vh + 56px 导致整页滚动 */
  padding-top: 56px; /* 为固定 header 留出空间 */
  position: relative;
  height: 100vh; /* 固定高度，避免整页出现滚动条 */
  overflow: hidden; /* 禁止整页滚动，仅侧栏与内容区内部滚动 */
}

/* header 固定顶部，sidebar 与 content-box 从 56px 起对齐 */
.home :deep(.header) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* 主内容区容器：left 由 contentBoxStyle 动态设置（折叠 43px，展开为 sidebarWidth）。
   transform 使内部 position:fixed 的弹窗相对本区域居中，而非相对屏幕。 */
.content-box {
  position: absolute;
  top: 56px;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  transition: left 0.2s ease;
  min-height: 0; /* flex 子项可正确收缩，使 .content 的 overflow 生效 */
  transform: translateZ(0);
}

/* 标签栏不参与收缩，不随内容区滚动 */
.content-box > *:first-child {
  flex-shrink: 0;
}

/* 拖拽分界线时取消 left 过渡，避免跟手延迟 */
.content-box.content-box--resizing {
  transition: none;
}

/* 分界线：窄条可拖拽调宽，中间竖线 + 折叠/展开按钮（展开时 <，折叠时 >） */
.resizer {
  position: absolute;
  top: 56px;
  bottom: 0;
  z-index: 10;
  width: 10px;
  cursor: col-resize;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizer:hover,
.resizer:active {
  background: var(--el-color-primary);
  opacity: 0.12;
}

/* 折叠后不显示可拖拽提示：默认光标、不显示竖线 */
.resizer--collapsed {
  cursor: default;
}
.resizer--collapsed:hover,
.resizer--collapsed:active {
  background: transparent;
  opacity: 1;
}
.resizer--collapsed::after {
  display: none;
}

/* 中间 2px 竖线（在 10px 宽条中居中），仅展开时显示 */
.resizer::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--theme-border);
  border-radius: 1px;
  pointer-events: none;
}

.resizer:not(.resizer--collapsed):hover::after,
.resizer:not(.resizer--collapsed):active::after {
  background: var(--el-color-primary);
  opacity: 0.8;
}

/* 分隔线上的折叠/展开按钮：细长条贴分隔线，展开显示 <，折叠显示 > */
.resizer-toggle-btn {
  position: relative;
  z-index: 1;
  width: 10px;
  min-height: 24px;
  padding: 4px 0;
  margin: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.resizer-toggle-btn:hover {
  background: var(--theme-border);
  color: var(--el-color-primary);
}

/* 子页面渲染区域，可滚动 */
.content {
  position: relative;
  z-index: 0;
  flex: 1;
  padding: 4px 6px;
  overflow: auto;
  min-height: 0;
}

/* 骨架屏消失后首屏内容轻淡入，减少闪一下的感觉；height: 100% 使子页可填满内容区（如 CacheList 仅表格内滚动） */
.content-inner {
  height: 100%;
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
