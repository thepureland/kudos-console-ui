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
        <el-icon><component :is="item.icon" /></el-icon>
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
                <component :is="item.icon" />
              </el-icon>
              <span>{{ menuLabel(item) }}</span>
            </template>
            <template v-for="subItem in item.children" :key="subItem.index">
              <el-sub-menu v-if="subItem.children" :index="subItem.index">
                <template #title>
                  <el-icon v-if="subItem.icon">
                    <component :is="subItem.icon" />
                  </el-icon>
                  <span>{{ menuLabel(subItem) }}</span>
                </template>
                <el-menu-item
                  v-for="(threeItem, i) in subItem.children"
                  :key="threeItem.index"
                  :index="threeItem.index"
                >
                  <el-icon v-if="threeItem.icon">
                    <component :is="threeItem.icon" />
                  </el-icon>
                  <template #title>{{ menuLabel(threeItem) }}</template>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="subItem.index">
                <el-icon>
                  <component :is="subItem.icon" />
                </el-icon>
                <template #title>{{ menuLabel(subItem) }}</template>
              </el-menu-item>
            </template>
          </el-sub-menu>
        </template>
        <template v-else>
          <el-menu-item :index="item.index">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ menuLabel(item) }}</template>
          </el-menu-item>
        </template>
      </template>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import {
  Bell,
  HomeFilled,
  Setting,
  Coin,
  Collection,
  Document,
  User,
  UserFilled,
  OfficeBuilding,
  Lock,
  Key,
} from '@element-plus/icons-vue';
import { AuthApiFactory } from 'shared';
import { REQUIRE_AUTH } from '../../config/auth';
import { PATH_META, resolvePath } from '../../config/menuPathToComponent';
import { backendRequest } from '../../utils/backendRequest';

interface MenuItem {
  index: string;
  title: string;
  titleKey?: string;
  icon?: unknown;
  children?: MenuItem[];
}

const { t } = useI18n();
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
  const meta = PATH_META[resolved];
  store.commit('setTagsItem', {
    titleKey: item?.titleKey ?? meta?.titleKey,
    icon: meta?.icon ?? 'Setting',
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
/** 服务端 / shared 返回的 name 为 i18n key，直接用 t(titleKey) 显示 */
function menuLabel(item: MenuItem): string {
  if (item.titleKey) return t(item.titleKey);
  return item.title;
}

/** 图标名 → 组件；用 markRaw 避免被放入 ref(menuData) 时变成响应式触发 Vue 警告 */
const iconMap: Record<string, unknown> = {
  Bell: markRaw(Bell),
  HomeFilled: markRaw(HomeFilled),
  Setting: markRaw(Setting),
  Coin: markRaw(Coin),
  Collection: markRaw(Collection),
  Document: markRaw(Document),
  User: markRaw(User),
  UserFilled: markRaw(UserFilled),
  OfficeBuilding: markRaw(OfficeBuilding),
  Lock: markRaw(Lock),
  Key: markRaw(Key),
};
function resolveIcon(name: string | null | undefined): unknown {
  return name ? iconMap[name] ?? iconMap.Setting : iconMap.Setting;
}
/** 将服务端 / shared 菜单转为本地 MenuItem，name 即 i18n key，用作 titleKey */
function mapMenusFromShared(items: Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>): MenuItem[] {
  return items.map((it) => ({
    index: it.path,
    title: it.name,
    titleKey: it.name,
    icon: resolveIcon(it.icon ?? null),
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

function isLocalhost(): boolean {
  const h = typeof window !== 'undefined' ? window.location?.hostname : '';
  return h === 'localhost' || h === '127.0.0.1';
}
/** localhost 且接口不可用时使用的静态菜单（文案仍通过 titleKey 走 i18n）；图标从 iconMap 取，已是 markRaw */
function getFallbackMenus(): MenuItem[] {
  return [
    { index: '/home', title: '首页', titleKey: 'menu.home', icon: iconMap.HomeFilled },
    { index: '/tabs', title: '消息中心', titleKey: 'menu.tabs', icon: iconMap.Bell },
    {
      index: '/sys',
      title: '系统管理',
      titleKey: 'menu.sys',
      icon: iconMap.Setting,
      children: [
        {
          index: '/sys/basic',
          title: '基础配置',
          titleKey: 'menu.sysBasic',
          icon: iconMap.Document,
          children: [
            { index: '/sys/cache', title: '缓存管理', titleKey: 'menu.sysCache', icon: iconMap.Coin },
            { index: '/sys/dict', title: '字典管理', titleKey: 'menu.sysDict', icon: iconMap.Collection },
            { index: '/sys/param', title: '参数配置', titleKey: 'menu.sysParam', icon: iconMap.Document },
            { index: '/sys/domain', title: '域名', titleKey: 'menu.sysDomain', icon: iconMap.Document },
            { index: '/sys/tenant', title: '租户', titleKey: 'menu.sysTenant', icon: iconMap.Document },
          ],
        },
        { index: '/sys/subsys', title: '子系统', titleKey: 'menu.sysSubsys', icon: iconMap.Document },
        { index: '/sys/microservice', title: '微服务', titleKey: 'menu.sysMicroservice', icon: iconMap.Setting },
        { index: '/sys/datasource', title: '数据源', titleKey: 'menu.sysDatasource', icon: iconMap.Collection },
        { index: '/sys/resource', title: '资源', titleKey: 'menu.sysResource', icon: iconMap.Document },
        { index: '/sys/i18n', title: '国际化', titleKey: 'menu.sysI18n', icon: iconMap.Setting },
      ],
    },
    {
      index: '/user',
      title: '用户与组织',
      titleKey: 'menu.user',
      icon: iconMap.User,
      children: [
        { index: '/user/account', title: '账号管理', titleKey: 'menu.userAccount', icon: iconMap.UserFilled },
        { index: '/user/organization', title: '组织管理', titleKey: 'menu.userOrganization', icon: iconMap.OfficeBuilding },
      ],
    },
    {
      index: '/rbac',
      title: '权限管理',
      titleKey: 'menu.rbac',
      icon: iconMap.Lock,
      children: [
        { index: '/rbac/role', title: '角色管理', titleKey: 'menu.rbacRole', icon: iconMap.Key },
        { index: '/rbac/group', title: '用户组', titleKey: 'menu.rbacGroup', icon: iconMap.User },
      ],
    },
  ];
}
/** 加载顺序：sys 模式直接 fallback → AuthApi.getMenus → 全局 ajax getAuthorisedMenus → localhost 时 fallback */
async function loadMenuData() {
  if (!REQUIRE_AUTH) {
    menuData.value = getFallbackMenus();
    return;
  }
  if (AuthApiFactory.getInstance().hasToken()) {
    try {
      const api = AuthApiFactory.getInstance().getAuthApi();
      const menus = await api.getMenus();
      if (menus && menus.length > 0) {
        menuData.value = mapMenusFromShared(menus as Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>);
        return;
      }
    } catch {
      // 接口失败继续尝试 ajax 或 fallback
    }
    if (isLocalhost()) {
      menuData.value = getFallbackMenus();
      return;
    }
  }
  try {
    const result = await backendRequest({ url: 'user/account/getAuthorisedMenus' }) as { data: MenuItem[] };
    menuData.value = result.data ?? [];
  } catch {
    if (isLocalhost()) menuData.value = getFallbackMenus();
  }
}

onMounted(() => loadMenuData());
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
