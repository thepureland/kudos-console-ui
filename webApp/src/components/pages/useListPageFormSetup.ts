import { computed, ref, watch } from 'vue';

interface UseListPageFormSetupOptions {
  state: Record<string, unknown>;
  listPage: Record<string, unknown>;
  addHandlerName?: string;
  editHandlerName?: string;
}

/**
 * 列表页 Add/Edit 弹窗状态编排：
 * - 统一维护 formVisible/formRid/hasFormEverOpened/currentFormMode
 * - 统一提供 onFormClose/onFormResponse
 */
export function useListPageFormSetup(options: UseListPageFormSetupOptions) {
  const {
    state,
    listPage,
    addHandlerName = 'afterAdd',
    editHandlerName = 'afterEdit',
  } = options;

  const formVisible = computed(() => !!(state.addDialogVisible || state.editDialogVisible));
  const formRid = computed(() => (state.editDialogVisible ? String(state.rid ?? '') : ''));
  const hasFormEverOpened = ref(false);
  const currentFormMode = ref<'add' | 'edit'>('add');

  watch(formVisible, (v) => { if (v) hasFormEverOpened.value = true; }, { immediate: true });
  watch(() => state.addDialogVisible, (v) => { if (v) currentFormMode.value = 'add'; }, { immediate: true });
  watch(() => state.editDialogVisible, (v) => { if (v) currentFormMode.value = 'edit'; }, { immediate: true });

  function onFormClose(v: boolean): void {
    if (!v) {
      state.addDialogVisible = false;
      state.editDialogVisible = false;
    }
  }

  function onFormResponse(payload: Record<string, unknown>): void {
    const handlerName = currentFormMode.value === 'add' ? addHandlerName : editHandlerName;
    const handler = listPage[handlerName] as ((p: Record<string, unknown>) => void) | undefined;
    if (typeof handler === 'function') {
      handler.call(listPage, payload);
    }
  }

  return {
    formVisible,
    formRid,
    hasFormEverOpened,
    currentFormMode,
    onFormClose,
    onFormResponse,
  };
}
