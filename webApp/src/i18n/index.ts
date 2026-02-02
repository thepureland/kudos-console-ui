import { createI18n } from 'vue-i18n';
import zhCN from '../locales/zh-CN';
import zhTW from '../locales/zh-TW';
import enUS from '../locales/en-US';

export type LocaleId = 'zh-CN' | 'zh-TW' | 'en-US';

const LOCALE_KEY = 'locale';

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

export function setLocale(locale: LocaleId): void {
  i18n.global.locale.value = locale;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_KEY, locale);
  }
}

/** 语言选项：id、地区旗帜、该语言下的名称（始终用母语显示，不受当前语言影响） */
export const localeOptions: { id: LocaleId; flag: string; label: string }[] = [
  { id: 'zh-CN', flag: '🇨🇳', label: '简体中文' },
  { id: 'zh-TW', flag: '🇹🇼', label: '繁体中文(台湾)' },
  { id: 'en-US', flag: '🇺🇸', label: 'English (US)' },
];
