/** Form-content detection options (combined per field category). */
export interface FormHasContentOptions {
  /** String fields: considered to have content when non-empty after trimming */
  stringKeys?: string[];
  /** Array fields: considered to have content when length > 0 */
  arrayKeys?: string[];
  /** Any-value fields: considered to have content when not null/undefined and not an empty string */
  valueKeys?: string[];
  /** Boolean fields: considered to have content when the value is true */
  trueKeys?: string[];
  /** Custom rules: considered to have content when the function returns true */
  customChecks?: Array<(model: Record<string, unknown>) => boolean>;
}

function hasStringContent(value: unknown): boolean {
  return value != null && String(value).trim() !== '';
}

function hasValueContent(value: unknown): boolean {
  return value != null && value !== '';
}

/**
 * Generic "has the form been filled in?" check, reused by the pre-close dirty check in Add/Edit dialogs.
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
