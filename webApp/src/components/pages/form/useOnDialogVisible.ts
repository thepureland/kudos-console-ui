import { watch, type Ref } from 'vue';

/**
 * Fire a callback when the dialog becomes visible (post flush by default).
 *
 * @param visibleRef - Ref that tracks dialog visibility. When `undefined`, the
 *   watcher is installed but the `!visible` guard keeps the callback from ever
 *   firing, making the composable effectively a no-op — this is intentional so
 *   callers can pass an optional ref without extra conditionals.
 * @param onVisible - Async-safe callback invoked each time the dialog opens.
 */
export function useOnDialogVisible(
  visibleRef: Ref<boolean | undefined> | undefined,
  onVisible: () => void | Promise<void>
): void {
  watch(
    // Optional-chain: if visibleRef is undefined the source always returns
    // undefined, so the `!visible` guard below prevents spurious invocations.
    () => visibleRef?.value,
    async (visible) => {
      if (!visible) return;
      await onVisible();
    },
    { flush: 'post' }
  );
}
