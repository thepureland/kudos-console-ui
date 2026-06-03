<!-- Message receiver-group detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="msgReceiverGroupDetail.title"
    empty-key="msgReceiverGroupDetail.empty"
    width="62%"
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
  { start: 0, titleKey: 'msgReceiverGroupDetail.sections.basicInfo' },
  { start: 3, titleKey: 'msgReceiverGroupDetail.sections.audit' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'msgReceiverGroupDetail.fields.id', key: 'id' },
    { labelKey: 'msgReceiverGroupDetail.fields.receiverGroupTypeDictCode', key: 'receiverGroupTypeDictCode', type: 'dict', dictModule: 'msg', dictCode: 'receiver_group_type' },
  ],
  [
    { labelKey: 'msgReceiverGroupDetail.fields.defineTable', key: 'defineTable' },
    { labelKey: 'msgReceiverGroupDetail.fields.nameColumn', key: 'nameColumn' },
  ],
  [
    { labelKey: 'msgReceiverGroupDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'msgReceiverGroupDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'msgReceiverGroupDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
  [
    { labelKey: 'msgReceiverGroupDetail.fields.createUserName', key: 'createUserName' },
    { labelKey: 'msgReceiverGroupDetail.fields.createTime', key: 'createTime', type: 'date' },
  ],
  [
    { labelKey: 'msgReceiverGroupDetail.fields.updateUserName', key: 'updateUserName' },
    { labelKey: 'msgReceiverGroupDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
];

class MsgReceiverGroupDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'msg/receiverGroup';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['receiver_group_type'], atomicServiceCode: 'msg' }];
  }

  protected async preLoad(): Promise<void> {
    await this.loadDictsBatch([{ dictTypes: ['receiver_group_type'], atomicServiceCode: 'msg' }]);
  }
}

export default defineComponent({
  name: 'MsgReceiverGroupDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new MsgReceiverGroupDetailPage(props, context)) as MsgReceiverGroupDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'msgReceiverGroupDetail.empty',
      yesNoKey: 'msgReceiverGroupList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
