import type { PropType } from 'vue';

/** Add/Edit 弹窗通用 props：modelValue、rid、onSaved。 */
export const commonAddEditDialogProps = {
  modelValue: {
    type: Boolean,
    default: false,
  },
  rid: {
    type: String,
    default: '',
  },
  onSaved: {
    type: Function as PropType<(params: Record<string, unknown>) => void>,
    default: undefined,
  },
};

/** Add/Edit 弹窗通用 emits。 */
export const commonAddEditDialogEmits = ['update:modelValue', 'response'] as const;
