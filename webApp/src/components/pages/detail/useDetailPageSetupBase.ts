import { toRefs } from 'vue';
import type { FieldConfig, SectionConfig } from './sectionedDetail';
import { useSectionedDetail } from './sectionedDetail';

export interface UseDetailPageSetupBaseOptions {
  emptyKey: string;
  yesNoKey: string;
}

/**
 * 统一详情页 setup 中的分组字段构建与 page/state refs 暴露。
 */
export function useDetailPageSetupBase(
  page: {
    state: { detail: Record<string, unknown> | null } & Record<string, unknown>;
    transAtomicService: (code: string) => string;
    transDict: (module: string, code: string, value: string) => string;
    formatDate: (value: unknown) => string;
  },
  rowFields: FieldConfig[][],
  sectionMap: SectionConfig[],
  options: UseDetailPageSetupBaseOptions
) {
  const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, rowFields, sectionMap, options);
  return {
    rowsWithSections,
    formatFieldValue,
    pageRefs: toRefs(page),
    stateRefs: toRefs(page.state),
  };
}
