import { createStore } from 'vuex';

export type TagItem = {
  name?: string;
  title?: string;
  /** i18n key for title (used when switching language) */
  titleKey?: string;
  path: string;
};

type RootState = {
  collapse: boolean;
  tagsList: TagItem[];
};

const savedCollapse =
  typeof localStorage !== 'undefined' && localStorage.getItem('sidebar_collapse') === 'true';

const store = createStore<RootState>({
  state: {
    collapse: savedCollapse,
    tagsList: [],
  },
  mutations: {
    handleCollapse(state, collapse: boolean) {
      state.collapse = collapse;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebar_collapse', String(collapse));
      }
    },
    setTagsItem(state, item: TagItem) {
      const exists = state.tagsList.some((tag) => tag.path === item.path);
      if (!exists) {
        state.tagsList.push(item);
      }
    },
    delTagsItem(state, payload: { index: number }) {
      state.tagsList.splice(payload.index, 1);
    },
    clearTags(state) {
      state.tagsList = [];
    },
    closeTagsOther(state, curItems: TagItem[]) {
      if (curItems && curItems.length > 0) {
        const current = curItems[0];
        state.tagsList = state.tagsList.filter((tag) => tag.path === current.path);
      }
    },
    reorderTags(state, payload: { fromIndex: number; toIndex: number }) {
      const { fromIndex, toIndex } = payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      const list = state.tagsList;
      if (fromIndex >= list.length || toIndex >= list.length) return;
      const [item] = list.splice(fromIndex, 1);
      // 移除后若目标在原位置之后，插入索引需减 1
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      list.splice(insertIndex, 0, item);
    },
  },
});

export default store;
