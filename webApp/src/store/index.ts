import { createStore } from 'vuex';
import { AuthApiFactory } from 'shared';
import { resolvePath, VALID_MENU_PATHS } from '../config/menuPathToComponent';

export type TagItem = {
  name?: string;
  title?: string;
  /** i18n key for title (used when switching language) */
  titleKey?: string;
  /** icon name for menu (e.g. HomeFilled, Setting) */
  icon?: string;
  path: string;
};

/** Mirrors Sidebar menu items; used by `store.menuData` and for lookup by path. */
export type MenuItem = {
  index: string;
  title: string;
  titleKey?: string;
  icon?: string;
  children?: MenuItem[];
};

// ---------- Draggable sidebar width (Home page splitter drag left/right) ----------
/** Minimum sidebar width when expanded (px). */
const SIDEBAR_WIDTH_MIN = 200;
/** Maximum sidebar width when expanded (px). */
const SIDEBAR_WIDTH_MAX = 480;
/** Default sidebar width when expanded (px); matches the previous fixed 280px. */
const SIDEBAR_WIDTH_DEFAULT = 280;

export type RootState = {
  /** Whether the user is logged in (kept in sync with the localStorage token; set to true after a successful login so App.vue can immediately switch to router-view). */
  isAuthenticated: boolean;
  collapse: boolean;
  /** Sidebar width when expanded (px), adjusted by dragging the Home page splitter and persisted to localStorage. */
  sidebarWidth: number;
  tagsList: TagItem[];
  /** Current menu page path (updated when a menu item is clicked; does not change the URL). */
  currentMenuPath: string;
  /** Paths recorded when a tag is closed; the next time the page activates, its list state is reset (not reset on tab switching). */
  listStateResetPaths: string[];
  /** Menu data (populated from a backend API); written by Sidebar after loading, then read by Tags/Header to look up titleKey/icon by path. */
  menuData: MenuItem[];
};

const STORAGE_KEYS = {
  collapse: 'sidebar_collapse',
  sidebarWidth: 'sidebar_width',
  tagsList: 'tags_list',
  currentMenuPath: 'current_menu_path',
} as const;

function loadSavedTags(): TagItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tagsList);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t): t is TagItem => t && typeof t === 'object' && typeof (t as TagItem).path === 'string')
      .map((t) => ({ ...t, path: resolvePath(t.path) }));
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

/** Read the previously saved current menu path from localStorage to restore the original tag after a refresh. */
function loadSavedCurrentMenuPath(): string {
  if (typeof localStorage === 'undefined') return '/home';
  const raw = localStorage.getItem(STORAGE_KEYS.currentMenuPath);
  if (!raw || typeof raw !== 'string') return '/home';
  const path = resolvePath(raw.trim());
  return VALID_MENU_PATHS.has(path) ? path : '/home';
}

/** Read the previously saved sidebar width from localStorage; if missing or invalid, return the default value clamped to [MIN, MAX]. */
function loadSavedSidebarWidth(): number {
  if (typeof localStorage === 'undefined') return SIDEBAR_WIDTH_DEFAULT;
  const raw = localStorage.getItem(STORAGE_KEYS.sidebarWidth);
  if (raw == null) return SIDEBAR_WIDTH_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(n)));
}

function findMenuItemByPath(items: MenuItem[], targetPath: string): MenuItem | undefined {
  const norm = resolvePath(targetPath);
  for (const it of items) {
    if (resolvePath(it.index) === norm) return it;
    if (it.children?.length) {
      const found = findMenuItemByPath(it.children, targetPath);
      if (found) return found;
    }
  }
  return undefined;
}

const store = createStore<RootState>({
  state: {
    isAuthenticated: AuthApiFactory.getInstance().hasToken(),
    collapse: savedCollapse,
    sidebarWidth: loadSavedSidebarWidth(),
    tagsList: loadSavedTags(),
    currentMenuPath: loadSavedCurrentMenuPath(),
    listStateResetPaths: [],
    menuData: [],
  },
  getters: {
    /** Look up a menu item by path (path is normalized); used by Tags/Header to retrieve titleKey and icon. */
    getMenuItemByPath:
      (state: RootState) =>
      (path: string): MenuItem | undefined =>
        findMenuItemByPath(state.menuData, path),
  },
  mutations: {
    /** Called after a successful login so App.vue immediately renders router-view instead of Login. */
    setAuthenticated(state: RootState, value: boolean) {
      state.isAuthenticated = value;
    },
    /** Toggle sidebar collapsed state and persist the new value to localStorage. */
    handleCollapse(state: RootState, collapse: boolean) {
      state.collapse = collapse;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.collapse, String(collapse));
      }
    },
    /** Set the expanded sidebar width (called by the Home page splitter drag); clamps to [SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX] and persists. */
    setSidebarWidth(state: RootState, width: number) {
      const w = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, Math.round(width)));
      state.sidebarWidth = w;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(w));
      }
    },
    /** Add a tag to the front of the list if it is not already present (deduplicates by resolved path). */
    setTagsItem(state: RootState, item: TagItem) {
      const path = resolvePath(item.path);
      const normalized = { ...item, path };
      const exists = state.tagsList.some((tag) => tag.path === path);
      if (!exists) {
        state.tagsList.unshift(normalized);
        saveTagsList(state.tagsList);
      }
    },
    /** Remove the tag at the given list index and persist the updated list. */
    delTagsItem(state: RootState, payload: { index: number }) {
      state.tagsList.splice(payload.index, 1);
      saveTagsList(state.tagsList);
    },
    clearTags(state: RootState) {
      state.tagsList = [];
      saveTagsList(state.tagsList);
    },
    /** Close all tags except the first item in `curItems`; used by the "Close Other Tabs" context-menu action. */
    closeTagsOther(state: RootState, curItems: TagItem[]) {
      if (curItems && curItems.length > 0) {
        const current = curItems[0];
        state.tagsList = state.tagsList.filter((tag) => tag.path === current.path);
        saveTagsList(state.tagsList);
      }
    },
    /** Move a tag from `fromIndex` to `toIndex` (drag-to-reorder). Mutates the list in place and persists. */
    reorderTags(state: RootState, payload: { fromIndex: number; toIndex: number }) {
      const { fromIndex, toIndex } = payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      const list = state.tagsList;
      if (fromIndex >= list.length || toIndex >= list.length) return;
      const [item] = list.splice(fromIndex, 1);
      // After splice removes the item, all indices after `fromIndex` shift left by one,
      // so when moving forward (fromIndex < toIndex) the effective target is toIndex - 1.
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      list.splice(insertIndex, 0, item);
      saveTagsList(state.tagsList);
    },
    setCurrentMenuPath(state: RootState, path: string) {
      const resolved = resolvePath(path);
      state.currentMenuPath = resolved;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.currentMenuPath, resolved);
      }
    },
    /** Called when a tag is closed; the next time the list page for this path activates, its state is reset. */
    addListStateResetPath(state: RootState, path: string) {
      if (!state.listStateResetPaths.includes(path)) {
        state.listStateResetPaths = [...state.listStateResetPaths, path];
      }
    },
    removeListStateResetPath(state: RootState, path: string) {
      state.listStateResetPaths = state.listStateResetPaths.filter((p) => p !== path);
    },
    /** Called after Sidebar loads menus (from backend getMenus / getAuthorisedMenus, etc.). */
    setMenuData(state: RootState, list: MenuItem[]) {
      state.menuData = list ?? [];
    },
  },
});

export default store;
