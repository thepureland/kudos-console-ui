<!-- Message receive detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="msgReceiveDetail.title"
    empty-key="msgReceiveDetail.empty"
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
  { start: 0, titleKey: 'msgReceiveDetail.sections.basicInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'msgReceiveDetail.fields.id', key: 'id' },
    { labelKey: 'msgReceiveDetail.fields.receiveStatus', key: 'receiveStatusDictCode', type: 'dict', dictModule: 'msg', dictCode: 'receive_status' },
  ],
  [
    { labelKey: 'msgReceiveDetail.fields.receiverId', key: 'receiverId' },
    { labelKey: 'msgReceiveDetail.fields.sendId', key: 'sendId' },
  ],
  [
    { labelKey: 'msgReceiveDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'msgReceiveDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'msgReceiveDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
];

class MsgReceiveDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'msg/receive';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['receive_status'], atomicServiceCode: 'msg' }];
  }

  protected async preLoad(): Promise<void> {
    await this.loadDictsBatch([{ dictTypes: ['receive_status'], atomicServiceCode: 'msg' }]);
  }
}

export default defineComponent({
  name: 'MsgReceiveDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new MsgReceiveDetailPage(props, context)) as MsgReceiveDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'msgReceiveDetail.empty',
      yesNoKey: 'msgReceiveList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
