import { computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';

/** 详情字段配置：labelKey 为 i18n key，key 对应 detail 属性，type 为展示方式；valueSpan 为值时占的格数（如 3 表示值占 3 格） */
export type FieldConfig = {
  labelKey: string;
  key: string;
  type?: 'plain' | 'boolean' | 'date' | 'atomicService' | 'dict';
  dictModule?: string;
  dictCode?: string;
  /** 值区域占的格数，如 3 表示 label 占 1 格、value 占 3 格（同一行仅此一项时生效） */
  valueSpan?: number;
};

/** 分组：从第几行开始显示分组标题（titleKey 为 i18n key） */
export type SectionConfig = {
  start: number;
  titleKey: string;
};

/** 带 label 的字段（由 rowsWithSections 解析 labelKey 得到） */
export type FieldWithLabel = FieldConfig & { label: string };

export type SectionedDetailRow = {
  sectionTitle: string | null;
  row: FieldWithLabel[];
};

/** 详情页实例需提供的方法与 state（与 BasePage 兼容） */
export type SectionedDetailPage = {
  state: { detail: Record<string, unknown> | null };
  formatDate: (value: unknown) => string;
  transAtomicService: (code: string) => string;
  transDict: (module: string, code: string, value: string) => string;
};

export type UseSectionedDetailOptions = {
  /** 空值占位文案的 i18n key，如 'cacheDetail.empty' */
  emptyKey: string;
  /** 是否/否 的 i18n 前缀，如 'cacheList.common'，会取 key+'.yes' / key+'.no' */
  yesNoKey: string;
};

/**
 * 分段详情页通用逻辑：根据 ROW_FIELDS、SECTION_MAP 和当前语言生成 rowsWithSections，
 * 并提供按类型的 formatFieldValue。
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

  function formatFieldValue(field: FieldConfig): string {
    const d = page.state.detail;
    if (!d) return '';
    const value = d[field.key];
    switch (field.type) {
      case 'boolean':
        return value ? t(`${yesNoKey}.yes`) : t(`${yesNoKey}.no`);
      case 'date':
        return page.formatDate(value) ?? '';
      case 'atomicService':
        return page.transAtomicService(String(value ?? ''));
      case 'dict':
        return field.dictModule && field.dictCode
          ? page.transDict(field.dictModule, field.dictCode, String(value ?? ''))
          : String(value ?? '');
      default:
        return value != null ? String(value) : '';
    }
  }

  return { rowsWithSections, formatFieldValue };
}
