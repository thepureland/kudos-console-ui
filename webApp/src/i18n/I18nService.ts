import { createI18n, type I18n } from 'vue-i18n';
import zhCN from '../locales/zh-CN';
import zhTW from '../locales/zh-TW';
import enUS from '../locales/en-US';
import { backendRequest } from '../utils/backendRequest';

export type LocaleId = 'zh-CN' | 'zh-TW' | 'en-US';

/** I18nService relies only on a minimal global surface, reducing coupling to vue-i18n's complex generic signatures. */
type I18nGlobalCompat = {
  locale: string | { value: string };
  mergeLocaleMessage: (locale: string, message: Record<string, unknown>) => void;
};

/** Single config: i18n type -> namespace list */
export type I18nLoadConfig = { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode?: string };

const LOCALE_KEY = 'locale';

/**
 * Server-side batch translation endpoint: POST {I18N_API_PATH}, body is JSON (single DTO)
 * Full path: /api/admin/sys/i18n/batchGetI18ns
 * Params: SysI18nBatchPayload(locale, namespacesByI18nTypeDictCode, atomicServiceCodes)
 * Response: Map<i18nType, Map<namespace, Map<key, translation>>>; after merge, server keys take precedence
 */
const I18N_API_PATH = 'sys/i18n/batchGetI18ns';

/** Default namespaces fetched from batchGetI18ns at app startup (may be empty; dictionary item translations are fetched by DictService when loading a dict, using dict-item + dictType code). valid-msg/default/sys is the app-level i18n cache for backend validation rule messages. */
export const APP_DEFAULT_I18N_CONFIG: I18nLoadConfig[] = [
  /** accessrule: Compare-validation messages such as IP access rules (e.g. sys.valid-msg.accessrule.le-ip-start) */
  { atomicServiceCode: 'sys', i18nTypeDictCode: 'valid-msg', namespaces: ['default', 'accessrule'] },
  { atomicServiceCode: 'sys', i18nTypeDictCode: 'error-msg', namespaces: ['default', 'accessrule'] },
];

/** Locale options: id, regional flag, and the language's native name (always shown in the language itself, regardless of the active locale). */
export const localeOptions: { id: LocaleId; flag: string; label: string }[] = [
  { id: 'zh-CN', flag: '🇨🇳', label: '简体中文' },
  { id: 'zh-TW', flag: '🇹🇼', label: '繁体中文(台湾)' },
  { id: 'en-US', flag: '🇺🇸', label: 'English (US)' },
];

/** Date-time display formats per locale (used by formatDate / d('datetime')). */
const datetimeFormats: Record<LocaleId, Intl.DateTimeFormatOptions> = {
  'zh-CN': {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
  'zh-TW': {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
  'en-US': {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  },
};

/**
 * I18n service: owns vue-i18n instance creation, server-side translation loading, locale switching, and caching.
 *
 * @author K
 * @since 1.0.0
 */
export class I18nService {
  /** vue-i18n instance, used by app.use() and t() / d() etc. */
  readonly i18n: I18n;

  /** Cache of already-loaded locale+atomicServiceCode+namespacesKey combinations. */
  private readonly loadedCache = new Set<string>();

  /** Set of paths whose page-level validation i18n has been loaded (used when no cacheHolder is provided; cleared when the locale changes). */
  private readonly validationI18nLoadedPaths = new Set<string>();

  constructor() {
    const defaultLocale: LocaleId =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null) as LocaleId | null || 'zh-CN';

    this.i18n = createI18n({
      legacy: false,
      locale: defaultLocale,
      fallbackLocale: 'zh-CN',
      messages: {
        'zh-CN': zhCN,
        'zh-TW': zhTW,
        'en-US': enUS,
      },
      datetimeFormats: {
        'zh-CN': { datetime: datetimeFormats['zh-CN'] },
        'zh-TW': { datetime: datetimeFormats['zh-TW'] },
        'en-US': { datetime: datetimeFormats['en-US'] },
      },
    });
  }

  /** Convert flat keys (e.g. "columns.name") to a nested object. */
  private flatToNested(flat: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flat)) {
      const parts = key.split('.');
      let cur: Record<string, unknown> = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in cur) || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = value;
    }
    return result;
  }

  /**
   * Merge the backend response into a nested object that vue-i18n can consume.
   * - Types like `view`: keep the type layer (merged.view.menu) so t('view.menu.home') works.
   * - `dict-item`: the namespace (dict type code) is merged at the root level so t('cache_strategy.SINGLE_LOCAL') and the like use the backend translation instead of the frontend locale.
   */
  private mergeBatchResponse(data: Record<string, Record<string, Record<string, string>>>): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const [i18nType, namespaceMap] of Object.entries(data)) {
      const typeObj: Record<string, unknown> = {};
      for (const [namespace, keyValueMap] of Object.entries(namespaceMap)) {
        if (keyValueMap && typeof keyValueMap === 'object') {
          const nested = this.flatToNested(keyValueMap);
          if (Object.keys(nested).length > 0) {
            typeObj[namespace] = nested;
            if (i18nType === 'dict-item') {
              merged[namespace] = nested;
            }
          }
        }
      }
      if (i18nType !== 'dict-item' && Object.keys(typeObj).length > 0) {
        merged[i18nType] = typeObj;
      }
    }
    return merged;
  }

  /** For non-`dict-item` messages, also attach an alias prefixed by atomicServiceCode so full keys like t('sys.error-msg.default.200') resolve too. */
  private attachAtomicAliases(
    messages: Record<string, unknown>,
    atomicServiceCode: string
  ): Record<string, unknown> {
    const atomic = String(atomicServiceCode ?? '').trim();
    if (atomic === '') return messages;
    const aliasSource: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(messages)) {
      if (key === 'dict-item') continue;
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        aliasSource[key] = value;
      }
    }
    if (Object.keys(aliasSource).length === 0) return messages;
    return {
      ...messages,
      [atomic]: {
        ...((messages[atomic] as Record<string, unknown> | undefined) ?? {}),
        ...aliasSource,
      },
    };
  }

  /** Build the request's cache key (identical configs must produce the same key). */
  private toCacheKey(locale: string, atomic: string, namespacesByType: Record<string, string[]>): string {
    const parts = Object.entries(namespacesByType)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${[...v].sort().join(',')}`);
    return `${locale}---${atomic}---${parts.join(';')}`;
  }

  /** Batch-fetch translations from the server and merge them into the current i18n (POST body: SysI18nBatchPayload). */
  private async loadMessagesFromServer(
    namespacesByI18nTypeDictCode: Record<string, string[]>,
    atomicServiceCode: string
  ): Promise<void> {
    // Depending on the vue-i18n typing mode, `locale` may be a string or a ref; handle both shapes at runtime.
    const global = this.i18n.global as unknown as I18nGlobalCompat;
    const locale = (typeof global.locale === 'string' ? global.locale : global.locale.value) as LocaleId;
    try {
      const params = {
        locale,
        namespacesByI18nTypeDictCode,
        atomicServiceCodes: [atomicServiceCode],
      };
      if (import.meta.env?.DEV) {
        console.debug('[I18nService] batchGetI18ns request body:', JSON.stringify(params));
      }
      const res = await backendRequest({ url: I18N_API_PATH, method: 'post', params });
      const raw = (res && typeof res === 'object' && 'data' in res ? (res as { data: unknown }).data : res) as
        | Record<string, Record<string, Record<string, string>>>
        | undefined;
      if (raw && typeof raw === 'object') {
        const messages = this.attachAtomicAliases(this.mergeBatchResponse(raw), atomicServiceCode);
        if (Object.keys(messages).length > 0) {
          global.mergeLocaleMessage(locale, messages);
        }
      }
    } catch (e) {
      if (import.meta.env?.DEV) {
        const err = e as { message?: string; response?: { status?: number; data?: unknown } };
        console.warn(
          '[I18nService] batchGetI18ns request failed; falling back to the local language pack.',
          '\n  request body:', { locale, namespacesByI18nTypeDictCode, atomicServiceCodes: [atomicServiceCode] },
          '\n  error:', err?.message ?? e,
          err?.response ? `\n  response: status=${err.response.status} data=${JSON.stringify(err.response.data)}` : ''
        );
      }
    }
  }

  /** Clear the cache on locale change; the next page open will load using the new locale. */
  clearCache(): void {
    this.loadedCache.clear();
    this.validationI18nLoadedPaths.clear();
  }

  /**
   * Load this AddEdit page's backend-provided custom-validation message i18n (type: `view`).
   * Skip if pathCacheKey is already in cacheHolder or the internal cache to avoid duplicate requests.
   * @param atomicServiceCode e.g. 'sys'
   * @param i18nTypeDictCode e.g. 'view'
   * @param namespace e.g. 'sys.tenant'
   * @param pathCacheKey cache key, typically getRootActionPath()
   * @param cacheHolder list-page-supplied Ref<Set<string>> or Set<string> for list-page-level caching; falls back to the application-level cache if omitted
   */
  async loadMessagesForValidationPage(
    atomicServiceCode: string,
    i18nTypeDictCode: string,
    namespace: string,
    pathCacheKey: string,
    cacheHolder?: import('vue').Ref<Set<string>> | Set<string>
  ): Promise<void> {
    const set = cacheHolder != null ? (typeof (cacheHolder as { value?: unknown }).value !== 'undefined' ? (cacheHolder as import('vue').Ref<Set<string>>).value : (cacheHolder as Set<string>)) : this.validationI18nLoadedPaths;
    if (set.has(pathCacheKey)) return;
    await this.loadMessagesForConfig([{ atomicServiceCode, i18nTypeDictCode, namespaces: [namespace] }]);
    set.add(pathCacheKey);
  }

  /**
   * Load i18n by config; list pages specify this via getI18nConfig and configs already loaded are skipped.
   * Configs sharing the same atomicServiceCode are merged into a single request.
   */
  async loadMessagesForConfig(configs: I18nLoadConfig[] | null | undefined): Promise<void> {
    if (!configs?.length) return;
    // The cache key must use the current locale; otherwise, after a language switch we may reuse the old locale's loaded marker.
    const global = this.i18n.global as unknown as I18nGlobalCompat;
    const locale = (typeof global.locale === 'string' ? global.locale : global.locale.value) as LocaleId;
    const byAtomic = new Map<string, Record<string, string[]>>();
    for (const c of configs) {
      const atomic = c.atomicServiceCode ?? '';
      const map = byAtomic.get(atomic) ?? {};
      const existing = map[c.i18nTypeDictCode] ?? [];
      map[c.i18nTypeDictCode] = [...new Set([...existing, ...c.namespaces])];
      byAtomic.set(atomic, map);
    }
    for (const [atomic, namespacesByType] of byAtomic) {
      const cacheKey = this.toCacheKey(locale, atomic, namespacesByType);
      if (this.loadedCache.has(cacheKey)) continue;
      await this.loadMessagesFromServer(namespacesByType, atomic);
      this.loadedCache.add(cacheKey);
    }
  }

  /**
   * Load application-level default i18n (called when the app mounts).
   * Default namespaces can be configured; skips the request when empty.
   */
  async loadAppMessages(configs?: I18nLoadConfig[]): Promise<void> {
    await this.loadMessagesForConfig(configs ?? []);
  }

  /** Switch the locale and persist it to localStorage. */
  setLocale(locale: LocaleId): void {
    // Supports both the legacy string `locale` and the composition-API ref `locale`.
    const global = this.i18n.global as unknown as I18nGlobalCompat;
    if (typeof global.locale === 'string') {
      global.locale = locale;
    } else {
      global.locale.value = locale;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_KEY, locale);
    }
    this.clearCache();
  }
}
