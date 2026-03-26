/** i18n 翻译函数签名。 */
export type ColumnTranslate = (key: string) => string;

/**
 * 生成列表列标题 i18n getter，支持 key 别名映射。
 * 例：subSystemCode -> subSys，对应 t(`${prefix}.subSys`)。
 */
export function createI18nColumnLabelGetter(
  t: ColumnTranslate,
  prefix: string,
  aliases: Record<string, string> = {}
): (key: string) => string {
  return (key: string) => t(`${prefix}.${aliases[key] ?? key}`);
}
