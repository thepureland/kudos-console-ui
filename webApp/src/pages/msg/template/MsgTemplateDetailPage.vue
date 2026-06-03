<!-- Message template detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="msgTemplateDetail.title"
    empty-key="msgTemplateDetail.empty"
    width="68%"
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
  { start: 0, titleKey: 'msgTemplateDetail.sections.routing' },
  { start: 4, titleKey: 'msgTemplateDetail.sections.content' },
  { start: 6, titleKey: 'msgTemplateDetail.sections.defaults' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'msgTemplateDetail.fields.id', key: 'id' },
    { labelKey: 'msgTemplateDetail.fields.sendType', key: '_sendTypeText' },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.eventType', key: 'eventTypeDictCode' },
    { labelKey: 'msgTemplateDetail.fields.msgType', key: 'msgTypeDictCode' },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.locale', key: 'localeDictCode' },
    { labelKey: 'msgTemplateDetail.fields.receiverGroup', key: 'receiverGroupCode' },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.title', key: 'title', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.content', key: 'content', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.defaultActive', key: 'defaultActive', type: 'boolean' },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.defaultTitle', key: 'defaultTitle', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgTemplateDetail.fields.defaultContent', key: 'defaultContent', valueSpan: 3 },
  ],
];

class MsgTemplateDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'msg/template';
  }

  /** sendType is the fixed code auto/manual (not a dict); derive a localized display field for it. */
  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      const code = data.sendTypeDictCode;
      data._sendTypeText = code ? this.tr('msgTemplateCommon.sendType.' + code) : null;
      this.state.detail = data;
    } else {
      this.state.detail = null;
    }
    if (this.showAfterLoadData()) this.render();
  }
}

export default defineComponent({
  name: 'MsgTemplateDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new MsgTemplateDetailPage(props, context)) as MsgTemplateDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'msgTemplateDetail.empty',
      yesNoKey: 'msgTemplateList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
