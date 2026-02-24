import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Home from '../pages/Home.vue';
import Welcome from '../pages/Welcome.vue';
import Placeholder from '../pages/Placeholder.vue';
import CacheList from '../pages/sys/cache/CacheList.vue';
import DataSourceList from '../pages/sys/datasource/DataSourceList.vue';
import DictList from '../pages/sys/dict/DictList.vue';
import ParamList from '../pages/sys/param/ParamList.vue';
import ResourceList from '../pages/sys/resource/ResourceList.vue';
import DomainList from '../pages/sys/domain/DomainList.vue';
import AccountList from '../pages/user/account/AccountList.vue';
import OrganizationList from '../pages/user/organization/OrganizationList.vue';
import RoleList from '../pages/rbac/role/RoleList.vue';
import UserGroupList from '../pages/rbac/group/UserGroupList.vue';
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
      { path: 'sys/cache', name: 'sys-cache', component: CacheList, meta: { titleKey: 'route.sysCache', icon: 'Coin' } },
      { path: 'sys/dict', name: 'sys-dict', component: DictList, meta: { titleKey: 'route.sysDict', icon: 'Collection' } },
      { path: 'sys/param', name: 'sys-param', component: ParamList, meta: { titleKey: 'route.sysParam', icon: 'Document' } },
      { path: 'sys/subsys', name: 'sys-subsys', component: DomainList, meta: { titleKey: 'route.sysSubsys', icon: 'Document' } },
      { path: 'sys/microservice', name: 'sys-microservice', component: Placeholder, meta: { titleKey: 'route.sysMicroservice', icon: 'Setting' } },
      { path: 'sys/datasource', name: 'sys-datasource', component: DataSourceList, meta: { titleKey: 'route.sysDatasource', icon: 'Collection' } },
      { path: 'sys/resource', name: 'sys-resource', component: ResourceList, meta: { titleKey: 'route.sysResource', icon: 'Document' } },
      { path: 'sys/i18n', name: 'sys-i18n', component: Placeholder, meta: { titleKey: 'route.sysI18n', icon: 'Setting' } },
      { path: 'user/account', name: 'user-account', component: AccountList, meta: { titleKey: 'route.userAccount', icon: 'UserFilled' } },
      { path: 'user/organization', name: 'user-organization', component: OrganizationList, meta: { titleKey: 'route.userOrganization', icon: 'OfficeBuilding' } },
      { path: 'rbac/role', name: 'rbac-role', component: RoleList, meta: { titleKey: 'route.rbacRole', icon: 'Key' } },
      { path: 'rbac/group', name: 'rbac-group', component: UserGroupList, meta: { titleKey: 'route.rbacGroup', icon: 'User' } },
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
