<!-- Remember-me token detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="rememberMeDetail.title"
    empty-key="rememberMeDetail.empty"
    width="60%"
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
import { type FieldConfig, type SectionConfig } from '../../../components/pages/detail';

const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'rememberMeDetail.sections.basicInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'rememberMeDetail.fields.id', key: 'id' },
    { labelKey: 'rememberMeDetail.fields.username', key: 'username' },
  ],
  [
    { labelKey: 'rememberMeDetail.fields.token', key: 'token', valueSpan: 3 },
  ],
  [
    { labelKey: 'rememberMeDetail.fields.lastUsed', key: 'lastUsed', type: 'date' },
  ],
];

class RememberMeDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/rememberMe';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.lastUsed == null) data.lastUsed = null;
      this.state.detail = data;
    } else {
      this.state.detail = null;
    }
    if (this.showAfterLoadData()) this.render();
  }
}

export default defineComponent({
  name: 'RememberMeDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new RememberMeDetailPage(props, context)) as RememberMeDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'rememberMeDetail.empty',
      yesNoKey: 'rememberMeList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
