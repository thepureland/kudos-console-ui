import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Home from '../pages/Home.vue';
import Welcome from '../pages/Welcome.vue';
import Placeholder from '../pages/Placeholder.vue';
import Login from '../components/Login/Login.vue';
import NotFound from '../pages/404.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Home,
    redirect: '/home',
    children: [
      { path: 'home', name: 'home', component: Welcome, meta: { titleKey: 'route.home' } },
      { path: 'sys/cache', name: 'sys-cache', component: Placeholder, meta: { titleKey: 'route.sysCache' } },
      { path: 'sys/dict', name: 'sys-dict', component: Placeholder, meta: { titleKey: 'route.sysDict' } },
      { path: 'sys/param', name: 'sys-param', component: Placeholder, meta: { titleKey: 'route.sysParam' } },
      { path: 'user/account', name: 'user-account', component: Placeholder, meta: { titleKey: 'route.userAccount' } },
      { path: 'user/organization', name: 'user-organization', component: Placeholder, meta: { titleKey: 'route.userOrganization' } },
      { path: 'rbac/role', name: 'rbac-role', component: Placeholder, meta: { titleKey: 'route.rbacRole' } },
      { path: 'rbac/group', name: 'rbac-group', component: Placeholder, meta: { titleKey: 'route.rbacGroup' } },
      { path: 'tabs', name: 'tabs', component: Placeholder, meta: { titleKey: 'route.tabs' } },
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
