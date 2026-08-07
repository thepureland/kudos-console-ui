<!--
 * Open-page tags and route icon fallbacks.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 -->
<template>
  <div class="tags" v-if="showTags">
    <!-- Visible tags + "more" dropdown + options (close others/close all); auto "more" when width is insufficient, supports drag and double-click to close -->
    <!-- Hidden ruler: measures tag and "more" widths to compute the visible count -->
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
          <span class="tags-more-btn">{{ t('tags.more') }} (0)<el-icon class="el-icon--right"><component :is="tagIconMap['ArrowDown']" /></el-icon></span>
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
          @click="goToPath(item.path)"
        >
          <el-icon class="tags-li-icon"><component :is="tagIcon(item)" /></el-icon>
          <span class="tags-li-title">{{ tagTitle(item) }}</span>
          <span class="tag-close" @click.stop="closeTags(index)" aria-label="Close">×</span>
        </li>
        <li
          v-if="moreTags.length > 0"
          class="tags-li tags-more-trigger"
          @dragover.prevent="onDragOver($event, visibleTags.length)"
          @drop="onDrop($event, visibleTags.length)"
        >
          <el-dropdown trigger="click" @command="goToTag" placement="bottom-start">
            <span class="tags-more-btn">{{ t('tags.more') }} ({{ moreTags.length }})<el-icon class="el-icon--right"><component :is="tagIconMap['ArrowDown']" /></el-icon></span>
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
                    :class="{ 'more-item-active': resolvePath(item.path) === currentMenuPath }"
                  >
                    <el-icon class="more-item-icon"><component :is="tagIcon(item)" /></el-icon>
                    <span class="more-item-title">{{ tagTitle(item) }}</span>
                    <span class="more-item-close" @click.stop="closeTags(maxVisibleCount + i)" aria-label="Close">×</span>
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
          aria-label="Tag options"
        >
          <el-icon><component :is="tagIconMap['CaretBottom']" /></el-icon>
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
import { computed, markRaw, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import type { TagItem } from '../../store/index';
import { resolvePath } from '../../config/menuPathToComponent';

const { t, te } = useI18n();
const store = useStore();
const currentMenuPath = computed(() => store.state.currentMenuPath);

// ---------- Visible count and ruler measurement ----------
const listRef = ref<HTMLElement | null>(null);
const wrapRef = ref<HTMLElement | null>(null);
const rulerRef = ref<HTMLElement | null>(null);
/** Current maximum visible tag count; overflow goes into the "more" dropdown. Computed by ResizeObserver + ruler measurement */
const maxVisibleCount = ref(999);

const tagsList = computed(() => store.state.tagsList);
const showTags = computed(() => tagsList.value.length > 0);
const visibleTags = computed(() => tagsList.value.slice(0, maxVisibleCount.value));
const moreTags = computed(() => tagsList.value.slice(maxVisibleCount.value));

const GAP = 6;
const LIST_PADDING_RIGHT = 8;
/** Compute the maximum visible tag count (including the "more" placeholder) from wrapRef's width and each li's width in the ruler */
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
  const moreWidth = (ul.children[total] as HTMLElement)?.offsetWidth ?? 80;

  // Pre-compute prefix widths (including per-item gap) so the search below is O(n) instead of O(n²).
  // prefixW[i] = total rendered width of the first i tags (with gaps between them, no trailing gap).
  const prefixW: number[] = new Array(total + 1);
  prefixW[0] = 0;
  for (let i = 0; i < total; i++) {
    const itemW = (ul.children[i] as HTMLElement).offsetWidth;
    prefixW[i + 1] = prefixW[i] + itemW + (i > 0 ? GAP : 0);
  }

  // Find the largest n such that showing n tags (+ "more" button when n < total) fits in availableWidth.
  for (let n = total; n >= 0; n--) {
    // Width of n visible tags: prefix sum already includes gaps between items.
    // When showing all tags (n === total) no "more" button is needed; otherwise add moreWidth + gap.
    const w = n === total
      ? prefixW[n]
      : prefixW[n] + (n > 0 ? GAP : 0) + moreWidth;
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
  // disconnect() does not require the observed element to still be in the DOM.
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
watch(tagsList, scheduleMeasure, { deep: true });
watch(() => t('tags.more'), scheduleMeasure);

// ---------- Tag labels and icons (matching the sidebar menu) ----------
const isActive = (path: string) => resolvePath(path) === currentMenuPath.value;
/** Menu/route label: use t(titleKey) when titleKey exists and the current locale has a translation, otherwise fall back to title (avoids errors when the backend menu key hasn't been fetched yet) */
function tagTitle(item: { titleKey?: string; title?: string }) {
  if (item.titleKey && te(item.titleKey)) return t(item.titleKey);
  return item.title ?? item.titleKey ?? '';
}

/** Full icon-name -> component map; matches the Sidebar and supports any icon name the backend specifies */
const tagIconMap: Record<string, unknown> = {};
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  tagIconMap[key] = markRaw(component);
}
/** path -> icon name, used as a fallback when tags restored from localStorage have no icon */
const pathToIcon: Record<string, string> = {
  '/home': 'HomeFilled',
  '/tabs': 'Bell',
  '/sys/cache': 'Coin',
  '/sys/dict': 'Collection',
  '/sys/param': 'Document',
  '/sys/domain': 'Document',
  '/sys/tenant': 'Document',
  '/sys/subsys': 'Document',
  '/sys/microservice': 'Setting',
  '/sys/datasource': 'Collection',
  '/sys/resource': 'Document',
  '/sys/i18n': 'Setting',
  '/user/account': 'UserFilled',
  '/user/organization': 'OfficeBuilding',
  '/auth/role': 'Key',
  '/auth/group': 'User',
  '/auth/roleexclusion': 'CircleClose',
  '/auth/menupermission': 'Menu',
  '/auth/resourcepermission': 'List',
  '/auth/grantrequest': 'DocumentChecked',
  '/auth/instancegrant': 'Share',
  '/auth/rowscope': 'Filter',
};

/** When a tag is closed, clear that page's list query state so "close and reopen" returns to the initial state; switching tags does not close them, so their state is preserved */
const PERSISTED_STATE_KEYS_BY_PATH: Record<string, string[]> = {
  '/sys/cache': ['cacheList.queryState'],
  '/sys/dict': ['dictList.queryState'],
  '/sys/param': ['paramList.queryState'],
  '/sys/domain': ['domainList.queryState'],
  '/sys/tenant': ['tenantList.queryState'],
  '/sys/datasource': ['dataSourceList.queryState.v2'],
  '/sys/resource': ['resourceList.queryState'],
  '/user/account': ['accountList.queryState'],
};

function clearPersistedStateByPath(path: string) {
  const keys = PERSISTED_STATE_KEYS_BY_PATH[path];
  if (!keys || keys.length === 0 || typeof localStorage === 'undefined') return;
  keys.forEach((key) => localStorage.removeItem(key));
}
function tagIcon(item: TagItem): unknown {
  const name = item.icon ?? pathToIcon[item.path];
  return name ? tagIconMap[name] ?? tagIconMap.Setting : tagIconMap.Setting;
}
/** Append a tag when the current menu path changes (only if the path exists in the menu; titleKey/icon come from the backend or mock) */
function setTagsForPath(path: string) {
  if (!path) return;
  const isExist = tagsList.value.some((item) => item.path === path);
  if (!isExist) {
    const item = (store.getters.getMenuItemByPath as (path: string) => { titleKey?: string; icon?: string } | undefined)(path);
    if (item) {
      store.commit('setTagsItem', {
        titleKey: item.titleKey,
        icon: item.icon,
        path,
      });
    }
  }
}
watch(currentMenuPath, setTagsForPath, { immediate: true });
/** After the menu finishes loading, add a tag for the current path (e.g. when currentMenuPath is restored after a refresh) */
watch(() => store.state.menuData.length, () => setTagsForPath(currentMenuPath.value));

// ---------- Close and options ----------
function closeTags(index: number) {
  const delItem = tagsList.value[index];
  if (delItem?.path) {
    clearPersistedStateByPath(delItem.path);
    store.commit('addListStateResetPath', delItem.path);
  }
  // Vuex mutations are synchronous; tagsList updates immediately after the commit.
  store.commit('delTagsItem', { index });
  // After removal, prefer the tag now at the same index (i.e. the next one); fall back to the previous.
  const next = tagsList.value[index] ?? tagsList.value[index - 1];
  if (next) {
    if (delItem.path === currentMenuPath.value) store.commit('setCurrentMenuPath', next.path);
  } else {
    store.commit('setCurrentMenuPath', '/home');
  }
}
function closeAll() {
  tagsList.value.forEach((item) => {
    clearPersistedStateByPath(item.path);
    store.commit('addListStateResetPath', item.path);
  });
  store.commit('clearTags');
  store.commit('setCurrentMenuPath', '/home');
}
function closeOther() {
  const curPath = currentMenuPath.value;
  tagsList.value.forEach((item) => {
    if (item.path !== curPath) {
      clearPersistedStateByPath(item.path);
      store.commit('addListStateResetPath', item.path);
    }
  });
  const cur = tagsList.value.filter((item) => item.path === curPath);
  store.commit('closeTagsOther', cur);
}
function handleTags(command: string) {
  command === 'other' ? closeOther() : closeAll();
}
function goToTag(cmd: { item: TagItem; visibleIndex: number }) {
  // Promote the selected "more" item to position 0 so it becomes immediately visible in the tag bar.
  if (cmd.visibleIndex > 0) {
    store.commit('reorderTags', { fromIndex: cmd.visibleIndex, toIndex: 0 });
  }
  store.commit('setCurrentMenuPath', cmd.item.path);
}
function goToPath(path: string) {
  if (currentMenuPath.value === path) return;
  store.commit('setCurrentMenuPath', path);
}

// ---------- Drag and reorder ----------
const dragFromIndex = ref<number | null>(null);
/** Index of the current hover insertion point (0 = front, visibleTags.length = end) */
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
/** Drop on the list container: use the index from the last dragover so dropping between tags still lands somewhere */
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
  padding-left: 7px; /* Leave a small gap from the left sidebar */
  padding-right: 52px; /* Reserve space for the options icon area on the right */
  box-shadow: var(--theme-shadow-tags);
  isolation: isolate;
}

/* Hidden ruler: used to measure tag and "more" widths, takes no part in visual layout */
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

/* Drop position indicator: shows a vertical bar to the left/right of the tag without inserting DOM, to avoid layout jitter */
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

/* Ruler placeholder uses the same width as the real icon */
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

/* Stays visually 14x14 but expands the clickable area to the right and vertically, without changing the tag width or encroaching on the title area */
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
  padding-left: 10px; /* Matches .tags-li */
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
  /* Use a subtle inner shadow on the left as a transition, instead of a hard vertical line */
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

/* "More" dropdown items: rounded-rectangle box matching the tag-bar style (the dropdown may be teleported to body, so :deep is needed for the rules to apply) */
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
