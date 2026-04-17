import { I18nService, APP_DEFAULT_I18N_CONFIG, localeOptions, type I18nLoadConfig, type LocaleId } from './I18nService';

const i18nService = new I18nService();

/** vue-i18n 实例，供 app.use(i18n) 及 t()、d() 等使用 */
export const i18n = i18nService.i18n;

/**
 * 与 ValidationRuleAdapter 一致：后端四段式键（如 sys.valid-msg.default.DictItemCode）在 vue-i18n 中多为去掉首段原子服务后的路径。
 */
function backendMessageCandidates(message: string): string[] {
  const text = String(message ?? '').trim();
  if (text === '') return [];
  const parts = text.split('.');
  const out: string[] = [text];
  if (parts.length >= 4) {
    const withoutAtomic = parts.slice(1).join('.');
    if (withoutAtomic !== text) out.push(withoutAtomic);
  }
  return out;
}

let appMessagesLoadPromise: Promise<void> | null = null;

export function ensureAppMessagesLoaded(): Promise<void> {
  if (appMessagesLoadPromise == null) {
    appMessagesLoadPromise = loadAppMessages(APP_DEFAULT_I18N_CONFIG).catch((error) => {
      appMessagesLoadPromise = null;
      throw error;
    });
  }
  return appMessagesLoadPromise;
}

(globalThis as { __kudosTranslateBackendMessage?: (message: string) => string }).__kudosTranslateBackendMessage = (message: string) => {
  const text = String(message ?? '').trim();
  if (text === '') return text;
  const global = i18n.global as unknown as { te?: (key: string) => boolean; t: (key: string) => unknown };
  for (const key of backendMessageCandidates(text)) {
    if (typeof global.te === 'function' && global.te(key)) {
      const translated = global.t(key);
      const s = typeof translated === 'string' ? translated : String(translated ?? text);
      if (s !== '') return s;
    }
    const fallback = global.t(key);
    const s = typeof fallback === 'string' ? fallback : String(fallback ?? '');
    if (s !== '' && s !== key) return s;
  }
  return text;
};

(globalThis as { __kudosTranslateBackendMessageAsync?: (message: string) => Promise<string> }).__kudosTranslateBackendMessageAsync = async (message: string) => {
  await ensureAppMessagesLoaded();
  const translator = (globalThis as { __kudosTranslateBackendMessage?: (message: string) => string }).__kudosTranslateBackendMessage;
  return typeof translator === 'function' ? translator(message) : message;
};

export type { LocaleId, I18nLoadConfig };
export { APP_DEFAULT_I18N_CONFIG, localeOptions };

/** 按配置加载国际化，列表页在 getI18nConfig 中指定 */
export const loadMessagesForConfig = i18nService.loadMessagesForConfig.bind(i18nService);

/** 加载 AddEdit 页级校验 i18n（可带列表页级 cacheHolder，避免重复请求） */
export const loadMessagesForValidationPage = i18nService.loadMessagesForValidationPage.bind(i18nService);

/** 加载应用级默认国际化（App 挂载时调用） */
export const loadAppMessages = i18nService.loadAppMessages.bind(i18nService);

/** 切换语言并持久化到 localStorage */
export function setLocale(locale: LocaleId): void {
  appMessagesLoadPromise = null;
  i18nService.setLocale(locale);
}
