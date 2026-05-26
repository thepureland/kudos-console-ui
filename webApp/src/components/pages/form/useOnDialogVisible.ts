import { watch, type Ref } from 'vue';

/**
 * Fire a callback when the dialog becomes visible (post flush by default).
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
