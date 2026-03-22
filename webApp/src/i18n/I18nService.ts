import { createI18n, type I18n } from 'vue-i18n';
import zhCN from '../locales/zh-CN';
import zhTW from '../locales/zh-TW';
import enUS from '../locales/en-US';
import { backendRequest } from '../utils/backendRequest';

export type LocaleId = 'zh-CN' | 'zh-TW' | 'en-US';

/** 单条配置：国际化类型 -> 命名空间列表 */
export type I18nLoadConfig = { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode?: string };

const LOCALE_KEY = 'locale';

/**
 * 服务端批量翻译接口：POST {I18N_API_PATH}，body 为 JSON（单 DTO）
 * 完整路径：/api/admin/sys/i18n/batchGetI18ns
 * 参数：SysI18nBatchPayload(locale, namespacesByI18nTypeDictCode, atomicServiceCodes)
 * 返回：Map<国际化类型, Map<命名空间, Map<key, 译文>>>；merge 后服务端键优先
 */
const I18N_API_PATH = 'sys/i18n/batchGetI18ns';

/** 应用启动时从 batchGetI18ns 拉取的默认命名空间（可为空；字典项译文在 DictService 加载字典时按 dict-item + 字典类型编码 拉取）。valid-msg/default/sys 为后端校验规则 message 的国际化应用级缓存。 */
export const APP_DEFAULT_I18N_CONFIG: I18nLoadConfig[] = [
  { atomicServiceCode: 'sys', i18nTypeDictCode: 'valid-msg', namespaces: ['default'] },
  { atomicServiceCode: 'sys', i18nTypeDictCode: 'error-msg', namespaces: ['default'] },
];

/** 语言选项：id、地区旗帜、该语言下的名称（始终用母语显示，不受当前语言影响） */
export const localeOptions: { id: LocaleId; flag: string; label: string }[] = [
  { id: 'zh-CN', flag: '🇨🇳', label: '简体中文' },
  { id: 'zh-TW', flag: '🇹🇼', label: '繁体中文(台湾)' },
  { id: 'en-US', flag: '🇺🇸', label: 'English (US)' },
];

/** 各语言日期时间显示格式（用于 formatDate / d('datetime')） */
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
 * 国际化服务：负责 vue-i18n 实例创建、服务端翻译加载、语言切换与缓存。
 *
 * @author K
 * @since 1.0.0
 */
export class I18nService {
  /** vue-i18n 实例，供 app.use() 及 t()、d() 等使用 */
  readonly i18n: I18n;

  /** 已加载的 locale+atomicServiceCode+namespacesKey 缓存 */
  private readonly loadedCache = new Set<string>();

  /** 已加载「页面级校验 i18n」的 path 集合（无 cacheHolder 时使用；切换语言时清空） */
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

  /** 将扁平 key（如 "columns.name"）转为嵌套对象 */
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
   * 从后端返回结构合并为 vue-i18n 可用的嵌套对象。
   * - view 等类型：保留类型层，merged.view.menu，使 t('view.menu.home') 生效。
   * - dict-item：命名空间（字典类型编码）合并到根级，使 t('cache_strategy.SINGLE_LOCAL') 等使用后端译文而非前端 locale。
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

  /** 为非 dict-item 文案额外挂一份 atomicServiceCode 前缀别名，使 t('sys.error-msg.default.200') 这类完整 key 也能命中。 */
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

  /** 生成请求的缓存 key（保证相同配置得到相同 key） */
  private toCacheKey(locale: string, atomic: string, namespacesByType: Record<string, string[]>): string {
    const parts = Object.entries(namespacesByType)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${[...v].sort().join(',')}`);
    return `${locale}---${atomic}---${parts.join(';')}`;
  }

  /** 从服务端批量拉取翻译并 merge 到当前 i18n（POST body SysI18nBatchPayload） */
  private async loadMessagesFromServer(
    namespacesByI18nTypeDictCode: Record<string, string[]>,
    atomicServiceCode: string
  ): Promise<void> {
    const locale = this.i18n.global.locale.value as LocaleId;
    try {
      const params = {
        locale,
        namespacesByI18nTypeDictCode,
        atomicServiceCodes: [atomicServiceCode],
      };
      if (import.meta.env?.DEV) {
        console.debug('[I18nService] batchGetI18ns 请求体:', JSON.stringify(params));
      }
      const res = await backendRequest({ url: I18N_API_PATH, method: 'post', params });
      const raw = (res && typeof res === 'object' && 'data' in res ? (res as { data: unknown }).data : res) as
        | Record<string, Record<string, Record<string, string>>>
        | undefined;
      if (raw && typeof raw === 'object') {
        const messages = this.attachAtomicAliases(this.mergeBatchResponse(raw), atomicServiceCode);
        if (Object.keys(messages).length > 0) {
          this.i18n.global.mergeLocaleMessage(locale, messages);
        }
      }
    } catch (e) {
      if (import.meta.env?.DEV) {
        const err = e as { message?: string; response?: { status?: number; data?: unknown } };
        console.warn(
          '[I18nService] batchGetI18ns 请求失败，将使用本地语言包。',
          '\n  请求体:', { locale, namespacesByI18nTypeDictCode, atomicServiceCodes: [atomicServiceCode] },
          '\n  错误:', err?.message ?? e,
          err?.response ? `\n  响应: status=${err.response.status} data=${JSON.stringify(err.response.data)}` : ''
        );
      }
    }
  }

  /** 切换语言时清空缓存，下次打开页面时按新语言加载 */
  clearCache(): void {
    this.loadedCache.clear();
    this.validationI18nLoadedPaths.clear();
  }

  /**
   * 加载本 AddEdit 页的后端自定义校验提示 i18n（view 类型）。
   * 若 pathCacheKey 已在 cacheHolder 或内部缓存中则跳过，避免重复请求。
   * @param atomicServiceCode 如 'sys'
   * @param i18nTypeDictCode 如 'view'
   * @param namespace 如 'sys.tenant'
   * @param pathCacheKey 缓存键，通常为 getRootActionPath()
   * @param cacheHolder 列表页提供的 Ref<Set<string>> 或 Set<string>，用于列表页级缓存；不传则用应用级缓存
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
   * 按配置加载国际化，列表页在 getI18nConfig 中指定；已加载则跳过。
   * 同 atomicServiceCode 的配置会合并为一次请求。
   */
  async loadMessagesForConfig(configs: I18nLoadConfig[] | null | undefined): Promise<void> {
    if (!configs?.length) return;
    const locale = this.i18n.global.locale.value as LocaleId;
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
   * 加载应用级默认国际化（App 挂载时调用）。
   * 可配置默认命名空间，当前为空则跳过请求。
   */
  async loadAppMessages(configs?: I18nLoadConfig[]): Promise<void> {
    await this.loadMessagesForConfig(configs ?? []);
  }

  /** 切换语言并持久化到 localStorage */
  setLocale(locale: LocaleId): void {
    this.i18n.global.locale.value = locale;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_KEY, locale);
    }
    this.clearCache();
  }
}
