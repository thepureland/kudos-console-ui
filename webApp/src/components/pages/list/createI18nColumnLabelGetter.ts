/** Signature of an i18n translate function. */
export type ColumnTranslate = (key: string) => string;

/**
 * Build an i18n getter for list column labels, supporting key aliasing.
 * Example: subSystemCode -> subSys, which maps to t(`${prefix}.subSys`).
 */
export function createI18nColumnLabelGetter(
  t: ColumnTranslate,
  prefix: string,
  aliases: Record<string, string> = {}
): (key: string) => string {
  return (key: string) => t(`${prefix}.${aliases[key] ?? key}`);
}
