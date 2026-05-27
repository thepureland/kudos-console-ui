import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';

/** Dialog page instance: must include visible, form, state.formModel, close */
export interface AddEditDialogPage {
  visible?: { value: boolean };
  form?: { value?: { model?: Record<string, unknown> } };
  state: { formModel?: Record<string, unknown> };
  close: () => void;
  onEditFormLoaded?: (() => void) | null;
}

/** Close-confirmation guard options: page instance, edit-mode predicate, i18n prefix, and dirty checks. */
export interface UseAddEditDialogCloseGuardOptions {
  /** Dialog page instance (the reactive instance of BaseAddEditPage) */
  page: AddEditDialogPage;
  /** Whether the dialog is in edit mode (has rid) */
  getIsEdit: () => boolean;
  /** i18n key prefix, e.g. 'cacheAddEdit'; must include closeConfirm.message/title and buttons.confirm/cancel */
  i18nKeyPrefix: string;
  /** In add mode without a snapshot, treat content as dirty when this returns true; if omitted, no prompt is shown in that case */
  formHasContent?: (model: Record<string, unknown>) => boolean;
}

/**
 * Shared "warn before closing unsaved changes" logic for add/edit dialogs: snapshot, dirty check, before-close / cancel-button confirmation.
 * Call this in setup; it returns handleBeforeClose and handleCloseRequest, and registers onEditFormLoaded to take a snapshot.
 */
export function useAddEditDialogCloseGuard(options: UseAddEditDialogCloseGuardOptions) {
  const { page, getIsEdit, i18nKeyPrefix, formHasContent } = options;
  const { t } = useI18n();

  const initialFormSnapshot = ref<Record<string, unknown> | null>(null);

  /** Read the current form data from page.state.formModel (consistent with where resetFormForAdd writes, avoiding false dirty results caused by el-form's internal copy) */
  function getCurrentModel(): Record<string, unknown> | undefined {
    return page.state?.formModel as Record<string, unknown> | undefined;
  }

  /** Deep-normalize: convert undefined and NaN to null so the snapshot and the comparison share the same shape */
  function deepNormalize(value: unknown): unknown {
    if (value === undefined || (typeof value === 'number' && Number.isNaN(value))) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => deepNormalize(item));
    const o: Record<string, unknown> = {};
    for (const k in value as Record<string, unknown>) {
      o[k] = deepNormalize((value as Record<string, unknown>)[k]);
    }
    return o;
  }

  /** Deep-copy the current form data and store it as the initial snapshot (normalize first, then clone, so undefined isn't dropped by stringify and cause inconsistent comparisons) */
  function takeSnapshot(): void {
    const model = getCurrentModel();
    if (!model) {
      initialFormSnapshot.value = null;
      return;
    }
    const normalized = deepNormalize(model) as Record<string, unknown>;
    initialFormSnapshot.value = JSON.parse(JSON.stringify(normalized));
  }

  /** Clear the snapshot; call after the dialog closes or a submission succeeds */
  function clearSnapshot(): void {
    initialFormSnapshot.value = null;
  }

  /** When a snapshot exists, compare the current data to it (deep-normalize both sides); otherwise, edit mode counts as dirty and add mode is evaluated via formHasContent */
  function isFormDirty(): boolean {
    const cur = getCurrentModel();
    if (!cur) return false;
    // In add mode always use formHasContent and ignore any snapshot, to avoid false positives caused by snapshot/timing when switching from edit to add
    if (!getIsEdit()) return formHasContent ? formHasContent(cur) : false;
    const snap = initialFormSnapshot.value;
    if (snap) {
      return JSON.stringify(deepNormalize(cur)) !== JSON.stringify(deepNormalize(snap));
    }
    return true;
  }

  /** Called after edit data is loaded and back-filled; takes the snapshot on the next nextTick */
  function registerOnEditFormLoaded(): void {
    if (page.onEditFormLoaded !== undefined) {
      page.onEditFormLoaded = () => nextTick(takeSnapshot);
    }
  }

  watch(
    () => page.visible?.value,
    (val) => {
      if (val) {
        if (!getIsEdit()) clearSnapshot();
      } else {
        clearSnapshot();
      }
    },
    { immediate: true, flush: 'post' }
  );

  /** Perform close and invoke done (the before-close callback) */
  const doClose = (done?: () => void) => {
    page.close();
    done?.();
  };

  /** el-dialog before-close: if dirty, show a confirmation dialog and call done on confirm */
  function handleBeforeClose(done: () => void): void {
    if (!isFormDirty()) {
      doClose(done);
      return;
    }
    ElMessageBox.confirm(
      t(`${i18nKeyPrefix}.closeConfirm.message`),
      t(`${i18nKeyPrefix}.closeConfirm.title`),
      {
        confirmButtonText: t(`${i18nKeyPrefix}.buttons.confirm`),
        cancelButtonText: t(`${i18nKeyPrefix}.buttons.cancel`),
        type: 'warning',
      }
    )
      .then(() => doClose(done))
      .catch(() => {});
  }

  /** Close/Cancel button click: if dirty, show a confirmation dialog and close on confirm */
  function handleCloseRequest(): void {
    if (!isFormDirty()) {
      page.close();
      return;
    }
    ElMessageBox.confirm(
      t(`${i18nKeyPrefix}.closeConfirm.message`),
      t(`${i18nKeyPrefix}.closeConfirm.title`),
      {
        confirmButtonText: t(`${i18nKeyPrefix}.buttons.confirm`),
        cancelButtonText: t(`${i18nKeyPrefix}.buttons.cancel`),
        type: 'warning',
      }
    )
      .then(() => page.close())
      .catch(() => {});
  }

  return {
    handleBeforeClose,
    handleCloseRequest,
    registerOnEditFormLoaded,
  };
}
