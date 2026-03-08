import { computed, inject, reactive, ref, toRefs, watch, nextTick, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BaseAddEditPage } from './BaseAddEditPage';
import { useAddEditDialogCloseGuard } from './useAddEditDialogCloseGuard';

/** 列表页 provide 此 key（值为 Ref<Set<string>>），AddEdit 注入后作为校验 i18n 的列表页级缓存，避免多次打开弹窗重复请求 */
export const ValidationI18nCacheKey = Symbol('ValidationI18nCache');

export interface UseAddEditDialogSetupOptions {
  /** 创建页面实例的工厂（如 () => new CacheAddEditPage(props, context)） */
  createPage: (props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) => BaseAddEditPage;
  /** i18n 文案前缀，如 'cacheAddEdit'，需包含 titleAdd、titleEdit、closeConfirm、buttons 等 */
  i18nKeyPrefix: string;
  /** 新增模式下无快照时，根据是否有填写内容判断为 dirty */
  formHasContent: (model: Record<string, unknown>) => boolean;
}

/**
 * 添加/编辑弹窗通用 setup 逻辑：创建 page、watch rid/visible、关闭守卫、handleSubmit、return 模板所需 refs。
 * 与 useAddEditDialogCloseGuard 配合，供 CacheAddEdit、ParamAddEdit 等复用。
 */
export function useAddEditDialogSetup(
  props: Record<string, unknown>,
  context: { emit: (event: string, ...args: unknown[]) => void },
  options: UseAddEditDialogSetupOptions
) {
  const { createPage, i18nKeyPrefix, formHasContent } = options;
  const { t } = useI18n();
  const validationI18nCache = inject<Ref<Set<string>>>(ValidationI18nCacheKey, () => ref(new Set()), true);
  const pageInstance = createPage({ ...props, validationI18nCache }, context);
  const formRef = pageInstance.form;
  const visibleRef = pageInstance.visible;
  const page = reactive(pageInstance) as BaseAddEditPage & { state: Record<string, unknown> };

  const isEdit = computed(() => !!props.rid);
  const dialogTitle = computed(() =>
    isEdit.value ? t(`${i18nKeyPrefix}.titleEdit`) : t(`${i18nKeyPrefix}.titleAdd`)
  );

  watch(
    () => props.rid,
    (newRid) => {
      page.currentRid = newRid ? String(newRid) : '';
    },
    { immediate: true }
  );

  watch(
    () => page.visible?.value,
    (visible) => {
      if (!visible) return;
      const rid = props.rid ? String(props.rid) : '';
      if (!rid) return;
      page.currentRid = rid;
      nextTick(() => page.reloadRowData());
    },
    { flush: 'post' }
  );

  const { handleBeforeClose, handleCloseRequest, registerOnEditFormLoaded } = useAddEditDialogCloseGuard({
    page,
    getIsEdit: () => !!props.rid,
    i18nKeyPrefix,
    formHasContent,
  });
  registerOnEditFormLoaded();

  /** 模板中提交按钮调用，转发到 page.doSubmit */
  function handleSubmit(): void {
    (page as unknown as { doSubmit: () => void }).doSubmit();
  }

  const { form: _formRef, visible: _visibleRef, ...restPageRefs } = toRefs(page);
  return {
    ...restPageRefs,
    ...toRefs(page.state),
    form: formRef,
    visible: visibleRef,
    props,
    isEdit,
    dialogTitle,
    t,
    handleBeforeClose,
    handleCloseRequest,
    handleSubmit,
  };
}
