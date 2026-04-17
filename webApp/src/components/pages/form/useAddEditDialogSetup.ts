import { computed, inject, reactive, ref, toRefs, watch, nextTick, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BaseAddEditPage } from '../core/BaseAddEditPage';
import { useAddEditDialogCloseGuard } from './useAddEditDialogCloseGuard';
import { i18n, loadMessagesForConfig } from '../../../i18n';
import type { PageContext, PageProps } from '../core/pageTypes';

/** 列表页 provide 此 key（值为 Ref<Set<string>>），AddEdit 注入后作为校验 i18n 的列表页级缓存，避免多次打开弹窗重复请求 */
export const ValidationI18nCacheKey = Symbol('ValidationI18nCache');

/** Add/Edit 通用 setup 配置。 */
export interface UseAddEditDialogSetupOptions {
  /** 创建页面实例的工厂（如 () => new CacheAddEditPage(props, context)） */
  createPage: (props: PageProps, context: PageContext) => BaseAddEditPage;
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
  props: PageProps,
  context: PageContext,
  options: UseAddEditDialogSetupOptions
) {
  const { createPage, i18nKeyPrefix, formHasContent } = options;
  const { t } = useI18n();
  const validationI18nCache = inject<Ref<Set<string>>>(ValidationI18nCacheKey, () => ref(new Set()), true);
  (props as Record<string, unknown>).validationI18nCache = validationI18nCache;
  const pageInstance = createPage(props, context);
  const formRef = pageInstance.form;
  const visibleRef = pageInstance.visible;
  const page = reactive(pageInstance) as BaseAddEditPage & { state: Record<string, unknown> };

  const isEdit = computed(() => !!props.rid);
  const dialogTitle = computed(() =>
    isEdit.value ? t(`${i18nKeyPrefix}.titleEdit`) : t(`${i18nKeyPrefix}.titleAdd`)
  );

  watch(
    () => props.modelValue,
    (val) => {
      const v = page.visible as { value?: boolean } | undefined;
      if (v && typeof v === 'object' && 'value' in v) v.value = !!val;
    },
    { immediate: true }
  );

  watch(
    () => props.rid,
    (newRid) => {
      page.currentRid = newRid ? String(newRid) : '';
    },
    { immediate: true }
  );

  watch(
    () => [props.modelValue, props.rid] as const,
    ([modelVal, r]) => {
      if (modelVal === true && r != null && String(r).trim() !== '') {
        page.currentRid = String(r);
        nextTick(async () => {
          // 复用同一个表单实例时，切到编辑模式需主动加载编辑校验规则
          await (page as unknown as { initValidationRule?: () => Promise<void> }).initValidationRule?.();
          await page.reloadRowData();
        });
      } else if (modelVal === true && (r == null || String(r).trim() === '')) {
        // 新增：仅重置表单。校验规则与 i18n 已在 createPage 时由构造函数 initValidationRule 拉取，此处不再重复请求
        nextTick(() => (page as BaseAddEditPage).resetFormForAdd());
      }
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
      nextTick(async () => {
        await (page as unknown as { initValidationRule?: () => Promise<void> }).initValidationRule?.();
        await page.reloadRowData();
      });
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

  /** 语言切换时重载本页字典项等 i18n，并重新请求后端校验规则（清除 BaseAddEditPage 内缓存） */
  watch(
    () => i18n.global.locale.value,
    async () => {
      const config = (page as { getI18nConfig?: () => { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode: string }[] }).getI18nConfig?.();
      if (config?.length) await loadMessagesForConfig(config);
      await (page as BaseAddEditPage).reloadValidationRulesForLocaleChange?.();
    },
    { immediate: false }
  );

  /** 模板中提交按钮调用，转发到 page.doSubmit */
  function handleSubmit(): void {
    (page as unknown as { doSubmit: () => void }).doSubmit();
  }

  const { form: _formRef, visible: _visibleRef, ...restPageRefs } = toRefs(page);
  const safePageRefs = Object.fromEntries(
    Object.entries(restPageRefs).filter(([key]) => !key.startsWith('_') && !key.startsWith('$'))
  );
  return {
    ...safePageRefs,
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
    /** 页面类实例（reactive），供子组件 setup 调用 loadRowData、loadCascade 等 */
    page,
  };
}
