/** Common detail-dialog props: modelValue, rid. */
export const commonDetailDialogProps = {
  modelValue: {
    type: Boolean,
    default: false,
  },
  rid: {
    type: String,
    default: '',
  },
};

/** Common detail-dialog emits. */
export const commonDetailDialogEmits = ['update:modelValue'] as const;
