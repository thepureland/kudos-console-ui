import { computed, inject, reactive, ref, toRefs, watch, nextTick, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BaseAddEditPage } from '../core/BaseAddEditPage';
import { useAddEditDialogCloseGuard } from './useAddEditDialogCloseGuard';
import { getGlobalLocale, loadMessagesForConfig } from '../../../i18n';
import type { PageContext, PageProps } from '../core/pageTypes';

/** List pages provide this key (value: Ref<Set<string>>); after AddEdit injects it, it serves as the list-page-level cache for validation i18n so opening the dialog multiple times doesn't refetch */
export const ValidationI18nCacheKey = Symbol('ValidationI18nCache');

/** Common Add/Edit setup options. */
export interface UseAddEditDialogSetupOptions {
  /** Page-instance factory (e.g. () => new CacheAddEditPage(props, context)) */
  createPage: (props: PageProps, context: PageContext) => BaseAddEditPage;
  /** i18n key prefix, e.g. 'cacheAddEdit'; must include titleAdd, titleEdit, closeConfirm, buttons, etc. */
  i18nKeyPrefix: string;
  /** In add mode without a snapshot, decide whether the form is dirty based on whether it has content */
  formHasContent: (model: Record<string, unknown>) => boolean;
}

/**
 * Shared add/edit dialog setup logic: create page, watch rid/visible, close guard, handleSubmit, return refs the template needs.
 * Pairs with useAddEditDialogCloseGuard; reused by CacheAddEdit, ParamAddEdit, and others.
 */
export function useAddEditDialogSetup(
  props: PageProps,
  context: PageContext,
  options: UseAddEditDialogSetupOptions
) {
  const { createPage, i18nKeyPrefix, formHasContent } = options;
  const { t } = useI18n();
  const validationI18nCache = inject<Ref<Set<string>>>(ValidationI18nCacheKey, () => ref<Set<string>>(new Set<string>()), true);
  (props as Record<string, unknown>).validationI18nCache = validationI18nCache;
  const pageInstance = createPage(props, context);
  const formRef = pageInstance.form;
  const visibleRef = pageInstance.visible;
  const page = reactive(pageInstance) as unknown as BaseAddEditPage & { state: Record<string, unknown> };

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

  // Primary trigger: open/close or rid change propagated through props.
  // Handles both edit (rid present) and add (rid absent) transitions.
  watch(
    () => [props.modelValue, props.rid] as const,
    ([modelVal, r]) => {
      if (modelVal === true && r != null && String(r).trim() !== '') {
        page.currentRid = String(r);
        nextTick(async () => {
          // When reusing the same form instance, switching to edit mode requires explicitly loading the edit validation rules
          await (page as unknown as { initValidationRule?: () => Promise<void> }).initValidationRule?.();
          await page.reloadRowData();
        });
      } else if (modelVal === true && (r == null || String(r).trim() === '')) {
        // Add mode: only reset the form. Validation rules and i18n are already fetched by initValidationRule in the constructor during createPage, so no extra request here
        nextTick(() => (page as BaseAddEditPage).resetFormForAdd());
      }
    },
    { immediate: true }
  );

  // Secondary trigger: page.visible can be set internally by the page class (e.g. after a
  // nested navigation), independently of the modelValue prop.  Re-load data for edit mode
  // when that internal flag flips to true so the form is never stale.
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

  /** On locale change, reload this page's dict-item and other i18n, and re-request backend validation rules (clears the internal BaseAddEditPage cache) */
  watch(
    () => getGlobalLocale(),
    async () => {
      const config = (page as unknown as { getI18nConfig?: () => { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode: string }[] }).getI18nConfig?.();
      if (config?.length) await loadMessagesForConfig(config);
      await (page as BaseAddEditPage).reloadValidationRulesForLocaleChange?.();
    },
    { immediate: false }
  );

  /** Called by the submit button in the template; forwards to page.doSubmit */
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
    /** Reactive page-class instance, allowing child component setups to call loadRowData, loadCascade, etc. */
    page,
  };
}
