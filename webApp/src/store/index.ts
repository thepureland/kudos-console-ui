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

/** 与 Sidebar 菜单项一致，用于 store.menuData 与按 path 查找 */
export type MenuItem = {
  index: string;
  title: string;
  titleKey?: string;
  icon?: string;
  children?: MenuItem[];
};

// ---------- 侧栏可拖拽宽度（Home 页分界线左右拉动） ----------
/** 侧栏展开时宽度下限（px） */
const SIDEBAR_WIDTH_MIN = 200;
/** 侧栏展开时宽度上限（px） */
const SIDEBAR_WIDTH_MAX = 480;
/** 侧栏展开时默认宽度（px），与原先固定 280px 一致 */
const SIDEBAR_WIDTH_DEFAULT = 280;

type RootState = {
  /** 是否已登录（与 localStorage token 同步，登录成功后设为 true 以便 App.vue 立即切换为 router-view） */
  isAuthenticated: boolean;
  collapse: boolean;
  /** 侧栏展开时的宽度（px），由 Home 页分界线拖拽调整，持久化到 localStorage */
  sidebarWidth: number;
  tagsList: TagItem[];
  /** 当前菜单页路径（点击菜单时更新，不改变地址栏） */
  currentMenuPath: string;
  /** 关闭标签时记录的 path，下次该页激活时重置列表状态（切换标签不重置） */
  listStateResetPaths: string[];
  /** 菜单数据（由后端接口写入），Sidebar 加载后写入，Tags/Header 按 path 取 titleKey、icon */
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

/** 从 localStorage 读取上次保存的当前菜单路径，刷新后恢复原标签 */
function loadSavedCurrentMenuPath(): string {
  if (typeof localStorage === 'undefined') return '/home';
  const raw = localStorage.getItem(STORAGE_KEYS.currentMenuPath);
  if (!raw || typeof raw !== 'string') return '/home';
  const path = resolvePath(raw.trim());
  return VALID_MENU_PATHS.has(path) ? path : '/home';
}

/** 从 localStorage 读取上次保存的侧栏宽度，不合法或缺失时返回默认值并落在 [MIN, MAX] 内 */
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
    /** 按 path 查找菜单项（path 会 normalize），用于 Tags/Header 取 titleKey、icon */
    getMenuItemByPath:
      (state: RootState) =>
      (path: string): MenuItem | undefined =>
        findMenuItemByPath(state.menuData, path),
  },
  mutations: {
    /** 登录成功后调用，使 App.vue 立即显示 router-view 而非 Login */
    setAuthenticated(state: RootState, value: boolean) {
      state.isAuthenticated = value;
    },
    handleCollapse(state: RootState, collapse: boolean) {
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
      const path = resolvePath(item.path);
      const normalized = { ...item, path };
      const exists = state.tagsList.some((tag) => tag.path === path);
      if (!exists) {
        state.tagsList.unshift(normalized);
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
    setCurrentMenuPath(state, path: string) {
      const resolved = resolvePath(path);
      state.currentMenuPath = resolved;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.currentMenuPath, resolved);
      }
    },
    /** 关闭标签时调用，下次该 path 对应列表页激活时重置状态 */
    addListStateResetPath(state: RootState, path: string) {
      if (!state.listStateResetPaths.includes(path)) {
        state.listStateResetPaths = [...state.listStateResetPaths, path];
      }
    },
    removeListStateResetPath(state: RootState, path: string) {
      state.listStateResetPaths = state.listStateResetPaths.filter((p) => p !== path);
    },
    /** Sidebar 加载菜单后调用（来自后端 getMenus / getAuthorisedMenus 等） */
    setMenuData(state: RootState, list: MenuItem[]) {
      state.menuData = list ?? [];
    },
  },
});

export default store;
