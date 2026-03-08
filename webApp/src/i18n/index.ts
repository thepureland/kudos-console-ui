import { I18nService, APP_DEFAULT_I18N_CONFIG, localeOptions, type I18nLoadConfig, type LocaleId } from './I18nService';

const i18nService = new I18nService();

/** vue-i18n 实例，供 app.use(i18n) 及 t()、d() 等使用 */
export const i18n = i18nService.i18n;

export type { LocaleId, I18nLoadConfig };
export { APP_DEFAULT_I18N_CONFIG, localeOptions };

/** 按配置加载国际化，列表页在 getI18nConfig 中指定 */
export const loadMessagesForConfig = i18nService.loadMessagesForConfig.bind(i18nService);

/** 加载 AddEdit 页级校验 i18n（可带列表页级 cacheHolder，避免重复请求） */
export const loadMessagesForValidationPage = i18nService.loadMessagesForValidationPage.bind(i18nService);

/** 加载应用级默认国际化（App 挂载时调用） */
export const loadAppMessages = i18nService.loadAppMessages.bind(i18nService);

/** 切换语言并持久化到 localStorage */
export const setLocale = i18nService.setLocale.bind(i18nService);
