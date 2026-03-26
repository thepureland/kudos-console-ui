/** 表单内容判定配置（按字段类别组合判断）。 */
export interface FormHasContentOptions {
  /** 字符串字段：trim 后非空即认为有内容 */
  stringKeys?: string[];
  /** 数组字段：长度 > 0 即认为有内容 */
  arrayKeys?: string[];
  /** 任意值字段：非 null/undefined 且不为空字符串即认为有内容 */
  valueKeys?: string[];
  /** 布尔字段：值为 true 即认为有内容 */
  trueKeys?: string[];
  /** 自定义规则：返回 true 即认为有内容 */
  customChecks?: Array<(model: Record<string, unknown>) => boolean>;
}

function hasStringContent(value: unknown): boolean {
  return value != null && String(value).trim() !== '';
}

function hasValueContent(value: unknown): boolean {
  return value != null && value !== '';
}

/**
 * 通用表单“是否填写内容”判断，供 Add/Edit 关闭前脏数据判断复用。
 */
export function hasAnyFormContent(
  model: Record<string, unknown> | null | undefined,
  options: FormHasContentOptions
): boolean {
  if (!model) return false;
  const {
    stringKeys = [],
    arrayKeys = [],
    valueKeys = [],
    trueKeys = [],
    customChecks = [],
  } = options;

  for (const key of stringKeys) {
    if (hasStringContent(model[key])) return true;
  }
  for (const key of arrayKeys) {
    const value = model[key];
    if (Array.isArray(value) && value.length > 0) return true;
  }
  for (const key of valueKeys) {
    if (hasValueContent(model[key])) return true;
  }
  for (const key of trueKeys) {
    if (model[key] === true) return true;
  }
  for (const check of customChecks) {
    if (check(model)) return true;
  }
  return false;
}
