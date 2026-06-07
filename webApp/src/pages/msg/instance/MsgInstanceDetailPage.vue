<!-- Message instance detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="msgInstanceDetail.title"
    empty-key="msgInstanceDetail.empty"
    width="66%"
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
  { start: 0, titleKey: 'msgInstanceDetail.sections.routing' },
  { start: 4, titleKey: 'msgInstanceDetail.sections.content' },
  { start: 6, titleKey: 'msgInstanceDetail.sections.validity' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'msgInstanceDetail.fields.id', key: 'id' },
    { labelKey: 'msgInstanceDetail.fields.sendType', key: '_sendTypeText' },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.eventType', key: 'eventTypeDictCode' },
    { labelKey: 'msgInstanceDetail.fields.msgType', key: 'msgTypeDictCode' },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.locale', key: 'localeDictCode' },
    { labelKey: 'msgInstanceDetail.fields.templateId', key: 'templateId' },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.title', key: 'title', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.content', key: 'content', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgInstanceDetail.fields.validTimeStart', key: 'validTimeStart', type: 'date' },
    { labelKey: 'msgInstanceDetail.fields.validTimeEnd', key: 'validTimeEnd', type: 'date' },
  ],
];

class MsgInstanceDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'msg/instance';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      // Translate the raw dict code into a display-friendly string and expose it
      // as a synthetic "_sendTypeText" field so the detail rows can reference it directly.
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
  name: 'MsgInstanceDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new MsgInstanceDetailPage(props, context)) as MsgInstanceDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'msgInstanceDetail.empty',
      yesNoKey: 'msgInstanceList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
