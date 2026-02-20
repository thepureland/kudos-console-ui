<template>
  <div class="header" :class="headerTimeClass">
    <!-- 左侧：折叠按钮 + Logo + 面包屑；右侧：全屏 / 主题 / 语言 / 消息 / 用户下拉 -->
    <div class="header-left">
      <button
        type="button"
        class="collapse-btn"
        :class="{ 'is-hover-lift': collapseBtnHover }"
        aria-label="折叠侧栏"
        @click="collapseChange"
        @mouseenter="collapseBtnHover = true"
        @mouseleave="collapseBtnHover = false"
      >
        <el-icon><Fold v-if="!collapse" /><Expand v-else /></el-icon>
      </button>
      <router-link to="/home" class="logo">{{ t('header.appName') }}</router-link>
      <nav class="breadcrumb" aria-label="面包屑">
        <template v-for="(item, i) in breadcrumbItems" :key="`${item.path}__${item.titleKey}__${i}`">
          <span v-if="i > 0" class="breadcrumb-sep">/</span>
          <router-link
            v-if="i < breadcrumbItems.length - 1"
            :to="item.path"
            class="breadcrumb-link"
          >
            {{ t(item.titleKey) }}
          </router-link>
          <span v-else class="breadcrumb-current">{{ t(item.titleKey) }}</span>
        </template>
      </nav>
    </div>
    <div class="header-right">
      <router-link
        to="/tabs"
        class="icon-btn"
        :class="{ 'is-hover-lift': messagesLinkHover }"
        :title="t('header.messages')"
        @mouseenter="messagesLinkHover = true"
        @mouseleave="messagesLinkHover = false"
      >
        <el-tooltip effect="dark" :content="message ? t('header.messagesCount', { n: message }) : t('header.messages')" placement="bottom">
          <el-icon><Bell /></el-icon>
        </el-tooltip>
        <span v-if="message" class="badge">{{ message > 99 ? '99+' : message }}</span>
      </router-link>
      <button
        type="button"
        class="icon-btn"
        :class="{ 'is-hover-lift': fullscreenBtnHover }"
        :title="isFullscreen ? t('header.exitFullscreen') : t('header.fullscreen')"
        aria-label="全屏切换"
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
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Bell, CaretBottom, Expand, Fold, FullScreen } from '@element-plus/icons-vue';
import { AuthApiFactory } from 'shared';
import { localeOptions, setLocale, type LocaleId } from '../../i18n';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useStore();
const collapse = computed(() => store.state.collapse);

// ---------- 图标悬停上移（JS 控制 .is-hover-lift，下拉项在“悬停或展开”时保持上移避免闪烁） ----------
const collapseBtnHover = ref(false);
const fullscreenBtnHover = ref(false);
const messagesLinkHover = ref(false);
const themeTriggerHover = ref(false);
const themeDropdownVisible = ref(false);
const langTriggerHover = ref(false);
const langDropdownVisible = ref(false);
const userAreaHover = ref(false);
const userDropdownVisible = ref(false);

/** 根据时段给 header 加 class，用于 ::after 叠加层（与 Welcome hero 时段一致） */
const headerTimeClass = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'header--time-morning';
  if (h >= 11 && h < 17) return 'header--time-afternoon';
  if (h >= 17 && h < 21) return 'header--time-evening';
  return 'header--time-night';
});

// ---------- 多语言 ----------
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

// ---------- 面包屑 ----------
/** 路径首段 → 面包屑父级（i18n titleKey + 点击跳转的首个子路径） */
const SEGMENT_BREADCRUMB: Record<string, { titleKey: string; firstChildPath: string }> = {
  sys: { titleKey: 'route.sys', firstChildPath: '/sys/cache' },
  user: { titleKey: 'route.user', firstChildPath: '/user/account' },
  rbac: { titleKey: 'route.rbac', firstChildPath: '/rbac/role' },
};
/** 三级菜单：当前路径属于某「中间级」时，面包屑插入该级（path → 中间级 titleKey） */
const BREADCRUMB_MIDDLE: Record<string, { titleKey: string; path: string }> = {
  '/sys/cache': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/dict': { titleKey: 'route.sysBasic', path: '/sys/basic' },
  '/sys/param': { titleKey: 'route.sysBasic', path: '/sys/basic' },
};
type BreadcrumbItem = { titleKey: string; path: string };
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const path = route.path;
  const titleKey = (route.meta?.titleKey as string) || 'route.home';
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return [{ titleKey: 'route.home', path: '/home' }];
  if (segments.length === 1 && segments[0] === 'home') return [{ titleKey: 'route.home', path: '/home' }];
  const parent = SEGMENT_BREADCRUMB[segments[0]];
  const middle = BREADCRUMB_MIDDLE[path];
  if (parent) {
    const items: BreadcrumbItem[] = [
      { titleKey: parent.titleKey, path: parent.firstChildPath },
    ];
    if (middle) items.push({ titleKey: middle.titleKey, path: middle.path });
    items.push({ titleKey, path: route.path });
    return items;
  }
  return [{ titleKey, path: route.path }];
});

// ---------- 用户与消息 ----------
/** 占位头像（可替换为真实用户头像 URL） */
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
      // 用户取消，不执行退出
    }
  } else if (command === 'user') {
    router.push('/user/account');
  }
}

// ---------- 主题 ----------
const THEME_KEY = 'theme';
const themeList: { id: string; label: string; color: string }[] = [
  { id: 'a-light', label: '经典蓝 · 浅色', color: '#2563EB' },
  { id: 'a-dark', label: '经典蓝 · 深色', color: '#1E293B' },
  { id: 'b-light', label: '高级黑金 · 浅色', color: '#A78BFA' },
  { id: 'b-dark', label: '高级黑金 · 深色', color: '#27272A' },
  { id: 'c-light', label: '清爽绿蓝 · 浅色', color: '#0EA5E9' },
  { id: 'c-dark', label: '清爽绿蓝 · 深色', color: '#0B2A2A' },
  { id: 'd-light', label: '暖色品牌 · 浅色', color: '#F97316' },
  { id: 'd-dark', label: '暖色品牌 · 深色', color: '#7C2D12' },
];
const VALID_THEME_IDS = ['a-light', 'a-dark', 'b-light', 'b-dark', 'c-light', 'c-dark', 'd-light', 'd-dark'];
const DEFAULT_THEME = 'a-light';

function getInitialTheme(): string {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const raw = document.documentElement.getAttribute('data-theme') || localStorage.getItem(THEME_KEY);
  return raw && VALID_THEME_IDS.includes(raw) ? raw : DEFAULT_THEME;
}
const currentThemeId = ref(getInitialTheme());
const currentThemeLabel = computed(() => themeList.find((th) => th.id === currentThemeId.value)?.label ?? '经典蓝 · 浅色');
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

// ---------- 全屏 ----------
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

// ---------- 侧栏折叠 ----------
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

/* 时段叠加层：全铺伪元素，不覆盖主题背景；内容区 z-index 高于伪元素 */
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
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 56px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--theme-header-text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, transform 0.2s ease;
}

.collapse-btn:hover {
  color: var(--theme-header-text);
  background: rgba(255, 255, 255, 0.06);
}

.logo {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--theme-header-text);
  text-decoration: none;
  cursor: pointer;
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

/* 悬停上移：由 JS 切换 .is-hover-lift，统一在此处写 transform */
.header :deep(.collapse-btn.is-hover-lift),
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

/* 去掉三个下拉触发层的外白内蓝框（Element 默认 hover/focus 样式） */
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

/* 旗帜 emoji 单独一行对齐，避免被裁剪或折行 */
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
/* 非 scoped 兜底：确保 .is-hover-lift 的 transform 不被其它样式覆盖 */
.header .collapse-btn.is-hover-lift,
.header .icon-btn.is-hover-lift,
.header .user-area.is-hover-lift {
  transform: translateY(-2px) !important;
}
</style>