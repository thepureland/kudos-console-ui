<!-- 国际化详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="i18nDetail.title"
    empty-key="i18nDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, watch } from 'vue';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'i18nDetail.sections.basicInfo' },
  { start: 4, titleKey: 'i18nDetail.sections.audit' },
  { start: 6, titleKey: 'i18nDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'i18nDetail.fields.id', key: 'id' },
    { labelKey: 'i18nDetail.fields.locale', key: 'locale' },
  ],
  [
    { labelKey: 'i18nDetail.fields.key', key: 'key' },
    { labelKey: 'i18nDetail.fields.value', key: 'value' },
  ],
  [
    { labelKey: 'i18nDetail.fields.atomicServiceCode', key: 'atomicServiceCode', type: 'atomicService' },
    { labelKey: 'i18nDetail.fields.i18nTypeDictCode', key: 'i18nTypeDictCode', type: 'dict', dictModule: 'sys', dictCode: 'i18n_type' },
  ],
  [
    { labelKey: 'i18nDetail.fields.namespace', key: 'namespace' },
  ],
  [
    { labelKey: 'i18nDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'i18nDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'i18nDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'i18nDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'i18nDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'i18nDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'i18nDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class I18nDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/i18n';
  }
}

export default defineComponent({
  name: 'I18nDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new I18nDetailPage(props, context)) as I18nDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'i18nDetail.empty',
      yesNoKey: 'i18nList.common',
    });

    useDetailPageRidSync(props, page);

    const { visible, close } = useDetailDialogVisibility(props, context);

    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
