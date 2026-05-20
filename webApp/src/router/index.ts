import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/** 路由入口使用懒加载，避免与菜单动态组件映射形成重复静态引用。 */
const Home = () => import('../pages/Home.vue');
const Welcome = () => import('../pages/Welcome.vue');
const Placeholder = () => import('../pages/Placeholder.vue');
const CacheListPage = () => import('../pages/sys/cache/CacheListPage.vue');
const DataSourceListPage = () => import('../pages/sys/datasource/DataSourceListPage.vue');
const DictListPage = () => import('../pages/sys/dict/DictListPage.vue');
const ParamListPage = () => import('../pages/sys/param/ParamListPage.vue');
const ResourceListPage = () => import('../pages/sys/resource/ResourceListPage.vue');
const DomainListPage = () => import('../pages/sys/domain/DomainListPage.vue');
const TenantListPage = () => import('../pages/sys/tenant/TenantListPage.vue');
const SystemListPage = () => import('../pages/sys/system/SystemListPage.vue');
const MicroServiceListPage = () => import('../pages/sys/microservice/MicroServiceListPage.vue');
const I18nListPage = () => import('../pages/sys/i18n/I18nListPage.vue');
const AccessRuleListPage = () => import('../pages/sys/accessrule/AccessRuleListPage.vue');
const AccountListPage = () => import('../pages/user/account/AccountListPage.vue');
const OrganizationListPage = () => import('../pages/user/organization/OrganizationListPage.vue');
const RoleListPage = () => import('../pages/rbac/role/RoleListPage.vue');
const UserGroupListPage = () => import('../pages/rbac/group/UserGroupListPage.vue');
const Login = () => import('../components/Login/Login.vue');
const NotFound = () => import('../pages/404.vue');

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
      { path: 'sys/accessrule', name: 'sys-accessrule', component: AccessRuleListPage, meta: { titleKey: 'route.sysAccessRule', icon: 'Lock' } },
      { path: 'sys/accessruleip', redirect: '/sys/accessrule' },
      { path: 'sys/accessrulewithip', redirect: '/sys/accessrule' },
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
