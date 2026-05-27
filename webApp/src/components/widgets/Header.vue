<template>
  <div class="header" :class="headerTimeClass">
    <!-- Left: logo + breadcrumb; right: fullscreen / theme / language / messages / user dropdown; sidebar collapse is toggled at the divider between sidebar and content -->
    <div class="header-left">
      <a href="#" class="logo" @click.prevent="store.commit('setCurrentMenuPath', resolvePath('/home'))">
        <span class="logo-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="currentColor" opacity="0.15" />
            <path d="M11 9h2v5.5l4.5-5.5h2.2L14.2 16l5.5 7h-2.2l-4.2-5.5V23h-2V9z" fill="currentColor" />
          </svg>
        </span>
        <span class="logo-text">{{ t('header.appName') }}</span>
      </a>
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <template v-for="(item, i) in breadcrumbItems" :key="`${item.path}__${item.titleKey}__${i}`">
          <span v-if="i > 0" class="breadcrumb-sep">/</span>
          <a
            v-if="i < breadcrumbItems.length - 1"
            href="#"
            class="breadcrumb-link"
            @click.prevent="store.commit('setCurrentMenuPath', resolvePath(item.path))"
          >
            {{ t(item.titleKey) }}
          </a>
          <span v-else class="breadcrumb-current">{{ t(item.titleKey) }}</span>
        </template>
      </nav>
    </div>
    <div class="header-right">
      <a
        href="#"
        class="icon-btn"
        :class="{ 'is-hover-lift': messagesLinkHover }"
        :title="t('header.messages')"
        @click.prevent="store.commit('setCurrentMenuPath', resolvePath('/tabs'))"
        @mouseenter="messagesLinkHover = true"
        @mouseleave="messagesLinkHover = false"
      >
        <el-tooltip effect="dark" :content="message ? t('header.messagesCount', { n: message }) : t('header.messages')" placement="bottom">
          <el-icon><Bell /></el-icon>
        </el-tooltip>
        <span v-if="message" class="badge">{{ message > 99 ? '99+' : message }}</span>
      </a>
      <button
        type="button"
        class="icon-btn"
        :class="{ 'is-hover-lift': fullscreenBtnHover }"
        :title="isFullscreen ? t('header.exitFullscreen') : t('header.fullscreen')"
        aria-label="Toggle fullscreen"
        @click="toggleFullscreen"
        @mouseenter="fullscreenBtnHover = true"
        @mouseleave="fullscreenBtnHover = false"
      >
        <el-tooltip effect="dark" :content="isFullscreen ? t('header.exitFullscreen') + ' (Esc)' : t('header.fullscreen')" placement="bottom">
          <el-icon><FullScreen /></el-icon>
        </el-tooltip>
      </button>
      <el-dropdown
        trigger="hover"
        @command="handleThemeCommand"
        @visible-change="(v: boolean) => themeDropdownVisible = v"
      >
        <button
          type="button"
          class="icon-btn theme-trigger"
          :class="{ 'is-hover-lift': themeTriggerHover || themeDropdownVisible }"
          :aria-label="t('header.theme')"
          @mouseenter="themeTriggerHover = true"
          @mouseleave="themeTriggerHover = false"
        >
          <span class="theme-trigger-inner">
            <span class="theme-preview" :style="{ background: currentThemeColor }" />
            <el-icon class="theme-caret"><CaretBottom /></el-icon>
          </span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="th in themeList"
              :key="th.id"
              :command="th.id"
              :class="{ 'is-active': currentThemeId === th.id }"
            >
              <span class="theme-option">
                <span class="theme-option-swatch" :style="{ background: th.color }" />
                <span>{{ th.label }}</span>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown
        trigger="hover"
        @command="handleLocaleCommand"
        @visible-change="(v: boolean) => langDropdownVisible = v"
      >
        <button
          type="button"
          class="icon-btn lang-trigger"
          :class="{ 'is-hover-lift': langTriggerHover || langDropdownVisible }"
          :aria-label="t('header.language')"
          @mouseenter="langTriggerHover = true"
          @mouseleave="langTriggerHover = false"
        >
          <span class="lang-trigger-inner">
            <span class="lang-flag">{{ currentLocaleFlag }}</span>
            <span class="lang-label">{{ currentLocaleNativeLabel }}</span>
            <el-icon class="theme-caret"><CaretBottom /></el-icon>
          </span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="opt in localeOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active': currentLocaleId === opt.id }"
            >
              <span class="lang-option">
                <span class="lang-option-flag">{{ opt.flag }}</span>
                <span>{{ opt.label }}</span>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown
        v-if="REQUIRE_AUTH"
        trigger="hover"
        @command="handleCommand"
        @visible-change="(v: boolean) => userDropdownVisible = v"
      >
        <div
          class="user-area"
          :class="{ 'is-hover-lift': userAreaHover || userDropdownVisible }"
          @mouseenter="userAreaHover = true"
          @mouseleave="userAreaHover = false"
        >
          <img :src="avatar" alt="" class="avatar" />
          <span class="username">{{ username }}</span>
          <el-icon class="caret"><CaretBottom /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="user">{{ t('header.profile') }}</el-dropdown-item>
            <el-dropdown-item divided command="logout">{{ t('header.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Bell, CaretBottom, FullScreen } from '@element-plus/icons-vue';
import { AuthApiFactory } from 'shared';
import { resolvePath } from '../../config/menuPathToComponent';
import { REQUIRE_AUTH } from '../../config/auth';
import { localeOptions, setLocale, type LocaleId } from '../../i18n';

const { t, locale } = useI18n();
const router = useRouter();
const store = useStore();
const currentMenuPath = computed(() => store.state.currentMenuPath);
/** Only used to auto-collapse the sidebar on narrow screens */
const collapse = computed(() => store.state.collapse);

// ---------- Icon hover lift (JS controls .is-hover-lift; dropdown items stay lifted while "hovered or open" to avoid flicker) ----------
const fullscreenBtnHover = ref(false);
const messagesLinkHover = ref(false);
const themeTriggerHover = ref(false);
const themeDropdownVisible = ref(false);
const langTriggerHover = ref(false);
const langDropdownVisible = ref(false);
const userAreaHover = ref(false);
const userDropdownVisible = ref(false);

/** Tag the header with a time-of-day class used by the ::after overlay (matches the Welcome hero) */
const headerTimeClass = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'header--time-morning';
  if (h >= 11 && h < 17) return 'header--time-afternoon';
  if (h >= 17 && h < 21) return 'header--time-evening';
  return 'header--time-night';
});

// ---------- Internationalization ----------
const currentLocaleId = ref<LocaleId>((locale.value as string) as LocaleId);
const currentLocaleNativeLabel = computed(
  () => localeOptions.find((o) => o.id === currentLocaleId.value)?.label ?? currentLocaleId.value
);
const currentLocaleFlag = computed(
  () => localeOptions.find((o) => o.id === currentLocaleId.value)?.flag ?? '🌐'
);
function handleLocaleCommand(id: string) {
  const next = id as LocaleId;
  currentLocaleId.value = next;
  setLocale(next);
}

// ---------- Breadcrumb ----------
/** First path segment -> breadcrumb parent (i18n titleKey + first child path navigated to on click) */
const SEGMENT_BREADCRUMB: Record<string, { titleKey: string; firstChildPath: string }> = {
  sys: { titleKey: 'route.sys', firstChildPath: '/sys/cache' },
  user: { titleKey: 'route.user', firstChildPath: '/user/account' },
  rbac: { titleKey: 'route.rbac', firstChildPath: '/rbac/role' },
};
/** Three-level menus: when the current path falls under an "intermediate level", insert that level into the breadcrumb (path -> intermediate-level titleKey) */
const BREADCRUMB_MIDDLE: Record<string, { titleKey: string; path: string }> = {
  '/sys/cache': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/dict': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/param': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/domain': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/tenant': { titleKey: 'route.sysBasic', path: '/sys/basic' },
};
type BreadcrumbItem = { titleKey: string; path: string };
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const path = currentMenuPath.value;
  const segments = path.split('/').filter(Boolean);
  const menuItem = (store.getters.getMenuItemByPath as (path: string) => { titleKey?: string } | undefined)(path);
  const titleKey = segments.length === 0 ? 'route.home' : (menuItem?.titleKey ?? 'route.home');
  if (segments.length === 0) return [{ titleKey: 'route.home', path: '/home' }];
  if (segments.length === 1 && segments[0] === 'home') return [{ titleKey: 'route.home', path: '/home' }];
  const parent = SEGMENT_BREADCRUMB[segments[0]];
  const middle = BREADCRUMB_MIDDLE[path];
  if (parent) {
    const items: BreadcrumbItem[] = [
      { titleKey: parent.titleKey, path: parent.firstChildPath },
    ];
    if (middle) items.push({ titleKey: middle.titleKey, path: middle.path });
    items.push({ titleKey, path });
    return items;
  }
  return [{ titleKey, path }];
});

// ---------- User and messages ----------
/** Placeholder avatar (can be replaced with a real user avatar URL) */
const avatar = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23c0c4cc"/><circle cx="20" cy="16" r="6" fill="%23fff"/><path fill="%23fff" d="M8 38c0-6.6 5.4-12 12-12s12 5.4 12 12H8z"/></svg>'
);
const username = ref(localStorage.getItem('current_username') || '');
const message = ref(0);

function isLocalhost(): boolean {
  const h = typeof window !== 'undefined' ? window.location?.hostname : '';
  return h === 'localhost' || h === '127.0.0.1';
}
async function fetchUser() {
  if (!AuthApiFactory.getInstance().hasToken()) return;
  try {
    const api = AuthApiFactory.getInstance().getAuthApi();
    const me = await api.getMe();
    const name = me.displayName || me.username;
    const count = (me as { unreadMessageCount?: number }).unreadMessageCount ?? 0;
    if (name) {
      username.value = name;
      message.value = count;
      localStorage.setItem('current_username', name);
    } else if (isLocalhost()) {
      username.value = 'Admin';
      message.value = 2;
      localStorage.setItem('current_username', 'Admin');
    }
  } catch {
    if (isLocalhost()) {
      username.value = 'Admin';
      message.value = 2;
      localStorage.setItem('current_username', 'Admin');
    }
  }
}
async function handleCommand(command: string) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm(
        t('header.logoutConfirmMessage'),
        t('header.logoutConfirm'),
        {
          confirmButtonText: t('header.confirmOk'),
          cancelButtonText: t('header.cancel'),
          type: 'warning',
        }
      );
      AuthApiFactory.getInstance().getAuthApi().logout();
      store.commit('setAuthenticated', false);
      localStorage.removeItem('current_username');
      router.push('/login');
    } catch {
      // User cancelled; do not log out
    }
  } else if (command === 'user') {
    store.commit('setCurrentMenuPath', resolvePath('/user/account'));
  }
}

// ---------- Theme ----------
const THEME_KEY = 'theme';
const themeList: { id: string; label: string; color: string }[] = [
  { id: 'a-light', label: 'Classic Blue · Light', color: '#2563EB' },
  { id: 'a-dark', label: 'Classic Blue · Dark', color: '#1E293B' },
  { id: 'b-light', label: 'Premium Black & Gold · Light', color: '#A78BFA' },
  { id: 'b-dark', label: 'Premium Black & Gold · Dark', color: '#27272A' },
  { id: 'c-light', label: 'Fresh Green Blue · Light', color: '#0EA5E9' },
  { id: 'c-dark', label: 'Fresh Green Blue · Dark', color: '#0B2A2A' },
  { id: 'd-light', label: 'Warm Brand · Light', color: '#F97316' },
  { id: 'd-dark', label: 'Warm Brand · Dark', color: '#7C2D12' },
];
const VALID_THEME_IDS = ['a-light', 'a-dark', 'b-light', 'b-dark', 'c-light', 'c-dark', 'd-light', 'd-dark'];
const DEFAULT_THEME = 'a-light';

function getInitialTheme(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const raw = document.documentElement.getAttribute('data-theme') || localStorage.getItem(THEME_KEY);
  return raw && VALID_THEME_IDS.includes(raw) ? raw : DEFAULT_THEME;
}
const currentThemeId = ref(getInitialTheme());
const currentThemeLabel = computed(() => themeList.find((th) => th.id === currentThemeId.value)?.label ?? 'Classic Blue · Light');
const currentThemeColor = computed(() => themeList.find((th) => th.id === currentThemeId.value)?.color ?? '#2563EB');
function handleThemeCommand(themeId: string) {
  if (typeof document === 'undefined') return;
  currentThemeId.value = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  if (themeId.endsWith('-dark')) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, themeId);
}

// ---------- Fullscreen ----------
const isFullscreen = ref(false);
function isDocFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
}
function toggleFullscreen() {
  if (typeof document === 'undefined') return;
  const doc = document as Document & { exitFullscreen?: () => Promise<void>; webkitExitFullscreen?: () => Promise<void>; fullscreenElement?: Element; webkitFullscreenElement?: Element };
  const docEl = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void>; webkitRequestFullscreen?: () => Promise<void> };
  if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
    const exitFn = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (exitFn) exitFn.call(doc).then(() => { isFullscreen.value = false; }).catch(() => {});
  } else {
    const requestFn = docEl.requestFullscreen ?? docEl.webkitRequestFullscreen;
    if (requestFn) requestFn.call(docEl).then(() => { isFullscreen.value = true; }).catch(() => {});
  }
}
function onFullscreenChange() {
  isFullscreen.value = isDocFullscreen();
}

// ---------- Sidebar collapse ----------
const collapseChange = () => store.commit('handleCollapse', !collapse.value);

onMounted(() => {
  fetchUser();
  if (document.body.clientWidth < 1500 && !collapse.value) collapseChange();
  isFullscreen.value = isDocFullscreen();
  currentThemeId.value = getInitialTheme();
  currentLocaleId.value = locale.value as LocaleId;
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
});
</script>
<style scoped>
.header {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px 0 0;
  background: linear-gradient(180deg, var(--theme-header-bg) 0%, var(--theme-header-bg-end) 100%);
  color: var(--theme-header-text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

/* Time-of-day overlay: full-bleed pseudo element that does not cover the theme background; content z-index is higher than the pseudo */
.header::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.header.header--time-morning::after {
  background: linear-gradient(180deg, transparent 0%, rgba(100, 150, 255, 0.08) 100%);
  border-bottom: 1px solid rgba(100, 150, 255, 0.2);
}

.header.header--time-afternoon::after {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.04) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header.header--time-evening::after {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 180, 100, 0.06) 100%);
  border-bottom: 1px solid rgba(255, 200, 150, 0.25);
}

.header.header--time-night::after {
  background: linear-gradient(180deg, transparent 0%, rgba(140, 140, 200, 0.06) 100%);
  border-bottom: 1px solid rgba(160, 160, 220, 0.2);
}

.header-left {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  min-width: 250px;
  padding-left: 12px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--theme-header-text);
  text-decoration: none;
  cursor: pointer;
}
.logo-icon {
  display: flex;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
}
.logo-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.logo:hover {
  color: var(--theme-header-text);
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--theme-header-border);
  font-size: 13px;
  color: var(--theme-header-text-muted);
  gap: 4px;
}

.breadcrumb-sep {
  color: var(--theme-header-border);
  user-select: none;
}

.breadcrumb-link {
  color: var(--theme-header-text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb-link:hover {
  color: var(--theme-header-text);
}

.breadcrumb-current {
  color: var(--theme-header-text);
  font-weight: 500;
}

.header-right {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-header-text-muted);
  text-decoration: none;
  transition: color 0.2s, transform 0.2s ease;
  position: relative;
  cursor: pointer;
  font: inherit;
  padding: 0;
}

a.icon-btn {
  cursor: pointer;
}

.icon-btn:hover {
  color: var(--theme-header-text);
}

/* Hover lift: .is-hover-lift toggled by JS, the transform lives here in one place */
.header :deep(.icon-btn.is-hover-lift),
.header :deep(.user-area.is-hover-lift) {
  transform: translateY(-2px) !important;
}

.icon-btn:focus,
.icon-btn:focus-visible {
  outline: none;
  box-shadow: none;
}

.icon-btn :deep(.el-icon) {
  font-size: 18px;
}

/* Remove the white-outside, blue-inside border on the three dropdown triggers (Element's default hover/focus styles) */
.header-right :deep(.el-dropdown) {
  outline: none;
}
.header-right :deep(.el-dropdown .el-dropdown__trigger),
.header-right :deep(.el-dropdown > *) {
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  border: none !important;
}
.header-right :deep(.el-dropdown .el-dropdown__trigger:hover),
.header-right :deep(.el-dropdown .el-dropdown__trigger:focus),
.header-right :deep(.el-dropdown > *:hover),
.header-right :deep(.el-dropdown > *:focus) {
  outline: none !important;
  box-shadow: none !important;
  background: transparent !important;
  border: none !important;
}
.header-right :deep(.el-dropdown .el-dropdown__trigger:focus-visible),
.header-right :deep(.el-dropdown > *:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

.theme-trigger {
  padding: 0 8px;
}

.theme-trigger-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-preview {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.theme-trigger .theme-caret {
  font-size: 12px;
  color: var(--theme-header-text-muted);
}

.lang-trigger {
  padding: 0 8px;
  width: auto;
  min-width: 36px;
  justify-content: flex-start;
}

.lang-trigger-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--theme-header-text-muted);
}

/* Align the flag emoji on its own line so it isn't clipped or wrapped */
.lang-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.lang-label {
  white-space: nowrap;
}

.lang-trigger .theme-caret {
  font-size: 12px;
  color: var(--theme-header-text-muted);
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-option-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-option-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

html.dark .theme-option-swatch {
  border-color: rgba(255, 255, 255, 0.25);
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: #f56c6c;
  border-radius: 8px;
}

.user-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 6px;
  margin-left: 8px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  border: none;
  background: transparent;
  transition: transform 0.2s ease;
}

.user-area:focus,
.user-area:focus-visible {
  outline: none;
  box-shadow: none;
  background: transparent;
}


.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.username {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--theme-header-text);
}

.user-area .caret {
  font-size: 12px;
  color: var(--theme-header-text-muted);
}
</style>
<style>
/* Non-scoped fallback: make sure .is-hover-lift's transform is not overridden by other styles */
.header .icon-btn.is-hover-lift,
.header .user-area.is-hover-lift {
  transform: translateY(-2px) !important;
}
</style>