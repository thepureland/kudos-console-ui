<!-- Message send (batch) detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="msgSendDetail.title"
    empty-key="msgSendDetail.empty"
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

// Section boundaries reference ROW_FIELDS indices.
// start:0 = rows 0-3 (id/status, receiverGroup, instance/msgType, locale/tenant).
// start:4 = rows 4-6 (success/fail counts, jobId, timestamps).
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'msgSendDetail.sections.basicInfo' },
  { start: 4, titleKey: 'msgSendDetail.sections.result' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'msgSendDetail.fields.id', key: 'id' },
    { labelKey: 'msgSendDetail.fields.sendStatus', key: 'sendStatusDictCode', type: 'dict', dictModule: 'msg', dictCode: 'send_status' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.receiverGroupType', key: 'receiverGroupTypeDictCode', type: 'dict', dictModule: 'msg', dictCode: 'receiver_group_type' },
    { labelKey: 'msgSendDetail.fields.receiverGroupId', key: 'receiverGroupId' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.instanceId', key: 'instanceId' },
    { labelKey: 'msgSendDetail.fields.msgType', key: 'msgTypeDictCode' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.locale', key: 'localeDictCode' },
    { labelKey: 'msgSendDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.successCount', key: 'successCount' },
    { labelKey: 'msgSendDetail.fields.failCount', key: 'failCount' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.jobId', key: 'jobId' },
  ],
  [
    { labelKey: 'msgSendDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'msgSendDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
];

class MsgSendDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'msg/send';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['send_status', 'receiver_group_type'], atomicServiceCode: 'msg' }];
  }

  protected async preLoad(): Promise<void> {
    await this.loadDictsBatch([{ dictTypes: ['send_status', 'receiver_group_type'], atomicServiceCode: 'msg' }]);
  }
}

export default defineComponent({
  name: 'MsgSendDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new MsgSendDetailPage(props, context)) as MsgSendDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'msgSendDetail.empty',
      yesNoKey: 'msgSendList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
