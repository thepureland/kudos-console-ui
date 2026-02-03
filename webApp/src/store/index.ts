import { createStore } from 'vuex';

export type TagItem = {
  name?: string;
  title?: string;
  /** i18n key for title (used when switching language) */
  titleKey?: string;
  /** icon name for menu (e.g. HomeFilled, Setting) */
  icon?: string;
  path: string;
};

// ---------- 侧栏可拖拽宽度（Home 页分界线左右拉动） ----------
/** 侧栏展开时宽度下限（px） */
const SIDEBAR_WIDTH_MIN = 200;
/** 侧栏展开时宽度上限（px） */
const SIDEBAR_WIDTH_MAX = 480;
/** 侧栏展开时默认宽度（px），与原先固定 280px 一致 */
const SIDEBAR_WIDTH_DEFAULT = 280;

type RootState = {
  collapse: boolean;
  /** 侧栏展开时的宽度（px），由 Home 页分界线拖拽调整，持久化到 localStorage */
  sidebarWidth: number;
  tagsList: TagItem[];
};

const STORAGE_KEYS = {
  collapse: 'sidebar_collapse',
  sidebarWidth: 'sidebar_width',
  tagsList: 'tags_list',
} as const;

function loadSavedTags(): TagItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tagsList);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is TagItem => t && typeof t === 'object' && typeof (t as TagItem).path === 'string');
  } catch {
    return [];
  }
}

function saveTagsList(list: TagItem[]) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.tagsList, JSON.stringify(list));
  }
}

const savedCollapse =
  typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.collapse) === 'true';

/** 从 localStorage 读取上次保存的侧栏宽度，不合法或缺失时返回默认值并落在 [MIN, MAX] 内 */
function loadSavedSidebarWidth(): number {
  if (typeof localStorage === 'undefined') return SIDEBAR_WIDTH_DEFAULT;
  const raw = localStorage.getItem(STORAGE_KEYS.sidebarWidth);
  if (raw == null) return SIDEBAR_WIDTH_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(n)));
}

const store = createStore<RootState>({
  state: {
    collapse: savedCollapse,
    sidebarWidth: loadSavedSidebarWidth(),
    tagsList: loadSavedTags(),
  },
  mutations: {
    handleCollapse(state, collapse: boolean) {
      state.collapse = collapse;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.collapse, String(collapse));
      }
    },
    /** 设置侧栏展开宽度（由 Home 页分界线拖拽调用），会钳制到 [SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX] 并持久化 */
    setSidebarWidth(state, width: number) {
      const w = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(width)));
      state.sidebarWidth = w;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(w));
      }
    },
    setTagsItem(state, item: TagItem) {
      const exists = state.tagsList.some((tag) => tag.path === item.path);
      if (!exists) {
        state.tagsList.push(item);
        saveTagsList(state.tagsList);
      }
    },
    delTagsItem(state, payload: { index: number }) {
      state.tagsList.splice(payload.index, 1);
      saveTagsList(state.tagsList);
    },
    clearTags(state) {
      state.tagsList = [];
      saveTagsList(state.tagsList);
    },
    closeTagsOther(state, curItems: TagItem[]) {
      if (curItems && curItems.length > 0) {
        const current = curItems[0];
        state.tagsList = state.tagsList.filter((tag) => tag.path === current.path);
        saveTagsList(state.tagsList);
      }
    },
    reorderTags(state, payload: { fromIndex: number; toIndex: number }) {
      const { fromIndex, toIndex } = payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      const list = state.tagsList;
      if (fromIndex >= list.length || toIndex >= list.length) return;
      const [item] = list.splice(fromIndex, 1);
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      list.splice(insertIndex, 0, item);
      saveTagsList(state.tagsList);
    },
  },
});

export default store;
