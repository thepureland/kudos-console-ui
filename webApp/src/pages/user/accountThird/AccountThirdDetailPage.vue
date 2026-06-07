<!-- Account-third detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accountThirdDetail.title"
    empty-key="accountThirdDetail.empty"
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

/**
 * Section headers for the detail dialog.
 * `start` is the ROW_FIELDS row index at which each section begins.
 *   0  basicInfo  — rows 0-2  (id/userId, provider, subject/unionId)
 *   3  external   — rows 3-5  (displayName/email, avatarUrl, lastLoginTime/tenantId)
 *   6  audit      — rows 6-7  (timestamps, create/update users)
 *   8  otherInfo  — rows 8-9  (active/builtIn flags, remark)
 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accountThirdDetail.sections.basicInfo' },
  { start: 3, titleKey: 'accountThirdDetail.sections.external' },
  { start: 6, titleKey: 'accountThirdDetail.sections.audit' },
  { start: 8, titleKey: 'accountThirdDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accountThirdDetail.fields.id', key: 'id' },
    { labelKey: 'accountThirdDetail.fields.userId', key: 'userId' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.provider', key: 'accountProviderDictCode' },
    { labelKey: 'accountThirdDetail.fields.providerIssuer', key: 'accountProviderIssuer' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.subject', key: 'subject' },
    { labelKey: 'accountThirdDetail.fields.unionId', key: 'unionId' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.externalDisplayName', key: 'externalDisplayName' },
    { labelKey: 'accountThirdDetail.fields.externalEmail', key: 'externalEmail' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.avatarUrl', key: 'avatarUrl', valueSpan: 3 },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.lastLoginTime', key: 'lastLoginTime', type: 'date' },
    { labelKey: 'accountThirdDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'accountThirdDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'accountThirdDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'accountThirdDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'accountThirdDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class AccountThirdDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/accountThird';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      // Normalise optional fields to stable falsy values so the detail
      // renderer never receives `undefined` (which it treats differently
      // from an explicit null/empty string/false).
      if (data.createTime == null) data.createTime = null;
      if (data.updateTime == null) data.updateTime = null;
      if (data.lastLoginTime == null) data.lastLoginTime = null;
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
  name: 'AccountThirdDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    // Cast required so Vue's reactive proxy satisfies both the class and the
    // view-model interface used by the composables below.
    const page = reactive(new AccountThirdDetailPage(props, context)) as AccountThirdDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accountThirdDetail.empty',
      yesNoKey: 'accountThirdList.common',
    });
    useDetailPageRidSync(props, page);
    return { ...pageRefs, ...stateRefs, rowsWithSections, formatFieldValue };
  },
});
</script>
