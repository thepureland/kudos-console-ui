<!-- Contact way detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="contactWayDetail.title"
    empty-key="contactWayDetail.empty"
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

// Each `start` is a zero-based index into ROW_FIELDS that begins a new section header.
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'contactWayDetail.sections.basicInfo' },
  { start: 3, titleKey: 'contactWayDetail.sections.audit' },
  { start: 5, titleKey: 'contactWayDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'contactWayDetail.fields.id', key: 'id' },
    { labelKey: 'contactWayDetail.fields.userId', key: 'userId' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.contactWayDictCode', key: 'contactWayDictCode' },
    { labelKey: 'contactWayDetail.fields.contactWayStatusDictCode', key: 'contactWayStatusDictCode' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.contactWayValue', key: 'contactWayValue', valueSpan: 3 },
  ],
  [
    { labelKey: 'contactWayDetail.fields.priority', key: 'priority' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'contactWayDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'contactWayDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'contactWayDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'contactWayDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class ContactWayDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/contactWay';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      // Normalise optional fields that may be absent from the API response so the
      // detail template always receives well-typed values (never undefined).
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
    if (this.showAfterLoadData()) this.render();
  }
}

export default defineComponent({
  name: 'ContactWayDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new ContactWayDetailPage(props, context)) as ContactWayDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'contactWayDetail.empty',
      yesNoKey: 'contactWayList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
