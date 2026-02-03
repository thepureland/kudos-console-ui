<template>
  <!-- 左侧导航：el-menu 多级 + 折叠 + router，宽度由 store.sidebarWidth 控制（可拖拽分界线调整） -->
  <div class="sidebar" :class="sidebarTimeClass" :style="sidebarStyle">
    <el-menu
      class="sidebar-el-menu"
      :default-active="onRoutes"
      :collapse="collapse"
      unique-opened
      router
    >
      <template v-for="item in menuData" :key="item.index">
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
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
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
/** 菜单接口失败时使用 main 挂载的全局 ajax（env.d.ts 声明）请求 getAuthorisedMenus */

interface MenuItem {
  index: string;
  title: string;
  titleKey?: string;
  icon?: unknown;
  children?: MenuItem[];
}

const { t } = useI18n();
const route = useRoute();
const store = useStore();
const collapse = computed(() => store.state.collapse);
/** 侧栏展开时的宽度（px），与 Home 页分界线拖拽联动，来自 store */
const sidebarWidth = computed(() => store.state.sidebarWidth);
const onRoutes = computed(() => route.path);

/** 侧栏根节点宽度：折叠时 64px（与 el-menu 折叠一致），展开时为 store.sidebarWidth；菜单区用 width:100% 填满 */
const sidebarStyle = computed(() => ({
  width: collapse.value ? '64px' : `${sidebarWidth.value}px`,
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

const iconMap: Record<string, unknown> = {
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
};
function resolveIcon(name: string | null | undefined): unknown {
  return name ? iconMap[name] ?? Setting : Setting;
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

function isLocalhost(): boolean {
  const h = typeof window !== 'undefined' ? window.location?.hostname : '';
  return h === 'localhost' || h === '127.0.0.1';
}
/** localhost 且接口不可用时使用的静态菜单（文案仍通过 titleKey 走 i18n） */
function getFallbackMenus(): MenuItem[] {
  return [
    { index: '/home', title: '首页', titleKey: 'menu.home', icon: HomeFilled },
    { index: '/tabs', title: '消息中心', titleKey: 'menu.tabs', icon: Bell },
    {
      index: '/sys',
      title: '系统管理',
      titleKey: 'menu.sys',
      icon: Setting,
      children: [
        {
          index: '/sys/basic',
          title: '基础配置',
          titleKey: 'menu.sysBasic',
          icon: Document,
          children: [
            { index: '/sys/cache', title: '缓存管理', titleKey: 'menu.sysCache', icon: Coin },
            { index: '/sys/dict', title: '字典管理', titleKey: 'menu.sysDict', icon: Collection },
            { index: '/sys/param', title: '参数配置', titleKey: 'menu.sysParam', icon: Document },
          ],
        },
        { index: '/sys/subsys', title: '子系统', titleKey: 'menu.sysSubsys', icon: Document },
        { index: '/sys/microservice', title: '微服务', titleKey: 'menu.sysMicroservice', icon: Setting },
        { index: '/sys/datasource', title: '数据源', titleKey: 'menu.sysDatasource', icon: Collection },
        { index: '/sys/resource', title: '资源', titleKey: 'menu.sysResource', icon: Document },
        { index: '/sys/i18n', title: '国际化', titleKey: 'menu.sysI18n', icon: Setting },
      ],
    },
    {
      index: '/user',
      title: '用户与组织',
      titleKey: 'menu.user',
      icon: User,
      children: [
        { index: '/user/account', title: '账号管理', titleKey: 'menu.userAccount', icon: UserFilled },
        { index: '/user/organization', title: '组织管理', titleKey: 'menu.userOrganization', icon: OfficeBuilding },
      ],
    },
    {
      index: '/rbac',
      title: '权限管理',
      titleKey: 'menu.rbac',
      icon: Lock,
      children: [
        { index: '/rbac/role', title: '角色管理', titleKey: 'menu.rbacRole', icon: Key },
        { index: '/rbac/group', title: '用户组', titleKey: 'menu.rbacGroup', icon: User },
      ],
    },
  ];
}
/** 加载顺序：AuthApi.getMenus → 全局 ajax getAuthorisedMenus → localhost 时 fallback */
async function loadMenuData() {
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
    const result = await ajax({ url: 'user/account/getAuthorisedMenus' }) as { data: MenuItem[] };
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
  z-index: 1;
  overflow-y: auto;
  overflow-x: hidden;
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
}

.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-el-menu {
  transition: width 0.25s ease;
  background-color: var(--theme-sidebar-bg) !important;
  height: auto !important;
  min-height: 100%;
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

/* 菜单项文案过长时换行显示，避免被裁切（覆盖 Element Plus 默认 overflow/ellipsis） */
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title),
.sidebar-el-menu:not(.el-menu--collapse) :deep(.el-menu-item) {
  overflow: visible !important;
  height: auto !important;
  min-height: 48px;
  padding-top: 12px;
  padding-bottom: 12px;
  line-height: 1.4;
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
