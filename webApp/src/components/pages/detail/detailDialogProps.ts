/** Detail 弹窗通用 props：modelValue、rid。 */
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

/** Detail 弹窗通用 emits。 */
export const commonDetailDialogEmits = ['update:modelValue'] as const;
