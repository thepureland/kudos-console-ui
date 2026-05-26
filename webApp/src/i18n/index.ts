import { I18nService, APP_DEFAULT_I18N_CONFIG, localeOptions, type I18nLoadConfig, type LocaleId } from './I18nService';

const i18nService = new I18nService();

/** vue-i18n instance, used for app.use(i18n) and t(), d(), etc. */
export const i18n = i18nService.i18n;

/** vue-i18n's interpolation params actually allow wider values; keep wide type here to avoid repeated assertions in business pages. */
type TranslateParams = Record<string, unknown>;

/** Uniformly hide the global type differences between vue-i18n legacy/composition modes; business code only calls via helpers below. */
type I18nGlobalCompat = {
  t: (key: string, params?: TranslateParams) => string;
  d: (value: Date, key?: string) => string;
  locale: string | { value: string };
};

const i18nGlobal = i18n.global as unknown as I18nGlobalCompat;

export function tGlobal(key: string, params?: TranslateParams): string {
  return i18nGlobal.t(key, params);
}

/** Date formatting routes through the i18n instance, avoiding pages directly touching vue-i18n's union types. */
export function dGlobal(value: Date, key?: string): string {
  return i18nGlobal.d(value, key);
}

/** locale may be a string or ref under different vue-i18n type declarations; read it uniformly as LocaleId. */
export function getGlobalLocale(): LocaleId {
  const locale = i18nGlobal.locale;
  const value = typeof locale === 'string' ? locale : locale.value;
  return value as LocaleId;
}

/** Companion to getGlobalLocale, supporting both legacy/composition locale-holding forms. */
export function setGlobalLocale(locale: LocaleId): void {
  const target = i18nGlobal.locale;
  if (typeof target === 'string') {
    i18nGlobal.locale = locale;
  } else {
    target.value = locale;
  }
}

/**
 * Matches ValidationRuleAdapter: backend four-segment keys (e.g. sys.valid-msg.default.DictItemCode) in vue-i18n typically use the path with the leading atomic-service segment dropped.
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

/** Load i18n by config; list pages specify it in getI18nConfig */
export const loadMessagesForConfig = i18nService.loadMessagesForConfig.bind(i18nService);

/** Load AddEdit page-level validation i18n (optionally with list-page cacheHolder to avoid duplicate requests) */
export const loadMessagesForValidationPage = i18nService.loadMessagesForValidationPage.bind(i18nService);

/** Load app-level default i18n (called when App mounts) */
export const loadAppMessages = i18nService.loadAppMessages.bind(i18nService);

/** Switch language and persist to localStorage */
export function setLocale(locale: LocaleId): void {
  appMessagesLoadPromise = null;
  i18nService.setLocale(locale);
}
