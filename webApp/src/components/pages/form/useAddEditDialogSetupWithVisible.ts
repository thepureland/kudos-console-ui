import { useAddEditDialogSetup, type UseAddEditDialogSetupOptions } from './useAddEditDialogSetup';
import { useOnDialogVisible } from './useOnDialogVisible';
import type { AddEditDialogContext, AddEditDialogProps } from '../core/addEditDialogTypes';

type AddEditDialogSetupResult = ReturnType<typeof useAddEditDialogSetup>;

/**
 * Adds an onVisible callback on top of the base Add/Edit setup options.
 */
export interface UseAddEditDialogSetupWithVisibleOptions extends UseAddEditDialogSetupOptions {
  onVisible?: (result: AddEditDialogSetupResult, props: AddEditDialogProps) => void | Promise<void>;
}

/**
 * Combine useAddEditDialogSetup with logic that fires the callback when the dialog becomes visible.
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
