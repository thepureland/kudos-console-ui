import type { PropType } from 'vue';

/** Common Add/Edit dialog props: modelValue, rid, onSaved. */
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

/** Common Add/Edit dialog emits. */
export const commonAddEditDialogEmits = ['update:modelValue', 'response'] as const;
