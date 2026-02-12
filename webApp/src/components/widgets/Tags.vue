<template>
  <div class="tags" v-if="showTags">
    <!-- 可见标签 + 更多下拉 + 选项（关其他/关全部）；宽度不足自动「更多」，支持拖拽、双击关闭 -->
    <!-- 隐藏尺子：测量标签与「更多」宽度以计算可见数量 -->
    <div class="tags-ruler" ref="rulerRef" aria-hidden="true">
      <ul class="tags-list tags-ruler-list">
        <li
          v-for="item in tagsList"
          :key="'ruler-' + item.path"
          class="tags-li"
        >
          <span class="tags-li-icon" aria-hidden="true"><span /></span>
          <span class="tags-li-title">{{ tagTitle(item) }}</span>
          <span class="tag-close">×</span>
        </li>
        <li class="tags-li tags-more-trigger">
          <span class="tags-more-btn">{{ t('tags.more') }} (0)<el-icon class="el-icon--right"><ArrowDown /></el-icon></span>
        </li>
      </ul>
    </div>
    <div class="tags-list-wrap" ref="wrapRef">
      <ul
        class="tags-list"
        ref="listRef"
        @dragover.prevent="onDragOverList"
        @drop="onDropList"
      >
        <li
          v-for="(item, index) in visibleTags"
          :key="item.path"
          class="tags-li"
          :class="{
            active: isActive(item.path),
            'tags-li-dragging': dragFromIndex === index,
            'tags-li-drop-before': dragOverIndex === index,
            'tags-li-drop-after': dragOverIndex === index + 1,
          }"
          draggable="true"
          :data-index="index"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="onDragOver($event, index)"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
          @dragleave="onDragLeave"
          @dblclick.stop="closeTags(index)"
        >
          <el-icon class="tags-li-icon"><component :is="tagIcon(item)" /></el-icon>
          <router-link :to="item.path" class="tags-li-title">{{ tagTitle(item) }}</router-link>
          <span class="tag-close" @click.stop="closeTags(index)" aria-label="关闭">×</span>
        </li>
        <li
          v-if="moreTags.length > 0"
          class="tags-li tags-more-trigger"
          @dragover.prevent="onDragOver($event, visibleTags.length)"
          @drop="onDrop($event, visibleTags.length)"
        >
          <el-dropdown trigger="click" @command="goToTag" placement="bottom-start">
            <span class="tags-more-btn">{{ t('tags.more') }} ({{ moreTags.length }})<el-icon class="el-icon--right"><ArrowDown /></el-icon></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="(item, i) in moreTags"
                  :key="item.path"
                  :command="{ item, visibleIndex: maxVisibleCount + i }"
                  class="more-dropdown-item"
                >
                  <span
                    class="more-item-row"
                    :class="{ 'more-item-active': item.path === route.fullPath }"
                  >
                    <el-icon class="more-item-icon"><component :is="tagIcon(item)" /></el-icon>
                    <span class="more-item-title">{{ tagTitle(item) }}</span>
                    <span class="more-item-close" @click.stop="closeTags(maxVisibleCount + i)" aria-label="关闭">×</span>
                  </span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </li>
      </ul>
    </div>
    <div class="tags-close-box">
      <el-dropdown trigger="hover" @command="handleTags">
        <button
          type="button"
          class="tags-options-trigger"
          :title="t('tags.options')"
          aria-label="标签选项"
        >
          <el-icon><CaretBottom /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu size="small">
            <el-dropdown-item command="other">{{ t('tags.closeOther') }}</el-dropdown-item>
            <el-dropdown-item command="all">{{ t('tags.closeAll') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import {
  ArrowDown,
  Bell,
  CaretBottom,
  Coin,
  Collection,
  Document,
  HomeFilled,
  Key,
  Lock,
  OfficeBuilding,
  Setting,
  User,
  UserFilled,
} from '@element-plus/icons-vue';
import type { TagItem } from '../../store/index';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useStore();

// ---------- 可见数量与尺子测量 ----------
const listRef = ref<HTMLElement | null>(null);
const wrapRef = ref<HTMLElement | null>(null);
const rulerRef = ref<HTMLElement | null>(null);
/** 当前最多显示几个标签，超出放入「更多」下拉，由 ResizeObserver + 尺子测量得出 */
const maxVisibleCount = ref(999);

const tagsList = computed(() => store.state.tagsList);
const showTags = computed(() => tagsList.value.length > 0);
const visibleTags = computed(() => tagsList.value.slice(0, maxVisibleCount.value));
const moreTags = computed(() => tagsList.value.slice(maxVisibleCount.value));

const GAP = 6;
const LIST_PADDING_RIGHT = 8;
/** 根据 wrapRef 宽度与尺子中各 li 宽度，计算最大可见标签数（含「更多」占位） */
function measureMaxVisible() {
  const wrap = wrapRef.value;
  const ruler = rulerRef.value;
  const total = tagsList.value.length;
  if (!wrap || !ruler || total === 0) {
    maxVisibleCount.value = total;
    return;
  }
  const ul = ruler.querySelector('.tags-ruler-list') as HTMLUListElement;
  if (!ul || ul.children.length < total + 1) {
    maxVisibleCount.value = total;
    return;
  }
  const availableWidth = wrap.clientWidth - LIST_PADDING_RIGHT;
  const moreIndex = total;
  const moreWidth = (ul.children[moreIndex] as HTMLElement)?.offsetWidth ?? 80;
  for (let n = total; n >= 0; n--) {
    let w = 0;
    for (let i = 0; i < n; i++) w += (ul.children[i] as HTMLElement).offsetWidth + GAP;
    if (n < total) w += moreWidth;
    else if (n > 0) w -= GAP;
    if (w <= availableWidth) {
      maxVisibleCount.value = n;
      return;
    }
  }
  maxVisibleCount.value = 0;
}
function scheduleMeasure() {
  nextTick(() => measureMaxVisible());
}
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  const wrap = wrapRef.value;
  if (!wrap) return;
  resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(wrap);
  scheduleMeasure();
  document.addEventListener('dragend', onDragEnd, true);
});
onUnmounted(() => {
  document.removeEventListener('dragend', onDragEnd, true);
  if (resizeObserver && wrapRef.value) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
watch(tagsList, scheduleMeasure, { deep: true });
watch(() => t('tags.more'), scheduleMeasure);

// ---------- 标签文案与图标（与侧栏菜单一致） ----------
const isActive = (path: string) => path === route.fullPath;
function tagTitle(item: { titleKey?: string; title?: string }) {
  return item.titleKey ? t(item.titleKey) : (item.title ?? '');
}

const tagIconMap: Record<string, unknown> = {
  Bell,
  HomeFilled,
  Setting,
  Coin,
  Collection,
  Document,
  User,
  UserFilled,
  OfficeBuilding,
  Lock,
  Key,
};
/** path → icon 名，用于从 localStorage 恢复的标签无 icon 时回退 */
const pathToIcon: Record<string, string> = {
  '/home': 'HomeFilled',
  '/tabs': 'Bell',
  '/sys/cache': 'Coin',
  '/sys/dict': 'Collection',
  '/sys/param': 'Document',
  '/sys/subsys': 'Document',
  '/sys/microservice': 'Setting',
  '/sys/datasource': 'Collection',
  '/sys/resource': 'Document',
  '/sys/i18n': 'Setting',
  '/user/account': 'UserFilled',
  '/user/organization': 'OfficeBuilding',
  '/rbac/role': 'Key',
  '/rbac/group': 'User',
};
function tagIcon(item: TagItem): unknown {
  const name = item.icon ?? pathToIcon[item.path];
  return name ? tagIconMap[name] ?? Setting : Setting;
}
/** 路由进入/更新时往 store 追加标签，最多 12 个 */
function setTags(r: RouteLocationNormalizedLoaded) {
  const isExist = tagsList.value.some((item) => item.path === r.fullPath);
  if (!isExist) {
    if (tagsList.value.length >= 12) store.commit('delTagsItem', { index: 0 });
    store.commit('setTagsItem', {
      name: r.name,
      titleKey: r.meta?.titleKey as string | undefined,
      icon: r.meta?.icon as string | undefined,
      path: r.fullPath,
    });
  }
}
setTags(route);
/** 监听路由变化：侧栏/链接跳转时 Tags 不是路由组件，onBeforeRouteUpdate 不会触发，故用 watch 同步标签 */
watch(() => route.fullPath, () => setTags(route));

// ---------- 关闭与选项 ----------
function closeTags(index: number) {
  const delItem = tagsList.value[index];
  store.commit('delTagsItem', { index });
  const next = tagsList.value[index] ?? tagsList.value[index - 1];
  if (next) {
    if (delItem.path === route.fullPath) router.push(next.path);
  } else {
    router.push('/');
  }
}
function closeAll() {
  store.commit('clearTags');
  router.push('/');
}
function closeOther() {
  const cur = tagsList.value.filter((item) => item.path === route.fullPath);
  store.commit('closeTagsOther', cur);
}
function handleTags(command: string) {
  command === 'other' ? closeOther() : closeAll();
}
function goToTag(cmd: { item: TagItem; visibleIndex: number }) {
  router.push(cmd.item.path);
}

// ---------- 拖拽排序 ----------
const dragFromIndex = ref<number | null>(null);
/** 当前悬停的插入位置索引（0 = 最前，visibleTags.length = 最后） */
const dragOverIndex = ref<number | null>(null);
function onDragStart(e: DragEvent, index: number) {
  dragFromIndex.value = index;
  dragOverIndex.value = null;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', String(index));
  if (e.target instanceof HTMLElement) e.target.classList.add('tags-li-dragging');
}
function onDragOver(e: DragEvent, index: number) {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  dragOverIndex.value = index;
}
function onDragLeave() {
  dragOverIndex.value = null;
}
function doDrop(from: number, toIndex: number) {
  if (from === toIndex) return;
  store.commit('reorderTags', { fromIndex: from, toIndex });
}
function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault();
  e.stopPropagation();
  const from = dragFromIndex.value;
  if (from === null) return;
  doDrop(from, toIndex);
  dragOverIndex.value = null;
}
/** 列表容器上的 drop：用最后一次 dragover 的索引，避免在标签间隙松开时放不下 */
function onDropList(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  const from = dragFromIndex.value;
  if (from === null) return;
  const toIndex = dragOverIndex.value ?? from;
  doDrop(from, toIndex);
  dragOverIndex.value = null;
}
function onDragOverList(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  if (dragOverIndex.value === null && dragFromIndex.value !== null) {
    dragOverIndex.value = visibleTags.value.length;
  }
}
function onDragEnd() {
  dragFromIndex.value = null;
  dragOverIndex.value = null;
  if (listRef.value) {
    listRef.value.querySelectorAll('.tags-li-dragging').forEach((el) => el.classList.remove('tags-li-dragging'));
  }
}
</script>

<style scoped>
.tags {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  height: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  background: var(--theme-bg-tags);
  padding-right: 52px; /* 为右侧选项图标区留空 */
  box-shadow: var(--theme-shadow-tags);
  isolation: isolate;
}

/* 隐藏尺子：用于测量标签与「更多」宽度，不参与视觉布局 */
.tags-ruler {
  position: absolute;
  left: -9999px;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  width: max-content;
}

.tags-ruler .tags-ruler-list {
  padding: 0 8px 0 0;
}

.tags-list-wrap {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.tags-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  height: 100%;
  margin: 0;
  padding: 0 8px 0 0;
  list-style: none;
}

.tags-li {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  height: 26px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--theme-border);
  background: var(--theme-bg-tag);
  color: var(--theme-text-muted);
  transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.2s, box-shadow 0.2s;
  user-select: none;
}

.tags-li[draggable='true'] {
  cursor: pointer;
}

.tags-li:active[draggable='true'] {
  cursor: pointer;
}

.tags-li.tags-li-dragging {
  opacity: 0.85;
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-style: dashed;
  border-color: var(--theme-accent);
  z-index: 10;
  position: relative;
}

/* 放下位置指示：在标签左侧/右侧显示竖线，不插入 DOM 避免布局抖动 */
.tags-li-drop-before::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  background: var(--theme-accent);
  border-radius: 2px;
  animation: tags-drop-pulse 0.6s ease-in-out infinite;
  pointer-events: none;
}

.tags-li-drop-after::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  background: var(--theme-accent);
  border-radius: 2px;
  animation: tags-drop-pulse 0.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes tags-drop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

.tags-li-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  font-size: 14px;
  color: inherit;
  opacity: 0.9;
}

.tags-li-icon :deep(.el-icon) {
  font-size: inherit;
}

/* 尺子中占位与真实图标同宽 */
.tags-ruler .tags-li-icon {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tags-ruler .tags-li-icon span {
  display: block;
  width: 14px;
  height: 14px;
}

.tags-li:not(.active):hover {
  background: var(--theme-bg-card-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  animation: tag-hover-flash 0.45s ease-out;
}

@keyframes tag-hover-flash {
  0% { background: var(--theme-bg-card-hover); }
  35% { background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-bg-card-hover)); }
  100% { background: var(--theme-bg-card-hover); }
}

.tags-li.active {
  color: #fff;
  background: var(--theme-bg-tag-active);
  border-color: var(--theme-bg-tag-active);
}

.tags-li-title {
  max-width: 88px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
  text-decoration: none;
}

/* 视觉仍为 14×14，向右和上下扩大可点区域，不改变标签宽度、不侵入标题区 */
.tag-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin: -4px -8px -4px 2px;
  padding: 4px 8px 4px 0;
  box-sizing: content-box;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s;
  cursor: pointer;
}

.tag-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.tags-li.active .tag-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tags-li.active .tags-li-title {
  color: #fff;
}

.tags-li.active span {
  color: #fff;
  opacity: 0.9;
}

.tags-more-trigger {
  cursor: default;
  padding-left: 10px; /* 与 .tags-li 一致 */
  padding-right: 6px;
}

.tags-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 2px;
  font-size: 12px;
  color: var(--theme-text-muted);
  cursor: pointer;
}

.tags-more-btn:hover {
  color: var(--theme-accent);
}

.tags-close-box {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 36px;
  padding: 0 6px;
  background: var(--theme-bg-tags);
  /* 左侧用轻微内阴影过渡，替代生硬竖线 */
  box-shadow: inset 8px 0 10px -6px rgba(0, 0, 0, 0.06);
  z-index: 10;
}

.tags-options-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  background: var(--theme-bg-tag);
  color: var(--theme-text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}

.tags-options-trigger:hover {
  color: var(--theme-accent);
  background: var(--theme-bg-card-hover);
  border-color: var(--theme-accent);
}

.tags-options-trigger .el-icon {
  font-size: 16px;
}

/* 「更多」下拉项：圆角矩形框，样式与标签栏一致（下拉可能 teleport 到 body，用 :deep 确保生效） */
:deep(.more-dropdown-item) {
  padding: 4px 8px;
}

.more-dropdown-item .more-item-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 100px;
  max-width: 160px;
  height: 26px;
  padding: 0 8px 0 10px;
  border-radius: 6px;
  border: 1px solid var(--theme-border);
  background: var(--theme-bg-tag);
  color: var(--theme-text-muted);
  font-size: 12px;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.more-dropdown-item .more-item-row:hover {
  background: var(--theme-bg-card-hover);
}

.more-dropdown-item .more-item-row.more-item-active {
  color: #fff;
  background: var(--theme-bg-tag-active);
  border-color: var(--theme-bg-tag-active);
}

.more-dropdown-item .more-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  font-size: 14px;
  color: inherit;
  opacity: 0.9;
}

.more-dropdown-item .more-item-icon :deep(.el-icon) {
  font-size: inherit;
}

.more-dropdown-item .more-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-dropdown-item .more-item-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 2px;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s;
  cursor: pointer;
}

.more-dropdown-item .more-item-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.more-dropdown-item .more-item-row.more-item-active .more-item-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
