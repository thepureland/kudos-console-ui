<!-- 组织机构详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="organizationDetail.title"
    empty-key="organizationDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, watch } from 'vue';
import { Pair } from '../../../components/model/Pair';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/** 与 CacheDetail 一致：每行最多 2 个字段；其他信息放最后，备注单独一行。 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'organizationDetail.sections.basicInfo' },
  { start: 2, titleKey: 'organizationDetail.sections.audit' },
  { start: 4, titleKey: 'organizationDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'organizationDetail.fields.id', key: 'id' },
    { labelKey: 'organizationDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'organizationDetail.fields.abbrName', key: 'abbrName' },
    { labelKey: 'organizationDetail.fields.orgTypeDictCode', key: 'orgTypeDictCode', type: 'dict', dictModule: 'user', dictCode: 'organization_type' },
  ],
  [
    { labelKey: 'organizationDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'organizationDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'organizationDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'organizationDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'organizationDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'organizationDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'organizationDetail.fields.tenantName', key: 'tenantName' },
    { labelKey: 'organizationDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'organizationDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'organizationDetail.fields.remark', key: 'remark' },
  ],
];

class OrganizationDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/organization';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
    await this.loadDicts(['organization_type'], 'user');
  }
}

export default defineComponent({
  name: 'OrganizationDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new OrganizationDetailPage(props, context)) as OrganizationDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'organizationDetail.empty',
      yesNoKey: 'organizationList.common',
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
