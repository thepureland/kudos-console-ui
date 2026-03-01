import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';

/** 弹窗页面实例：需包含 visible、form、state.formModel、close */
export interface AddEditDialogPage {
  visible?: { value: boolean };
  form?: { value?: { model?: Record<string, unknown> } };
  state: { formModel?: Record<string, unknown> };
  close: () => void;
  onEditFormLoaded?: (() => void) | null;
}

export interface UseAddEditDialogCloseGuardOptions {
  /** 弹窗页面实例（BaseAddEditPage 的 reactive 实例） */
  page: AddEditDialogPage;
  /** 是否编辑模式（有 rid） */
  getIsEdit: () => boolean;
  /** i18n 文案前缀，如 'cacheAddEdit'，需包含 closeConfirm.message/title、buttons.confirm/cancel */
  i18nKeyPrefix: string;
  /** 新增模式下无快照时，根据是否有填写内容判断为 dirty；不传则新增无快照时不提示 */
  formHasContent?: (model: Record<string, unknown>) => boolean;
}

/**
 * 添加/编辑弹窗「关闭前未保存提示」通用逻辑：快照、脏检查、before-close / 取消按钮确认。
 * 在 setup 中调用，返回 handleBeforeClose、handleCloseRequest，并注册 onEditFormLoaded 拍快照。
 */
export function useAddEditDialogCloseGuard(options: UseAddEditDialogCloseGuardOptions) {
  const { page, getIsEdit, i18nKeyPrefix, formHasContent } = options;
  const { t } = useI18n();

  const initialFormSnapshot = ref<Record<string, unknown> | null>(null);

  function getCurrentModel(): Record<string, unknown> | undefined {
    const form = page.form?.value as { model?: Record<string, unknown> } | undefined;
    const model = form?.model ?? (page.state?.formModel as Record<string, unknown> | undefined);
    return model;
  }

  function takeSnapshot(): void {
    const model = getCurrentModel();
    initialFormSnapshot.value = model ? JSON.parse(JSON.stringify(model)) : null;
  }

  function clearSnapshot(): void {
    initialFormSnapshot.value = null;
  }

  function normalizeForCompare(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') return {};
    const o: Record<string, unknown> = {};
    for (const k in obj) {
      const v = obj[k];
      if (v === undefined) o[k] = null;
      else if (typeof v === 'number' && Number.isNaN(v)) o[k] = null;
      else o[k] = v;
    }
    return o;
  }

  function isFormDirty(): boolean {
    const cur = getCurrentModel();
    if (!cur) return false;
    const snap = initialFormSnapshot.value;
    if (snap) {
      return JSON.stringify(normalizeForCompare(cur)) !== JSON.stringify(normalizeForCompare(snap));
    }
    if (!getIsEdit()) return formHasContent ? formHasContent(cur) : false;
    return true;
  }

  /** 编辑数据加载并回填后调用，在 nextTick 后拍快照 */
  function registerOnEditFormLoaded(): void {
    if (page.onEditFormLoaded !== undefined) {
      page.onEditFormLoaded = () => nextTick(takeSnapshot);
    }
  }

  watch(
    () => page.visible?.value,
    (val) => {
      if (val) {
        if (!getIsEdit()) nextTick(takeSnapshot);
      } else {
        clearSnapshot();
      }
    },
    { immediate: true, flush: 'post' }
  );

  const doClose = (done?: () => void) => {
    page.close();
    done?.();
  };

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
