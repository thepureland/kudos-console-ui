<!-- 字典项详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="dictItemDetail.title"
    empty-key="dictItemDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/** 分组：基本信息、审计信息、其他信息 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'dictItemDetail.sections.basicInfo' },
  { start: 3, titleKey: 'dictItemDetail.sections.audit' },
  { start: 5, titleKey: 'dictItemDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'dictItemDetail.fields.id', key: 'id' },
    { labelKey: 'dictItemDetail.fields.dictId', key: 'dictId' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.itemCode', key: 'itemCode' },
    { labelKey: 'dictItemDetail.fields.itemName', key: 'itemName' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.parentId', key: 'parentId' },
    { labelKey: 'dictItemDetail.fields.seqNo', key: 'seqNo' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'dictItemDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'dictItemDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
    { labelKey: 'dictItemDetail.fields.active', key: 'active', type: 'boolean' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DictItemDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/dictItem';
  }
}

export default defineComponent({
  name: 'DictItemDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new DictItemDetailPage(props, context)) as DictItemDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'dictItemDetail.empty',
      yesNoKey: 'dictList.common',
    });

    useDetailPageRidSync(props, page);

    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
    };
  },
});
</script>
