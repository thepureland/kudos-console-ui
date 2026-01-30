import { createStore } from 'vuex';

type TagItem = {
  name?: string;
  title?: string;
  path: string;
};

type RootState = {
  collapse: boolean;
  tagsList: TagItem[];
};

const store = createStore<RootState>({
  state: {
    collapse: false,
    tagsList: [],
  },
  mutations: {
    handleCollapse(state, collapse: boolean) {
      state.collapse = collapse;
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
  },
});

export default store;
