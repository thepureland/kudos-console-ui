/**
 * 路径到组件的映射，用于菜单点击时按状态切换内容（不改变地址栏）
 */
import { defineAsyncComponent, type Component } from 'vue';

const PATH_REDIRECTS: Record<string, string> = {
  '/': '/home',
  '/sys/basic': '/sys/cache',
};

const PATH_TO_COMPONENT: Record<string, Component> = {
  '/home': defineAsyncComponent(() => import('../pages/Welcome.vue')),
  '/sys/cache': defineAsyncComponent(() => import('../pages/sys/cache/CacheList.vue')),
  '/sys/dict': defineAsyncComponent(() => import('../pages/sys/dict/DictList.vue')),
  '/sys/param': defineAsyncComponent(() => import('../pages/sys/param/ParamList.vue')),
  '/sys/domain': defineAsyncComponent(() => import('../pages/sys/domain/DomainList.vue')),
  '/sys/tenant': defineAsyncComponent(() => import('../pages/sys/tenant/TenantList.vue')),
  '/sys/subsys': defineAsyncComponent(() => import('../pages/sys/system/SystemList.vue')),
  '/sys/microservice': defineAsyncComponent(() => import('../pages/sys/microservice/MicroServiceList.vue')),
  '/sys/datasource': defineAsyncComponent(() => import('../pages/sys/datasource/DataSourceList.vue')),
  '/sys/resource': defineAsyncComponent(() => import('../pages/sys/resource/ResourceList.vue')),
  '/sys/i18n': defineAsyncComponent(() => import('../pages/sys/i18n/I18NList.vue')),
  '/user/account': defineAsyncComponent(() => import('../pages/user/account/AccountList.vue')),
  '/user/organization': defineAsyncComponent(() => import('../pages/user/organization/OrganizationList.vue')),
  '/rbac/role': defineAsyncComponent(() => import('../pages/rbac/role/RoleList.vue')),
  '/rbac/group': defineAsyncComponent(() => import('../pages/rbac/group/UserGroupList.vue')),
  '/tabs': defineAsyncComponent(() => import('../pages/Placeholder.vue')),
};

export function resolvePath(path: string): string {
  return PATH_REDIRECTS[path] ?? path;
}

export const VALID_MENU_PATHS = new Set(Object.keys(PATH_TO_COMPONENT));

export function getComponentForPath(path: string): Component | undefined {
  const resolved = resolvePath(path);
  return PATH_TO_COMPONENT[resolved];
}

/** 路径对应的 meta（用于 Tags 等） */
export const PATH_META: Record<string, { titleKey: string; icon: string }> = {
  '/home': { titleKey: 'route.home', icon: 'HomeFilled' },
  '/sys/cache': { titleKey: 'route.sysCache', icon: 'Coin' },
  '/sys/dict': { titleKey: 'route.sysDict', icon: 'Collection' },
  '/sys/param': { titleKey: 'route.sysParam', icon: 'Document' },
  '/sys/domain': { titleKey: 'route.sysDomain', icon: 'Document' },
  '/sys/tenant': { titleKey: 'route.sysTenant', icon: 'Document' },
  '/sys/subsys': { titleKey: 'route.sysSubsys', icon: 'Document' },
  '/sys/microservice': { titleKey: 'route.sysMicroservice', icon: 'Setting' },
  '/sys/datasource': { titleKey: 'route.sysDatasource', icon: 'Collection' },
  '/sys/resource': { titleKey: 'route.sysResource', icon: 'Document' },
  '/sys/i18n': { titleKey: 'route.sysI18n', icon: 'Setting' },
  '/user/account': { titleKey: 'route.userAccount', icon: 'UserFilled' },
  '/user/organization': { titleKey: 'route.userOrganization', icon: 'OfficeBuilding' },
  '/rbac/role': { titleKey: 'route.rbacRole', icon: 'Key' },
  '/rbac/group': { titleKey: 'route.rbacGroup', icon: 'User' },
  '/tabs': { titleKey: 'route.tabs', icon: 'Bell' },
};
