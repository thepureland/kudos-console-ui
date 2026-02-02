<template>
  <!-- 左侧导航：el-menu 多级 + 折叠 + router，数据来自接口或 localhost fallback -->
  <div class="sidebar">
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
                <template #title>{{ menuLabel(subItem) }}</template>
                <el-menu-item
                  v-for="(threeItem, i) in subItem.children"
                  :key="i"
                  :index="threeItem.index"
                >
                  {{ menuLabel(threeItem) }}
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
const onRoutes = computed(() => route.path);

// ---------- 菜单项文案与图标 ----------
/** 路径 → i18n key，menuLabel 据此翻译 */
const PATH_MENU_KEY: Record<string, string> = {
  '/home': 'menu.home',
  '/tabs': 'menu.tabs',
  '/sys': 'menu.sys',
  '/sys/cache': 'menu.sysCache',
  '/sys/dict': 'menu.sysDict',
  '/sys/param': 'menu.sysParam',
  '/user': 'menu.user',
  '/user/account': 'menu.userAccount',
  '/user/organization': 'menu.userOrganization',
  '/rbac': 'menu.rbac',
  '/rbac/role': 'menu.rbacRole',
  '/rbac/group': 'menu.rbacGroup',
};
function menuLabel(item: MenuItem): string {
  if (item.titleKey) return t(item.titleKey);
  const key = PATH_MENU_KEY[item.index];
  return key ? t(key) : item.title;
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
/** 将 shared 返回的菜单结构转为本地 MenuItem（path → titleKey，用于 i18n） */
function mapMenusFromShared(items: Array<{ path: string; name: string; icon?: string | null; children?: unknown[] }>): MenuItem[] {
  return items.map((it) => ({
    index: it.path,
    title: it.name,
    titleKey: PATH_MENU_KEY[it.path],
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
        { index: '/sys/cache', title: '缓存管理', titleKey: 'menu.sysCache', icon: Coin },
        { index: '/sys/dict', title: '字典管理', titleKey: 'menu.sysDict', icon: Collection },
        { index: '/sys/param', title: '参数配置', titleKey: 'menu.sysParam', icon: Document },
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
  overflow-y: scroll;
}

.sidebar::-webkit-scrollbar {
  width: 0;
}

.sidebar-el-menu {
  transition: width 0.25s ease;
  background-color: var(--theme-sidebar-bg) !important;
}

.sidebar-el-menu :deep(.el-menu-item),
.sidebar-el-menu :deep(.el-sub-menu__title) {
  color: var(--theme-sidebar-text);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.sidebar-el-menu :deep(.el-menu-item:hover),
.sidebar-el-menu :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: var(--theme-header-text) !important;
}

.sidebar-el-menu :deep(.el-menu-item.is-active) {
  background-color: var(--theme-sidebar-active-bg) !important;
  color: var(--theme-sidebar-active-text) !important;
}

.sidebar-el-menu:not(.el-menu--collapse) {
  width: 250px;
}

.sidebar > ul {
  height: 100%;
}

/* 子菜单展开箭头颜色与旋转 */
.sidebar-el-menu :deep(.el-sub-menu__icon-arrow) {
  color: inherit;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-el-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  transform: rotate(180deg);
}

/* 子菜单展开/收起：缩短时长 + 小 max-height 减少“空跑”，缓动更顺滑 */
.sidebar-el-menu :deep(.el-sub-menu .el-menu) {
  overflow: hidden;
  transition: max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-el-menu :deep(.el-sub-menu:not(.is-opened) .el-menu) {
  max-height: 0;
}

.sidebar-el-menu :deep(.el-sub-menu.is-opened .el-menu) {
  max-height: 320px;
}
</style>
