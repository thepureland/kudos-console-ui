<!--
 * 左侧导航栏
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <!-- 左侧导航：el-menu 多级 + 折叠，点击菜单仅更新 store.currentMenuPath 不改变地址栏 -->
  <div class="sidebar" :class="sidebarTimeClass" :style="sidebarStyle">
    <!-- 折叠时首页、消息中心用自定义两行，保证图标水平居中（不受 el-menu-item 默认样式影响） -->
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
import { computed, markRaw, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import { AuthApiFactory } from 'shared';
import { REQUIRE_AUTH } from '../../config/auth';
import { resolvePath } from '../../config/menuPathToComponent';
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
/** 侧栏展开时的宽度（px），与 Home 页分界线拖拽联动，来自 store */
const sidebarWidth = computed(() => store.state.sidebarWidth);
/** 当前菜单路径，来自 store，点击菜单时更新（不改变地址栏） */
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

/** 侧栏根节点宽度：折叠时 43px（64 的三分之二），展开时为 store.sidebarWidth；菜单区用 width:100% 填满 */
const SIDEBAR_COLLAPSED_WIDTH = 43;
const sidebarStyle = computed(() => ({
  width: collapse.value ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${sidebarWidth.value}px`,
}));

/** 根据时段给 sidebar 加 class，用于 ::after 叠加层（与 Header/Welcome 一致） */
const sidebarTimeClass = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'sidebar--time-morning';
  if (h >= 11 && h < 17) return 'sidebar--time-afternoon';
  if (h >= 17 && h < 21) return 'sidebar--time-evening';
  return 'sidebar--time-night';
});

// ---------- 菜单项文案与图标 ----------
/** 菜单文案由后端提供：有 titleKey 且当前 locale 存在该 key 时用 t(titleKey)，否则用后端返回的 title，避免 "Not found 'view.menu.xxx' in 'zh' locale" */
function menuLabel(item: MenuItem): string {
  if (item.titleKey && te(item.titleKey)) return t(item.titleKey);
  return item.title ?? item.titleKey ?? '';
}

/** 全量图标名 → 组件；用 markRaw 避免被放入 ref(menuData) 时变成响应式触发 Vue 警告；后端可动态指定任意图标名 */
const iconMap: Record<string, unknown> = {};
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  iconMap[key] = markRaw(component);
}
function resolveIcon(name: string | null | undefined): unknown {
  return name ? iconMap[name] ?? iconMap.Setting : iconMap.Setting;
}
/** MenuTreeNode 后端结构：index(url)、title(名称或i18n key)、icon、children */
interface MenuTreeNode {
  index?: string | null;
  title?: string | null;
  icon?: string | null;
  children?: MenuTreeNode[];
}

/** 将 sys/resource/getMenus 返回的 MenuTreeNode 转为本地 MenuItem（icon 保留字符串，供 store/Tags 使用，侧栏渲染时用 resolveIcon） */
function mapMenuTreeToItems(nodes: MenuTreeNode[]): MenuItem[] {
  return nodes
    .filter((n) => n.index)
    .map((n) => ({
      index: n.index!,
      title: n.title ?? '',
      titleKey: n.title ?? undefined,
      icon: (n.icon as string) ?? undefined,
      children: n.children?.length ? mapMenuTreeToItems(n.children) : undefined,
    }));
}

/** 兼容 shared AuthApi 返回格式：path、name、icon、children */
function mapMenusFromShared(items: Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>): MenuItem[] {
  return items.map((it) => ({
    index: it.path,
    title: it.name,
    titleKey: it.name,
    icon: (it.icon as string) ?? undefined,
    children: it.children?.length ? mapMenusFromShared(it.children as Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>) : undefined,
  }));
}

// ---------- 菜单数据加载 ----------
const menuData = ref<MenuItem[]>([]);

/** 折叠时仅展示的顶部两项（首页、消息中心），用于自定义居中图标行，顺序固定 */
const collapseTopItems = computed(() => {
  const list = menuData.value;
  const home = list.find((i) => i.index === '/home');
  const tabs = list.find((i) => i.index === '/tabs');
  return [home, tabs].filter(Boolean) as MenuItem[];
});
/** 折叠时 el-menu 只渲染子菜单（不渲染首页/消息中心，避免其 el-menu-item 无法居中） */
const menuDataDisplay = computed(() =>
  collapse.value ? menuData.value.filter((i) => i.children) : menuData.value
);

const DEFAULT_SUB_SYSTEM_CODE = 'default';

/** 从 shared mock 获取静态菜单（sys/resource/getMenus 或 AuthApi.getMenus 返回 menus.json） */
async function loadMenusFromSharedMock(): Promise<MenuItem[] | null> {
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
    // 继续尝试 AuthApi.getMenus
  }
  try {
    const api = AuthApiFactory.getInstance().getAuthApi();
    const menus = await api.getMenus();
    if (menus && menus.length > 0) {
      return mapMenusFromShared(menus as Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>);
    }
  } catch {
    // ignore
  }
  return null;
}

/** 菜单 i18n 配置：后端返回的 name 为 i18n key，需从此接口拉取译文 */
const MENU_I18N_CONFIG = [{ i18nTypeDictCode: 'view', namespaces: ['menu'], atomicServiceCode: 'sys' }];

/**
 * 加载菜单：优先 sys/resource/getMenus（shared mock 或后端），失败则 getAuthorisedMenus，最后用 shared mock 的 menus.json。
 * 菜单 name 为 i18n key，会调用 loadMessagesForConfig 从后端拉取 menu 命名空间译文。
 */
async function loadMenuData() {
  // 0. 加载菜单 i18n 译文（view 类型、menu 命名空间、sys 原子服务）
  await loadMessagesForConfig(MENU_I18N_CONFIG);
  // 1. sys 模式或已登录：优先 sys/resource/getMenus（mock 或后端）
  const fromShared = await loadMenusFromSharedMock();
  if (fromShared && fromShared.length > 0) {
    menuData.value = fromShared;
    store.commit('setMenuData', fromShared);
    return;
  }
  // 2. user 模式且未登录：不加载菜单（会显示登录页）
  if (REQUIRE_AUTH && !AuthApiFactory.getInstance().hasToken()) {
    menuData.value = [];
    store.commit('setMenuData', []);
    return;
  }
  // 3. 尝试 getAuthorisedMenus（后端权限菜单）
  try {
    const result = await backendRequest({ url: 'user/account/getAuthorisedMenus' });
    const list = getApiResponseData<MenuItem[]>(result);
    if (Array.isArray(list) && list.length) {
      menuData.value = list;
      store.commit('setMenuData', list);
      return;
    }
  } catch {
    // 继续
  }
  // 4. 最终回退：再次尝试 shared mock（localhost 等场景）
  const fallback = await loadMenusFromSharedMock();
  menuData.value = fallback ?? [];
  store.commit('setMenuData', menuData.value);
}

onMounted(() => loadMenuData());

/** 切换语言后重新拉取菜单命名空间译文（setLocale 会清空 I18nService 缓存，此处按新 locale 请求） */
watch(locale, () => {
  loadMessagesForConfig(MENU_I18N_CONFIG);
}, { immediate: false });
</script>

<style scoped>
.sidebar {
  display: block;
  position: absolute;
  left: 0;
  top: 56px;
  bottom: 0;
  height: calc(100vh - 56px); /* 明确高度，确保过长时出现纵向滚动条 */
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: none !important; /* 避免与分隔线并排出现两条线 */
  /* Firefox 滚动条更明显 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) rgba(0, 0, 0, 0.08);
}

/* 时段叠加层：覆盖在侧栏背景上，不遮挡菜单；与 Header 时段一致 */
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
  border-right: none !important; /* 避免与分隔线并排出现两条线 */
}
.sidebar-el-menu :deep(.el-menu) {
  border-right: none !important;
}

/* 侧栏滚动条更明显 */
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

/* 折叠时顶部两行（首页、消息中心）：自管布局，图标水平居中，背景与侧栏一致 */
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

/* 折叠时菜单宽度填满侧栏容器（容器为 SIDEBAR_COLLAPSED_WIDTH 43px，覆盖 el-menu 默认 64px） */
.sidebar-el-menu.el-menu--collapse {
  width: 100% !important;
}

/* 折叠时子菜单标题（系统管理等三项）水平居中 */
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

/* 折叠时根菜单 ul 及根级 li 去掉左右内边距 */
.sidebar-el-menu.el-menu--collapse :deep(.el-menu),
.sidebar-el-menu.el-menu--collapse :deep(ul),
.sidebar-el-menu.el-menu--collapse :deep(ul > li) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

/* 让菜单列表随内容增高，避免底部项被裁切；由 .sidebar 负责纵向滚动 */
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

/* 嵌套子菜单内项（二级、三级）：强制使用侧栏文字色，避免浅色主题下被 --el-text-color 覆盖导致对比度不足 */
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

/* 展开时菜单区填满侧栏容器（容器宽度由 store.sidebarWidth 控制，可拖拽分界线调整） */
.sidebar-el-menu:not(.el-menu--collapse) {
  width: 100%;
}

/* 菜单项文案过长时换行显示，避免被裁切（覆盖 Element Plus 默认 overflow/ellipsis）；内边距为原值的三分之二，保留层级缩进 */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-menu-item) {
  overflow: visible !important;
  height: auto !important;
  min-height: 32px; /* 48 减三分之一 */
  padding-top: 8px !important;
  padding-bottom: 8px !important;
  padding-left: 13px !important;
  padding-right: 13px !important;
  line-height: 1.4;
}
/* 二级菜单：在根级基础上增加缩进 */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-menu .el-menu-item),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu .el-menu .el-sub-menu__title) {
  padding-left: 26px !important;
}
/* 三级菜单：再增加一级缩进 */
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

/* 子菜单展开箭头颜色与旋转 */
.sidebar-el-menu :deep(.el-sub-menu__icon-arrow) {
  color: inherit;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-el-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  transform: rotate(180deg);
}

/* 子菜单展开/收起：用 max-height 做动画，值足够大以便展开后全部可见、由外层 .sidebar 滚动 */
/* 强制子菜单区域使用侧栏背景，避免浅色主题下 Element 使用 --el-bg-color 导致浅底+浅字对比度不足 */
/* 支持二级、三级嵌套：.el-sub-menu .el-menu 与 .el-sub-menu .el-sub-menu .el-menu */
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
