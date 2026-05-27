import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';

/** Detail field config: labelKey is an i18n key, key maps to a detail property, type chooses how to render; valueSpan is the number of grid columns the value occupies (e.g. 3 means the value spans 3 columns) */
export type FieldConfig = {
  labelKey: string;
  key: string;
  type?: 'plain' | 'boolean' | 'date' | 'atomicService' | 'dict';
  dictModule?: string;
  dictCode?: string;
  /** Number of grid columns the value area occupies, e.g. 3 means the label takes 1 column and the value takes 3 (only effective when this is the only field on the row) */
  valueSpan?: number;
};

/** Section: which row to start showing the section title on (titleKey is an i18n key) */
export type SectionConfig = {
  start: number;
  titleKey: string;
};

/** Field with a resolved label (produced by rowsWithSections from labelKey) */
export type FieldWithLabel = FieldConfig & { label: string };

/** Detail row definition. */
export type SectionedDetailRow = {
  sectionTitle: string | null;
  row: FieldWithLabel[];
};

/** Methods and state a detail-page instance must provide (compatible with BasePage) */
export type SectionedDetailPage = {
  state: { detail: Record<string, unknown> | null };
  formatDate: (value: unknown) => string;
  transAtomicService: (code: string) => string;
  transDict: (module: string, code: string, value: string) => string;
};

/** Sectioned-detail hook options. */
export type UseSectionedDetailOptions = {
  /** i18n key for the empty-value placeholder text, e.g. 'cacheDetail.empty' */
  emptyKey: string;
  /** i18n prefix for yes/no, e.g. 'cacheList.common'; will use key+'.yes' / key+'.no' */
  yesNoKey: string;
};

/**
 * Shared sectioned-detail-page logic: builds rowsWithSections from ROW_FIELDS, SECTION_MAP, and the current locale,
 * and provides a type-aware formatFieldValue.
 */
export function useSectionedDetail(
  page: SectionedDetailPage,
  rowFields: FieldConfig[][],
  sectionMap: SectionConfig[],
  options: UseSectionedDetailOptions
): {
  rowsWithSections: ComputedRef<SectionedDetailRow[]>;
  formatFieldValue: (field: FieldConfig) => string;
} {
  const { t } = useI18n();
  const { emptyKey, yesNoKey } = options;

  const rowsWithSections = computed(() =>
    rowFields.map((row, index) => {
      const section = sectionMap.find((s) => s.start === index);
      return {
        row: row.map((f) => ({ ...f, label: t(f.labelKey) })),
        sectionTitle: section ? t(section.titleKey) : null,
      };
    })
  );

  /** Pull the field value from page.state.detail according to field.type and format it for display (boolean/date/atomic service/dict/etc.) */
  function formatFieldValue(field: FieldConfig): string {
    const d = page.state.detail;
    if (!d) return '';
    const value = d[field.key];
    if (value == null || value === '') return t(emptyKey);
    switch (field.type) {
      case 'boolean':
        return value ? t(`${yesNoKey}.yes`) : t(`${yesNoKey}.no`);
      case 'date':
        return page.formatDate(value) ?? '';
      case 'atomicService':
        return page.transAtomicService(String(value ?? ''));
      case 'dict':
        return field.dictModule && field.dictCode
          ? t(page.transDict(field.dictModule, field.dictCode, String(value ?? '')))
          : String(value ?? '');
      default:
        return value != null ? String(value) : '';
    }
  }

  return { rowsWithSections, formatFieldValue };
}
