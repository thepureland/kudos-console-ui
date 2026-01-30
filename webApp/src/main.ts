import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import store from './store';
import { ajax } from './utils/ajax';

const app = createApp(App);
app.use(ElementPlus);
app.use(store);
app.use(router);
// 挂载全局 ajax 以兼容旧页面调用
(window as unknown as { ajax?: typeof ajax }).ajax = ajax;
app.mount('#root');
