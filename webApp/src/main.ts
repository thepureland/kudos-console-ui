import './config/apiDirect';
import { createApp } from 'vue';
import type { Plugin } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import App from './App.vue';
import './styles/form-error-tooltip.css';
import './styles/theme.css';
import router from './router';
import store from './store';
import { i18n } from './i18n';
import { backendRequest } from './utils/backendRequest';
import { installFormErrorTooltip } from './components/pages/form';

// Apply the persisted theme to <html> before mounting to avoid a flash of
// unstyled/wrong-theme content.  Element Plus dark mode also requires the
// "dark" class on the root element, which is toggled here in lock-step.
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
// Vuex 4's runtime is a Vue plugin; the current dependency's types don't fully match Vue 3.5's Plugin generic, so adapt once here at the entry point.
app.use(store as unknown as Plugin);
app.use(router);
// Register the global form-error tooltip directive (must run before mount).
installFormErrorTooltip();
// Keep the legacy global ajax contract for pages that have not yet adopted imports.
(window as unknown as { ajax?: typeof backendRequest }).ajax = backendRequest;
app.mount('#root');
