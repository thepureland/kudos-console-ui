import { nextTick, type Ref } from 'vue';

type ClosableDropdown = {
  togglePopperVisible?: (visible?: boolean) => void;
  blur?: () => void;
} | null | undefined;

/**
 * Close the Cascader/TreeSelect dropdown panel after the selection changes.
 */
export function useCloseDropdownOnChange() {
  function closeDropdown(refOrValue: Ref<unknown> | unknown): void {
    nextTick(() => {
      const raw = refOrValue != null && typeof refOrValue === 'object' && 'value' in (refOrValue as object)
        ? (refOrValue as Ref<unknown>).value
        : refOrValue;
      const el = raw as ClosableDropdown;
      el?.togglePopperVisible?.(false);
      el?.blur?.();
    });
  }

  return { closeDropdown };
}
