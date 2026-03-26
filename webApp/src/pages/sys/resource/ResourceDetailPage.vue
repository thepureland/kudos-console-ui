<!-- 资源详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="resourceDetail.title"
    empty-key="resourceDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';
import { Pair } from '../../../components/model/Pair';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'resourceDetail.sections.basicInfo' },
  { start: 5, titleKey: 'resourceDetail.sections.audit' },
  { start: 7, titleKey: 'resourceDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'resourceDetail.fields.id', key: 'id' },
    { labelKey: 'resourceDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'resourceDetail.fields.url', key: 'url' },
    { labelKey: 'resourceDetail.fields.seqNo', key: 'seqNo' },
  ],
  [
    { labelKey: 'resourceDetail.fields.icon', key: 'icon' },
    { labelKey: 'resourceDetail.fields.resourceTypeDictCode', key: 'resourceTypeDictCode', type: 'dict', dictModule: 'sys', dictCode: 'resource_type' },
  ],
  [
    { labelKey: 'resourceDetail.fields.parentId', key: 'parentId' },
    { labelKey: 'resourceDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'resourceDetail.fields.ownerId', key: 'ownerId' },
  ],
  [
    { labelKey: 'resourceDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'resourceDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'resourceDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'resourceDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'resourceDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'resourceDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'resourceDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class ResourceDetailPage extends BaseDetailPage {
  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
    await this.loadDicts(['resource_type'], 'sys');
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }
}

export default defineComponent({
  name: 'ResourceDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new ResourceDetailPage(props, context)) as ResourceDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'resourceDetail.empty',
      yesNoKey: 'resourceList.common',
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
