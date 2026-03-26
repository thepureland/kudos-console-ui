<!-- 数据源详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="dataSourceDetail.title"
    empty-key="dataSourceDetail.empty"
    width="66.9%"
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

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'dataSourceDetail.sections.basicInfo' },
  { start: 4, titleKey: 'dataSourceDetail.sections.config' },
  { start: 7, titleKey: 'dataSourceDetail.sections.audit' },
  { start: 9, titleKey: 'dataSourceDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'dataSourceDetail.fields.id', key: 'id' },
    { labelKey: 'dataSourceDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.url', key: 'url' },
    { labelKey: 'dataSourceDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.username', key: 'username' },
    { labelKey: 'dataSourceDetail.fields.password', key: 'password' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.tenantId', key: 'tenantId' },
    { labelKey: 'dataSourceDetail.fields.tenantName', key: 'tenantName' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.initialSize', key: 'initialSize' },
    { labelKey: 'dataSourceDetail.fields.maxActive', key: 'maxActive' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.maxIdle', key: 'maxIdle' },
    { labelKey: 'dataSourceDetail.fields.minIdle', key: 'minIdle' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.maxWait', key: 'maxWait' },
    { labelKey: 'dataSourceDetail.fields.maxAge', key: 'maxAge' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'dataSourceDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'dataSourceDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'dataSourceDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DataSourceDetailPage extends BaseDetailPage {
  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected getRootActionPath(): string {
    return 'sys/dataSource';
  }
}

export default defineComponent({
  name: 'DataSourceDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new DataSourceDetailPage(props, context)) as DataSourceDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'dataSourceDetail.empty',
      yesNoKey: 'dataSourceList.common',
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
