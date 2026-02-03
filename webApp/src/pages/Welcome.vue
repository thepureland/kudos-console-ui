<template>
  <div class="welcome">
    <section class="hero" :class="heroTimeClass">
      <p class="greeting">{{ greeting }}，{{ displayName }}</p>
      <p class="hero-date">{{ dateText }}</p>
      <h1 class="title">{{ t('welcome.title') }}</h1>
      <p class="subtitle">{{ t('welcome.subtitle') }}</p>
    </section>

    <section class="shortcuts">
      <h2 class="section-title">{{ t('welcome.shortcuts') }}</h2>
      <div class="cards">
        <router-link
          v-for="(item, index) in shortcutItems"
          :key="item.path"
          :to="item.path"
          class="card"
          active-class="card--active"
          :style="{ animationDelay: `${index * 0.06}s` }"
        >
          <div class="card-icon">
            <el-icon :size="28"><component :is="item.icon" /></el-icon>
          </div>
          <span class="card-title">{{ t(item.titleKey) }}</span>
          <span class="card-desc">{{ t(item.descKey) }}</span>
        </router-link>
      </div>
    </section>

    <section class="tips">
      <el-icon class="tips-icon"><InfoFilled /></el-icon>
      <span>{{ t('welcome.tips') }}</span>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Setting,
  User,
  Lock,
  HomeFilled,
  InfoFilled,
} from '@element-plus/icons-vue';

const { t, locale } = useI18n();

/** 问候语 + 用户名（无登录名时用「访客」） */
const displayName = computed(() => {
  const name = typeof localStorage !== 'undefined' ? localStorage.getItem('current_username') : null;
  return name?.trim() || t('welcome.guest');
});
const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 12) return t('welcome.greetingMorning');
  if (h < 18) return t('welcome.greetingAfternoon');
  return t('welcome.greetingEvening');
});

/** 当前日期 + 星期，随语言格式化 */
const dateText = computed(() => {
  const d = new Date();
  const localeCode = locale.value as string;
  const date = d.toLocaleDateString(localeCode, { year: 'numeric', month: 'long', day: 'numeric' });
  const week = d.toLocaleDateString(localeCode, { weekday: 'long' });
  return `${date} · ${week}`;
});

/** 根据时段给 hero 加 class，在样式中定义渐变（保证生效且可见） */
const heroTimeClass = computed(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'hero--time-morning';
  if (h >= 11 && h < 17) return 'hero--time-afternoon';
  if (h >= 17 && h < 21) return 'hero--time-evening';
  return 'hero--time-night';
});

const shortcutItems = [
  { path: '/home', titleKey: 'welcome.home', descKey: 'welcome.homeDesc', icon: HomeFilled },
  { path: '/sys/cache', titleKey: 'welcome.cache', descKey: 'welcome.cacheDesc', icon: Setting },
  { path: '/user/account', titleKey: 'welcome.account', descKey: 'welcome.accountDesc', icon: User },
  { path: '/rbac/role', titleKey: 'welcome.role', descKey: 'welcome.roleDesc', icon: Lock },
];
</script>

<style scoped>
.welcome {
  min-height: 100%;
  padding: 24px;
  background: var(--theme-bg-page);
}

.hero {
  margin-bottom: 32px;
  padding: 28px 24px;
  background: var(--theme-bg-card);
  border-radius: 12px;
  box-shadow: var(--theme-shadow);
}

/* 按时段叠加很轻的渐变（左上→右下），傍晚偏暖 */
.hero.hero--time-morning {
  background: linear-gradient(160deg, var(--theme-bg-card) 0%, #e8f4fc 100%);
}
.hero.hero--time-afternoon {
  background: linear-gradient(160deg, var(--theme-bg-card) 0%, #f8faf8 100%);
}
.hero.hero--time-evening {
  background: linear-gradient(160deg, var(--theme-bg-card) 0%, #fef8f0 100%);
}
.hero.hero--time-night {
  background: linear-gradient(160deg, var(--theme-bg-card) 0%, #f0f2f8 100%);
}

.greeting {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--theme-text-muted);
}

.hero-date {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--theme-text-muted);
  opacity: 0.9;
}

.title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: var(--theme-text);
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--theme-text-muted);
}

.section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-text-muted);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px;
  background: var(--theme-bg-card);
  border-radius: 12px;
  border: 1px solid var(--theme-border-card);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  animation: welcome-card-in 0.4s ease-out backwards;
}

@keyframes welcome-card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: var(--theme-accent);
}

.card--active {
  border-color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent) 0.2, transparent);
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: var(--theme-bg-tag);
  color: var(--theme-text-muted);
  transition: background 0.2s, color 0.2s;
}

.card:hover .card-icon,
.card--active .card-icon {
  background: var(--theme-accent);
  color: #fff;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--theme-text);
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: var(--theme-text-muted);
}

.tips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 28px;
  padding: 12px 16px;
  background: var(--theme-bg-card);
  border-radius: 8px;
  border: 1px solid var(--theme-border);
  font-size: 13px;
  color: var(--theme-text-muted);
}

.tips-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--theme-accent);
}
</style>
