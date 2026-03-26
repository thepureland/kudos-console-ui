import { nextTick, type Ref } from 'vue';

type ClosableDropdown = {
  togglePopperVisible?: (visible?: boolean) => void;
  blur?: () => void;
} | null | undefined;

/**
 * 在选择变更后关闭 Cascader/TreeSelect 下拉面板。
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
