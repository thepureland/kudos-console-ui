<!--
 * Left navigation sidebar
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 -->
<template>
  <!-- Left nav: multi-level el-menu + collapse; clicking a menu item only updates store.currentMenuPath without changing the URL bar -->
  <div class="sidebar" :class="sidebarTimeClass" :style="sidebarStyle">
    <!-- When collapsed, Home and Message Center use custom two rows so the icons stay horizontally centered (unaffected by el-menu-item defaults) -->
    <div v-if="collapse" class="sidebar-collapse-top">
      <div
        v-for="item in collapseTopItems"
        :key="item.index"
        class="sidebar-collapse-row"
        :class="{ 'is-active': currentPath === item.index }"
        role="button"
        tabindex="0"
        @click="onMenuSelect(item.index)"
        @keydown.enter="onMenuSelect(item.index)"
      >
        <el-icon><component :is="resolveIcon(item.icon)" /></el-icon>
      </div>
    </div>
    <el-menu
      ref="menuRef"
      class="sidebar-el-menu"
      :default-active="currentPath"
      :collapse="collapse"
      @select="onMenuSelect"
    >
      <template v-for="item in menuDataDisplay" :key="item.index">
        <template v-if="item.children">
          <el-sub-menu :index="item.index">
            <template #title>
              <el-icon>
                <component :is="resolveIcon(item.icon)" />
              </el-icon>
              <span>{{ menuLabel(item) }}</span>
            </template>
            <template v-for="subItem in item.children" :key="subItem.index">
              <el-sub-menu v-if="subItem.children" :index="subItem.index">
                <template #title>
                  <el-icon v-if="subItem.icon">
                    <component :is="resolveIcon(subItem.icon)" />
                  </el-icon>
                  <span>{{ menuLabel(subItem) }}</span>
                </template>
                <el-menu-item
                  v-for="(threeItem, i) in subItem.children"
                  :key="threeItem.index"
                  :index="threeItem.index"
                >
                  <el-icon v-if="threeItem.icon">
                    <component :is="resolveIcon(threeItem.icon)" />
                  </el-icon>
                  <template #title>{{ menuLabel(threeItem) }}</template>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="subItem.index">
                <el-icon>
                  <component :is="resolveIcon(subItem.icon)" />
                </el-icon>
                <template #title>{{ menuLabel(subItem) }}</template>
              </el-menu-item>
            </template>
          </el-sub-menu>
        </template>
        <template v-else>
          <el-menu-item :index="item.index">
            <el-icon>
              <component :is="resolveIcon(item.icon)" />
            </el-icon>
            <template #title>{{ menuLabel(item) }}</template>
          </el-menu-item>
        </template>
      </template>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import { authApi } from '../../api/authApi';
import { REQUIRE_AUTH } from '../../config/auth';
import { extractMenuPathFromBackend, resolvePath } from '../../config/menuPathToComponent';
import { backendRequest, getApiResponseData } from '../../utils/backendRequest';
import { loadMessagesForConfig } from '../../i18n';

interface MenuItem {
  index: string;
  title: string;
  titleKey?: string;
  icon?: string;
  children?: MenuItem[];
}

const { t, te, locale } = useI18n();
const store = useStore();
const collapse = computed(() => store.state.collapse);
/** Sidebar width (px) when expanded, kept in sync with the Home page divider drag, sourced from the store */
const sidebarWidth = computed(() => store.state.sidebarWidth);
/** Current menu path from the store, updated when a menu item is clicked (does not change the URL bar) */
const currentPath = computed(() => store.state.currentMenuPath);

function onMenuSelect(path: string) {
  const resolved = resolvePath(path);
  store.commit('setCurrentMenuPath', resolved);
  const item = findMenuItemByPath(menuData.value, resolved) ?? findMenuItemByPath(menuData.value, path);
  store.commit('setTagsItem', {
    titleKey: item?.titleKey,
    icon: item?.icon,
    path: resolved,
  });
}

function findMenuItemByPath(items: MenuItem[], targetPath: string): MenuItem | undefined {
  for (const it of items) {
    if (it.index === targetPath) return it;
    if (it.children) {
      const found = findMenuItemByPath(it.children, targetPath);
      if (found) return found;
    }
  }
  return undefined;
}

/** Sidebar root width: 43px when collapsed (two-thirds of 64), store.sidebarWidth when expanded; the menu area fills it with width:100% */
const SIDEBAR_COLLAPSED_WIDTH = 43;
const sidebarStyle = computed(() => ({
  width: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${sidebarWidth.value}px`,
}));

/** Tag the sidebar with a time-of-day class used by the ::after overlay (matching Header/Welcome) */
const sidebarTimeClass = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'sidebar--time-morning';
  if (h >= 11 && h < 17) return 'sidebar--time-afternoon';
  if (h >= 17 && h < 21) return 'sidebar--time-evening';
  return 'sidebar--time-night';
});

// ---------- Menu item labels and icons ----------
/** Menu labels come from the backend: use t(titleKey) when titleKey exists and is present in the current locale, otherwise fall back to the backend title to avoid "Not found 'view.menu.xxx' in 'zh' locale" */
function menuLabel(item: MenuItem): string {
  if (item.titleKey && te(item.titleKey)) return t(item.titleKey);
  return item.title ?? item.titleKey ?? '';
}

/** Full icon-name -> component map; wrap with markRaw to prevent it from becoming reactive when stored in ref(menuData) (avoids Vue warnings); the backend can dynamically specify any icon name */
const iconMap: Record<string, unknown> = {};
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  iconMap[key] = markRaw(component);
}
function resolveIcon(name: string | null | undefined): unknown {
  return name ? iconMap[name] ?? iconMap.Setting : iconMap.Setting;
}
/** Common fields returned by backend getMenus: index or path/url, title or name, icon, children */
interface MenuTreeNode {
  index?: string | null;
  path?: string | null;
  url?: string | null;
  title?: string | null;
  name?: string | null;
  icon?: string | null;
  children?: MenuTreeNode[];
}

/** Convert the tree returned by sys/resource/getMenus into local MenuItem objects (path is normalized against the backend URL before being written to index) */
function mapMenuTreeToItems(nodes: MenuTreeNode[]): MenuItem[] {
  if (!nodes?.length) return [];
  const out: MenuItem[] = [];
  for (const n of nodes) {
    const index = extractMenuPathFromBackend(n.index ?? n.path ?? n.url ?? undefined);
    if (index == null) continue;
    const titleRaw = n.title ?? n.name ?? '';
    const title = String(titleRaw).trim() || index;
    out.push({
      index,
      title,
      titleKey: typeof titleRaw === 'string' && titleRaw.trim() !== '' ? titleRaw.trim() : undefined,
      icon: (n.icon as string) ?? undefined,
      children: n.children?.length ? mapMenuTreeToItems(n.children) : undefined,
    });
  }
  return out;
}

/** When responses such as getAuthorisedMenus have variable shapes, uniformly extract path and recurse into children */
function coerceBackendMenuTree(nodes: unknown): MenuItem[] {
  if (!Array.isArray(nodes)) return [];
  const out: MenuItem[] = [];
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue;
    const n = raw as Record<string, unknown>;
    const pathSrc = n.index ?? n.path ?? n.url;
    const index = typeof pathSrc === 'string' ? extractMenuPathFromBackend(pathSrc) : null;
    if (index == null) continue;
    const titleRaw = n.title ?? n.name;
    const titleStr = typeof titleRaw === 'string' ? titleRaw.trim() : '';
    out.push({
      index,
      title: titleStr || index,
      titleKey: typeof titleRaw === 'string' && titleRaw ? titleRaw : undefined,
      icon: typeof n.icon === 'string' ? n.icon : undefined,
      children: n.children != null ? coerceBackendMenuTree(n.children) : undefined,
    });
  }
  return out;
}

/** Compatible with AuthApi.getMenus: path, name, icon, children (path may be a full URL) */
function mapAuthMenus(items: Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>): MenuItem[] {
  return items.map((it) => {
    const index = extractMenuPathFromBackend(it.path) ?? resolvePath(it.path);
    return {
      index,
      title: it.name,
      titleKey: it.name,
      icon: (it.icon as string) ?? undefined,
      children: it.children?.length ? mapAuthMenus(it.children as Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>) : undefined,
    };
  });
}

// ---------- Menu data loading ----------
const menuData = ref<MenuItem[]>([]);

/** Sync with tag-bar switching: after the menu mounts asynchronously, re-apply active once to avoid mismatch between default-active and item registration order */
const menuRef = ref<{ updateActiveIndex: (index: string) => void } | null>(null);
watch(
  [() => menuData.value.length, currentPath],
  () => {
    nextTick(() => {
      menuRef.value?.updateActiveIndex(currentPath.value);
    });
  },
  { flush: 'post' }
);

/** Top two items shown only when collapsed (Home, Message Center), used for the custom centered icon rows, fixed order */
const collapseTopItems = computed(() => {
  const list = menuData.value;
  const home = list.find((i) => i.index === '/home');
  const tabs = list.find((i) => i.index === '/tabs');
  return [home, tabs].filter(Boolean) as MenuItem[];
});
/** When collapsed, el-menu only renders sub-menus (Home/Message Center are excluded since their el-menu-item cannot be centered) */
const menuDataDisplay = computed(() =>
  collapse.value ? menuData.value.filter((i) => i.children) : menuData.value
);

const DEFAULT_SUB_SYSTEM_CODE = 'default-sub-system';

/**
 * Attempt to load menus from the real backend first (sys/resource/getMenus), then fall back to
 * AuthApi.getMenus.
 */
async function loadMenus(): Promise<MenuItem[] | null> {
  try {
    const result = await backendRequest({
      url: 'sys/resource/getMenus',
      params: { subSystemCode: DEFAULT_SUB_SYSTEM_CODE },
    });
    const raw = getApiResponseData<MenuTreeNode[]>(result) ?? undefined;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return mapMenuTreeToItems(raw);
    }
  } catch {
    // Continue and try AuthApi.getMenus
  }
  try {
    const menus = await authApi.getMenus();
    if (menus && menus.length > 0) {
      return mapAuthMenus(menus as Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Menu i18n config: the backend returns names as i18n keys; translations must be fetched from this endpoint */
const MENU_I18N_CONFIG = [{ i18nTypeDictCode: 'view', namespaces: ['menu'], atomicServiceCode: 'sys' }];

/**
 * Load menus: prefer the backend sys/resource/getMenus, then user/account/getAuthorisedMenus; local mock is used only as a dev fallback when both fail.
 * Menu labels are usually i18n keys, so menu namespace translations are fetched. Backend URL fields may be path / index / url (including a full HTTP URL).
 */
async function loadMenuData() {
  await loadMessagesForConfig(MENU_I18N_CONFIG);
  const fromGetMenus = await loadMenus();
  if (fromGetMenus && fromGetMenus.length > 0) {
    menuData.value = fromGetMenus;
    store.commit('setMenuData', fromGetMenus);
    return;
  }
  if (REQUIRE_AUTH && !authApi.hasToken()) {
    menuData.value = [];
    store.commit('setMenuData', []);
    return;
  }
  try {
    const result = await backendRequest({ url: 'user/account/getAuthorisedMenus' });
    const list = getApiResponseData<unknown>(result);
    const coerced = coerceBackendMenuTree(list);
    if (coerced.length > 0) {
      menuData.value = coerced;
      store.commit('setMenuData', coerced);
      return;
    }
  } catch {
    // Continue
  }
  // NOTE: this retries loadMenus (sys/resource/getMenus + AuthApi) which already
  // ran above without success; in practice both will fail again, leaving menuData empty.
  // Kept for historical compatibility — removing it would change the load sequence.
  const fallback = await loadMenus();
  menuData.value = fallback ?? [];
  store.commit('setMenuData', menuData.value);
}

onMounted(() => loadMenuData());

/** After switching locale, re-fetch menu namespace translations (setLocale clears the I18nService cache; this requests with the new locale) */
watch(locale, () => {
  loadMessagesForConfig(MENU_I18N_CONFIG);
});
</script>

<style scoped>
.sidebar {
  display: block;
  position: absolute;
  left: 0;
  top: 56px;
  bottom: 0;
  height: calc(100vh - 56px); /* Explicit height so a vertical scrollbar appears when content overflows */
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important; /* Avoid showing two parallel lines alongside the divider */
  /* More visible scrollbar in Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) rgba(0, 0, 0, 0.08);
}

/* Time-of-day overlay: sits above the sidebar background without covering the menu; matches the Header */
.sidebar::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.sidebar.sidebar--time-morning::after {
  background: linear-gradient(180deg, transparent 0%, rgba(100, 150, 255, 0.08) 100%);
}

.sidebar.sidebar--time-afternoon::after {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.04) 100%);
}

.sidebar.sidebar--time-evening::after {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 180, 100, 0.06) 100%);
}

.sidebar.sidebar--time-night::after {
  background: linear-gradient(180deg, transparent 0%, rgba(140, 140, 200, 0.06) 100%);
}

.sidebar-el-menu {
  position: relative;
  z-index: 0;
  border-right: none !important; /* Avoid showing two parallel lines alongside the divider */
}
.sidebar-el-menu :deep(.el-menu) {
  border-right: none !important;
}

/* More visible sidebar scrollbar */
.sidebar::-webkit-scrollbar {
  width: 8px;
}

.sidebar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Top two rows when collapsed (Home, Message Center): custom layout, horizontally centered icons, background matches the sidebar */
.sidebar-collapse-top {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--theme-sidebar-bg) !important;
}
.sidebar-collapse-row {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  width: 100%;
  height: 56px;
  min-height: 56px;
  padding: 0;
  background-color: transparent;
  color: var(--theme-sidebar-text);
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease;
  box-sizing: border-box;
}
.sidebar-collapse-row:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: var(--theme-header-text) !important;
}
.sidebar-collapse-row.is-active {
  background-color: var(--theme-sidebar-active-bg) !important;
  color: var(--theme-sidebar-active-text) !important;
}
.sidebar-collapse-row .el-icon {
  font-size: 18px;
}

.sidebar-el-menu {
  transition: width 0.25s ease;
  background-color: var(--theme-sidebar-bg) !important;
  height: auto !important;
  min-height: 100%;
}

/* When collapsed, the menu width fills the sidebar container (container is SIDEBAR_COLLAPSED_WIDTH 43px, overriding el-menu's default 64px) */
.sidebar-el-menu.el-menu--collapse {
  width: 100% !important;
}

/* When collapsed, horizontally center sub-menu titles (System Management and the other two items) */
.sidebar-el-menu.el-menu--collapse :deep(.el-sub-menu__title) {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
}
.sidebar-el-menu.el-menu--collapse :deep(.el-sub-menu__title .el-sub-menu__title-wrap) {
  flex: none !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 0 !important;
  min-width: 0 !important;
  overflow: hidden !important;
}

/* When collapsed, remove left/right padding from the root menu ul and root-level li */
.sidebar-el-menu.el-menu--collapse :deep(.el-menu),
.sidebar-el-menu.el-menu--collapse :deep(ul),
.sidebar-el-menu.el-menu--collapse :deep(ul > li) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

/* Let the menu list grow with its content so bottom items aren't clipped; .sidebar handles vertical scrolling */
.sidebar-el-menu :deep(ul),
.sidebar-el-menu :deep(.el-menu) {
  height: auto !important;
  min-height: 100% !important;
  overflow: visible !important;
}

.sidebar-el-menu :deep(.el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu__title) {
  color: var(--theme-sidebar-text);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.sidebar-el-menu :deep(.el-menu-item:hover),
.sidebar-el-menu :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: var(--theme-header-text) !important;
  transform: translateX(2px);
}

.sidebar-el-menu :deep(.el-menu-item.is-active) {
  background-color: var(--theme-sidebar-active-bg) !important;
  color: var(--theme-sidebar-active-text) !important;
}

/* Items inside nested sub-menus (level 2 and 3): force the sidebar text color so light themes don't fall back to --el-text-color and lose contrast */
.sidebar-el-menu :deep(.el-sub-menu .el-menu .el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu .el-menu .el-sub-menu__title),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu .el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu .el-sub-menu__title) {
  color: var(--theme-sidebar-text) !important;
}
.sidebar-el-menu :deep(.el-sub-menu .el-menu .el-menu-item:hover),
.sidebar-el-menu :deep(.el-sub-menu .el-menu .el-sub-menu__title:hover),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu .el-menu-item:hover),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu .el-sub-menu__title:hover) {
  color: var(--theme-header-text) !important;
  transform: translateX(2px);
}
.sidebar-el-menu :deep(.el-sub-menu .el-menu .el-menu-item.is-active),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu .el-menu-item.is-active) {
  color: var(--theme-sidebar-active-text) !important;
}

/* When expanded, the menu area fills the sidebar container (container width is driven by store.sidebarWidth and can be adjusted by dragging the divider) */
.sidebar-el-menu:not(.el-menu--collapse) {
  width: 100%;
}

/* Long menu labels wrap instead of being clipped (overrides Element Plus default overflow/ellipsis); padding is two-thirds of the original to keep the level indentation */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-menu-item) {
  overflow: visible !important;
  height: auto !important;
  min-height: 32px; /* 48 minus one third */
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  padding-left: 13px !important;
  padding-right: 13px !important;
  line-height: 1.4;
}
/* Level-2 menu: add more indentation on top of the root level */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-menu .el-menu-item),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-menu .el-sub-menu__title) {
  padding-left: 26px !important;
}
/* Level-3 menu: add one more level of indentation */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-sub-menu .el-menu .el-menu-item),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-sub-menu .el-menu .el-sub-menu__title) {
  padding-left: 39px !important;
}
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title) {
  flex-wrap: wrap;
}
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-menu-item .el-menu-item__title),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title .el-sub-menu__title-wrap),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title span:not(.el-sub-menu__icon-arrow)),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-menu-item > span),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title > *:not(.el-sub-menu__icon-arrow)) {
  overflow: visible !important;
  white-space: normal !important;
  word-break: break-word;
  line-height: 1.4;
  max-width: 100% !important;
  min-width: 0;
}
.sidebar-el-menu :deep(.el-sub-menu__icon-arrow) {
  flex-shrink: 0;
  white-space: nowrap;
}

.sidebar > .sidebar-el-menu,
.sidebar-el-menu > ul {
  display: block;
}

/* Sub-menu expand arrow color and rotation */
.sidebar-el-menu :deep(.el-sub-menu__icon-arrow) {
  color: inherit;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-el-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  transform: rotate(180deg);
}

/* Sub-menu expand/collapse: animate via max-height, with a value large enough that everything is visible once expanded and outer .sidebar handles scrolling */
/* Force the sub-menu area to use the sidebar background so that on light themes Element doesn't fall back to --el-bg-color and produce a low-contrast light-on-light combination */
/* Supports level-2 and level-3 nesting: .el-sub-menu .el-menu and .el-sub-menu .el-sub-menu .el-menu */
.sidebar-el-menu :deep(.el-sub-menu .el-menu),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu .el-menu) {
  background-color: var(--theme-sidebar-bg) !important;
  overflow: hidden;
  transition: max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-el-menu :deep(.el-sub-menu:not(.is-opened) .el-menu),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu:not(.is-opened) .el-menu) {
  max-height: 0;
}

.sidebar-el-menu :deep(.el-sub-menu.is-opened .el-menu),
.sidebar-el-menu :deep(.el-sub-menu .el-sub-menu.is-opened .el-menu) {
  max-height: 2000px;
}
</style>
