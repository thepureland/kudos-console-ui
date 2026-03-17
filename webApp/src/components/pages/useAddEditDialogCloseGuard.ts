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

  /** 从 page.state.formModel 取当前表单数据（与 resetFormForAdd 写入处一致，避免 el-form 内部拷贝导致脏检查误判） */
  function getCurrentModel(): Record<string, unknown> | undefined {
    return page.state?.formModel as Record<string, unknown> | undefined;
  }

  /** 深度规范化：undefined、NaN→null，保证快照与比较时形状一致 */
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

  /** 对当前表单数据做深拷贝并保存为初始快照（先深度规范化再克隆，避免 undefined 被 stringify 丢弃导致比较不一致） */
  function takeSnapshot(): void {
    const model = getCurrentModel();
    if (!model) {
      initialFormSnapshot.value = null;
      return;
    }
    const normalized = deepNormalize(model) as Record<string, unknown>;
    initialFormSnapshot.value = JSON.parse(JSON.stringify(normalized));
  }

  /** 清空快照，关闭弹窗或提交成功后调用 */
  function clearSnapshot(): void {
    initialFormSnapshot.value = null;
  }

  /** 有快照时比较当前与快照（两边都深度规范化）；无快照时编辑模式视为脏，新增模式用 formHasContent 判断 */
  function isFormDirty(): boolean {
    const cur = getCurrentModel();
    if (!cur) return false;
    // 新增模式一律只用 formHasContent，不使用快照，避免先编辑再添加时快照/时序导致误报
    if (!getIsEdit()) return formHasContent ? formHasContent(cur) : false;
    const snap = initialFormSnapshot.value;
    if (snap) {
      return JSON.stringify(deepNormalize(cur)) !== JSON.stringify(deepNormalize(snap));
    }
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
        if (!getIsEdit()) clearSnapshot();
      } else {
        clearSnapshot();
      }
    },
    { immediate: true, flush: 'post' }
  );

  /** 执行关闭并调用 done（before-close 回调） */
  const doClose = (done?: () => void) => {
    page.close();
    done?.();
  };

  /** el-dialog before-close：若脏则弹确认框，确认后执行 done */
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

  /** 关闭按钮/取消按钮点击：若脏则弹确认框，确认后关闭 */
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
