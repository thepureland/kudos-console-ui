<!-- 租户详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="tenantDetail.title"
    empty-key="tenantDetail.empty"
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
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'tenantDetail.sections.basicInfo' },
  { start: 2, titleKey: 'tenantDetail.sections.audit' },
  { start: 4, titleKey: 'tenantDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'tenantDetail.fields.id', key: 'id' },
    { labelKey: 'tenantDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'tenantDetail.fields.subSystemCodes', key: 'subSystemCodes' },
  ],
  [
    { labelKey: 'tenantDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'tenantDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'tenantDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'tenantDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'tenantDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'tenantDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'tenantDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class TenantDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.updateTime == null) data.updateTime = null;
      if (data.createUser == null) data.createUser = '';
      if (data.updateUser == null) data.updateUser = '';
      if (data.builtIn == null) data.builtIn = false;
      if (data.remark == null) data.remark = '';
      this.state.detail = data;
    } else {
      this.state.detail = null;
    }
    if (this.showAfterLoadData()) {
      this.render();
    }
  }
}

export default defineComponent({
  name: 'TenantDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new TenantDetailPage(props, context)) as TenantDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue: baseFormatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'tenantDetail.empty',
      yesNoKey: 'tenantList.common',
    });
    function formatFieldValue(field: FieldConfig): string {
      if (field.key === 'subSystemCodes') {
        const val = page.state.detail?.[field.key];
        if (Array.isArray(val)) return val.map((c) => page.transAtomicService(String(c ?? ''))).filter(Boolean).join(', ');
        if (val != null && val !== '') return page.transAtomicService(String(val));
        return '';
      }
      return baseFormatFieldValue(field);
    }

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
