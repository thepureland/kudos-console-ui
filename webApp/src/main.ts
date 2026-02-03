import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import App from './App.vue';
import './styles/theme.css';
import router from './router';
import store from './store';
import { i18n } from './i18n';
import { backendRequest } from './utils/backendRequest';

const VALID_THEMES = ['a-light', 'a-dark', 'b-light', 'b-dark', 'c-light', 'c-dark', 'd-light', 'd-dark'];
const rawTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
const themeId = rawTheme && VALID_THEMES.includes(rawTheme) ? rawTheme : 'a-light';
document.documentElement.setAttribute('data-theme', themeId);
if (themeId.endsWith('-dark')) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

const app = createApp(App);
app.use(i18n);
app.use(ElementPlus);
app.use(store);
app.use(router);
// 统一走 shared：全局 ajax 指向 backendRequest
(window as unknown as { ajax?: typeof backendRequest }).ajax = backendRequest;
app.mount('#root');
