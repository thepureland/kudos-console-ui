import { createI18n } from 'vue-i18n';
import zhCN from '../locales/zh-CN';
import zhTW from '../locales/zh-TW';
import enUS from '../locales/en-US';
import { backendRequest } from '../utils/backendRequest';

export type LocaleId = 'zh-CN' | 'zh-TW' | 'en-US';

const LOCALE_KEY = 'locale';

/**
 * 服务端翻译接口：GET {I18N_API_PATH}/{locale}
 * 返回格式与 locales/zh-CN.ts 一致（嵌套对象），或 { data: 同上 }。
 * 与本地语言包 merge 后，服务端键优先。
 */
const I18N_API_PATH = 'api/i18n';

const defaultLocale: LocaleId =
  (typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null) as LocaleId | null ||
  'zh-CN';

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'en-US': enUS,
  },
});

/** 从服务端拉取某语言的翻译并 merge 到当前 i18n（与本地语言包合并，服务端键优先） */
export async function loadMessagesFromServer(locale: LocaleId): Promise<void> {
  try {
    const res = await backendRequest({ url: `${I18N_API_PATH}/${locale}` });
    const messages = (res && typeof res === 'object' && 'data' in res ? (res as { data: Record<string, unknown> }).data : res) as Record<string, unknown> | undefined;
    if (messages && typeof messages === 'object') {
      i18n.global.mergeLocaleMessage(locale, messages);
    }
  } catch {
    // 接口失败时继续使用本地语言包
  }
}

export function setLocale(locale: LocaleId): void {
  i18n.global.locale.value = locale;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_KEY, locale);
  }
  loadMessagesFromServer(locale);
}

/** 语言选项：id、地区旗帜、该语言下的名称（始终用母语显示，不受当前语言影响） */
export const localeOptions: { id: LocaleId; flag: string; label: string }[] = [
  { id: 'zh-CN', flag: '🇨🇳', label: '简体中文' },
  { id: 'zh-TW', flag: '🇹🇼', label: '繁体中文(台湾)' },
  { id: 'en-US', flag: '🇺🇸', label: 'English (US)' },
];
