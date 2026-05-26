<template>
  <!-- Home layout: Header + Sidebar + draggable divider + (Tags + main content). content-box's left tracks collapse/sidebarWidth. -->
  <div class="home">
    <v-header />
    <v-sidebar />
    <!-- Divider between sidebar and content area: the button toggles collapse/expand (< when expanded, > when collapsed); width is only draggable while expanded. -->
    <div
      class="resizer"
      :class="{ 'resizer--collapsed': collapse }"
      role="separator"
      :aria-label="collapse ? 'Expand sidebar' : 'Collapse sidebar; drag to resize'"
      :style="resizerStyle"
      @mousedown="onResizerMouseDown"
    >
      <button
        type="button"
        class="resizer-toggle-btn"
        :aria-label="collapse ? 'Expand sidebar' : 'Collapse sidebar'"
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
        <!-- Loading state during route changes; avoids a flash of white. -->
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
              <component :is="contentPageComponent" v-bind="contentPageProps" :key="currentMenuPath" />
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
import MenuPageFallback from './MenuPageFallback.vue';

const store = useStore();
const route = useRoute();
const currentMenuPath = computed(() => store.state.currentMenuPath);

/** When the menu path has no mapped page (e.g. a group-only path like /sys/basic), render a placeholder so keep-alive doesn't get an empty child and trigger the transition shapeFlag error. */
const contentPageResolved = computed(() => {
  const path = currentMenuPath.value;
  const comp = getComponentForPath(path);
  if (comp) return { comp, props: {} as Record<string, string> };
  return { comp: MenuPageFallback, props: { menuPath: path } };
});
const contentPageComponent = computed(() => contentPageResolved.value.comp);
const contentPageProps = computed(() => contentPageResolved.value.props);

/** Sync store.currentMenuPath from the route so direct visits / refreshes to /sys/subsys etc. keep the content area in sync with sidebar/tags; clicking a menu does not change the address bar.
 * When the URL is the default page /home, don't overwrite the store, so the currentMenuPath restored from localStorage on refresh is preserved (avoids always landing back on the home page after a refresh). */
function syncStoreFromRoute() {
  const path = route.path || '/home';
  const menuPath = path.startsWith('/') ? path : '/' + path;
  if (menuPath === '/home') return;
  if (VALID_MENU_PATHS.has(menuPath) && currentMenuPath.value !== menuPath) {
    store.commit('setCurrentMenuPath', menuPath);
  }
}

// ---------- Sidebar and content-area layout (including the draggable divider) ----------
/** Whether the sidebar is collapsed (from the store); linked to content-box's left. */
const collapse = computed(() => store.state.collapse);
/** Expanded sidebar width in px (from the store); used for both content-box's left and the resizer's left. */
const sidebarWidth = computed(() => store.state.sidebarWidth);

/** Collapsed sidebar width (matches Sidebar.vue's SIDEBAR_COLLAPSED_WIDTH). */
const SIDEBAR_COLLAPSED_WIDTH = 43;
/** content-box's left: matches the sidebar width when collapsed, otherwise sidebarWidth. */
const contentBoxStyle = computed(() => ({
  left: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${sidebarWidth.value}px`,
}));

/** Divider position: hugs the sidebar's right edge when collapsed; sits at sidebarWidth-3 when expanded. */
const resizerStyle = computed(() => ({
  left: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH - 3}px` : `${sidebarWidth.value - 3}px`,
}));

/** Whether the divider is currently being dragged; while dragging, drop content-box's left transition so the boundary tracks the cursor responsively. */
const isResizing = ref(false);
let resizeStartX = 0;
let resizeStartWidth = 0;

/** Divider mousedown: respond to left button only; skip the drag logic while collapsed (no resize cursor either). Width is only draggable while expanded. */
function onResizerMouseDown(e: MouseEvent) {
  if (e.button !== 0 || collapse.value) return;
  resizeStartX = e.clientX;
  resizeStartWidth = store.state.sidebarWidth;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

/** During drag: a move of more than 5px counts as dragging (only while expanded); update store.sidebarWidth from the horizontal delta. */
function onResizeMove(e: MouseEvent) {
  if (Math.abs(e.clientX - resizeStartX) > 5 && !collapse.value) {
    isResizing.value = true;
    const delta = e.clientX - resizeStartX;
    store.commit('setSidebarWidth', resizeStartWidth + delta);
  }
}

/** Drag end: remove listeners and restore body styles (collapse/expand is only triggered by the divider button). */
function onResizeEnd() {
  isResizing.value = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

/** Divider button: toggle sidebar collapse/expand. */
function toggleCollapse() {
  store.commit('handleCollapse', !collapse.value);
}

/** Show the skeleton screen on menu changes to avoid a flash of white. */
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
  box-sizing: border-box; /* include padding in height so 100vh + 56px doesn't cause whole-page scrolling */
  padding-top: 56px; /* leave room for the fixed header */
  position: relative;
  height: 100vh; /* fixed height; avoids a whole-page scrollbar */
  overflow: hidden; /* disable whole-page scrolling; only the sidebar and content areas scroll internally */
}

/* Header is fixed to the top; sidebar and content-box align starting at 56px. */
.home :deep(.header) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

/* Main content container: `left` is set dynamically by contentBoxStyle (43px when collapsed, sidebarWidth when expanded).
   `transform` makes inner position:fixed dialogs center relative to this area instead of the screen. */
.content-box {
  position: absolute;
  top: 56px;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  transition: left 0.2s ease;
  min-height: 0; /* allow flex children to shrink so .content's overflow takes effect */
  transform: translateZ(0);
}

/* The tag bar doesn't shrink and doesn't scroll with the content area. */
.content-box > *:first-child {
  flex-shrink: 0;
}

/* While dragging the divider, drop the left transition to avoid lag. */
.content-box.content-box--resizing {
  transition: none;
}

/* Divider: a thin strip that can be dragged to resize, with a center bar + collapse/expand button (< when expanded, > when collapsed). */
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

/* When collapsed, hide the drag affordance: default cursor and no center bar. */
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

/* Center 2px bar (centered inside the 10px strip); only shown when expanded. */
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

/* Collapse/expand button on the divider: a thin strip flush with the divider; shows < when expanded and > when collapsed. */
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

/* Child-page render area; scrollable. */
.content {
  position: relative;
  z-index: 0;
  flex: 1;
  padding: 4px 6px;
  overflow: auto;
  min-height: 0;
}

/* After the skeleton screen disappears, gently fade the first content in to reduce the flash; height: 100% lets child pages fill the content area (e.g. CacheList scrolls only inside its table). */
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

/* Skeleton screen: overlays the content area during route changes to avoid a flash of white. */
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
