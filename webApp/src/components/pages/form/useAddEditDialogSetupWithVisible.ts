import { useAddEditDialogSetup, type UseAddEditDialogSetupOptions } from './useAddEditDialogSetup';
import { useOnDialogVisible } from './useOnDialogVisible';
import type { AddEditDialogContext, AddEditDialogProps } from '../core/addEditDialogTypes';

type AddEditDialogSetupResult = ReturnType<typeof useAddEditDialogSetup>;

/**
 * 在基础 Add/Edit setup 配置上增加 onVisible 回调。
 */
export interface UseAddEditDialogSetupWithVisibleOptions extends UseAddEditDialogSetupOptions {
  onVisible?: (result: AddEditDialogSetupResult, props: AddEditDialogProps) => void | Promise<void>;
}

/**
 * 组合 useAddEditDialogSetup 与可见时回调触发逻辑。
 */
export function useAddEditDialogSetupWithVisible(
  props: AddEditDialogProps,
  context: AddEditDialogContext,
  options: UseAddEditDialogSetupWithVisibleOptions
): AddEditDialogSetupResult {
  const { onVisible, ...setupOptions } = options;
  const result = useAddEditDialogSetup(props, context, setupOptions);
  if (onVisible) {
    useOnDialogVisible(result.visible, async () => onVisible(result, props));
  }
  return result;
}
