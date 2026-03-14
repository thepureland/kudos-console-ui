import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Home from '../pages/Home.vue';
import Welcome from '../pages/Welcome.vue';
import Placeholder from '../pages/Placeholder.vue';
import CacheListPage from '../pages/sys/cache/CacheListPage.vue';
import DataSourceListPage from '../pages/sys/datasource/DataSourceListPage.vue';
import DictListPage from '../pages/sys/dict/DictListPage.vue';
import ParamListPage from '../pages/sys/param/ParamListPage.vue';
import ResourceListPage from '../pages/sys/resource/ResourceListPage.vue';
import DomainListPage from '../pages/sys/domain/DomainListPage.vue';
import TenantListPage from '../pages/sys/tenant/TenantListPage.vue';
import SystemListPage from '../pages/sys/system/SystemListPage.vue';
import MicroServiceListPage from '../pages/sys/microservice/MicroServiceListPage.vue';
import I18nListPage from '../pages/sys/i18n/I18nListPage.vue';
import AccountListPage from '../pages/user/account/AccountListPage.vue';
import OrganizationListPage from '../pages/user/organization/OrganizationListPage.vue';
import RoleListPage from '../pages/rbac/role/RoleListPage.vue';
import UserGroupListPage from '../pages/rbac/group/UserGroupListPage.vue';
import Login from '../components/Login/Login.vue';
import NotFound from '../pages/404.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Home,
    redirect: '/home',
    children: [
      { path: 'home', name: 'home', component: Welcome, meta: { titleKey: 'route.home', icon: 'HomeFilled' } },
      { path: 'sys/basic', name: 'sys-basic', redirect: '/sys/cache' },
      { path: 'sys/cache', name: 'sys-cache', component: CacheListPage, meta: { titleKey: 'route.sysCache', icon: 'Coin' } },
      { path: 'sys/dict', name: 'sys-dict', component: DictListPage, meta: { titleKey: 'route.sysDict', icon: 'Collection' } },
      { path: 'sys/param', name: 'sys-param', component: ParamListPage, meta: { titleKey: 'route.sysParam', icon: 'Document' } },
      { path: 'sys/domain', name: 'sys-domain', component: DomainListPage, meta: { titleKey: 'route.sysDomain', icon: 'Document' } },
      { path: 'sys/tenant', name: 'sys-tenant', component: TenantListPage, meta: { titleKey: 'route.sysTenant', icon: 'Document' } },
      { path: 'sys/subsys', name: 'sys-subsys', component: SystemListPage, meta: { titleKey: 'route.sysSubsys', icon: 'Document' } },
      { path: 'sys/microservice', name: 'sys-microservice', component: MicroServiceListPage, meta: { titleKey: 'route.sysMicroservice', icon: 'Setting' } },
      { path: 'sys/datasource', name: 'sys-datasource', component: DataSourceListPage, meta: { titleKey: 'route.sysDatasource', icon: 'Collection' } },
      { path: 'sys/resource', name: 'sys-resource', component: ResourceListPage, meta: { titleKey: 'route.sysResource', icon: 'Document' } },
      { path: 'sys/i18n', name: 'sys-i18n', component: I18nListPage, meta: { titleKey: 'route.sysI18n', icon: 'Setting' } },
      { path: 'user/account', name: 'user-account', component: AccountListPage, meta: { titleKey: 'route.userAccount', icon: 'UserFilled' } },
      { path: 'user/organization', name: 'user-organization', component: OrganizationListPage, meta: { titleKey: 'route.userOrganization', icon: 'OfficeBuilding' } },
      { path: 'rbac/role', name: 'rbac-role', component: RoleListPage, meta: { titleKey: 'route.rbacRole', icon: 'Key' } },
      { path: 'rbac/group', name: 'rbac-group', component: UserGroupListPage, meta: { titleKey: 'route.rbacGroup', icon: 'User' } },
      { path: 'tabs', name: 'tabs', component: Placeholder, meta: { titleKey: 'route.tabs', icon: 'Bell' } },
    ],
  },
  { path: '/login', name: 'login', component: Login, meta: { title: 'Login' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
