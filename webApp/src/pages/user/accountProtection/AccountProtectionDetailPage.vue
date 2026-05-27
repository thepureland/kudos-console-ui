<!-- Account protection detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accountProtectionDetail.title"
    empty-key="accountProtectionDetail.empty"
    width="70%"
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
  { start: 0, titleKey: 'accountProtectionDetail.sections.basicInfo' },
  { start: 2, titleKey: 'accountProtectionDetail.sections.questions' },
  { start: 5, titleKey: 'accountProtectionDetail.sections.counters' },
  { start: 7, titleKey: 'accountProtectionDetail.sections.audit' },
  { start: 9, titleKey: 'accountProtectionDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accountProtectionDetail.fields.id', key: 'id' },
    { labelKey: 'accountProtectionDetail.fields.userId', key: 'userId' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.safeContactWayId', key: 'safeContactWayId' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.question1', key: 'question1' },
    { labelKey: 'accountProtectionDetail.fields.answer1', key: 'answer1' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.question2', key: 'question2' },
    { labelKey: 'accountProtectionDetail.fields.answer2', key: 'answer2' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.question3', key: 'question3' },
    { labelKey: 'accountProtectionDetail.fields.answer3', key: 'answer3' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.totalValidateCount', key: 'totalValidateCount' },
    { labelKey: 'accountProtectionDetail.fields.matchQuestionCount', key: 'matchQuestionCount' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.errorTimes', key: 'errorTimes' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'accountProtectionDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'accountProtectionDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'accountProtectionDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'accountProtectionDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class AccountProtectionDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/accountProtection';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.createTime == null) data.createTime = null;
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
  name: 'AccountProtectionDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new AccountProtectionDetailPage(props, context)) as AccountProtectionDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accountProtectionDetail.empty',
      yesNoKey: 'accountProtectionList.common',
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
