import { watch, type Ref } from 'vue';

/**
 * 在弹窗可见时触发回调（默认 post flush）。
 */
export function useOnDialogVisible(
  visibleRef: Ref<boolean | undefined> | undefined,
  onVisible: () => void | Promise<void>
): void {
  watch(
    () => visibleRef?.value,
    async (visible) => {
      if (!visible) return;
      await onVisible();
    },
    { flush: 'post' }
  );
}
