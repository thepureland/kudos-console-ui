<!--
 * Combined "access rule + IP" detail (sys/accessRuleIp/getAccessRuleWithIp).
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accessRuleWithIpDetail.title"
    empty-key="accessRuleWithIpDetail.empty"
    width="80%"
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
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/**
 * Section dividers for the detail dialog.
 * Each `start` index maps to the first row index in ROW_FIELDS that belongs to that section.
 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accessRuleWithIpDetail.sections.rule' },
  { start: 4, titleKey: 'accessRuleWithIpDetail.sections.ip' },
  { start: 8, titleKey: 'accessRuleWithIpDetail.sections.audit' },
];

/**
 * Two-column field layout for the dialog body.
 * Rows 0-3: access rule fields; rows 4-7: IP entry fields; row 8: audit/remark.
 */
const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accessRuleWithIpDetail.fields.id', key: 'id' },
    { labelKey: 'accessRuleWithIpDetail.fields.parentId', key: 'parentId' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.tenantId', key: 'tenantId' },
    { labelKey: 'accessRuleWithIpDetail.fields.systemCode', key: 'systemCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.accessRuleTypeDictCode', key: 'accessRuleTypeDictCode' },
    { labelKey: 'accessRuleWithIpDetail.fields.parentActive', key: 'parentActive', type: 'boolean' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.parentRemark', key: 'parentRemark', valueSpan: 3 },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.ipId', key: 'ipId' },
    { labelKey: 'accessRuleWithIpDetail.fields.ipStart', key: 'ipStart' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.ipEnd', key: 'ipEnd' },
    { labelKey: 'accessRuleWithIpDetail.fields.ipTypeDictCode', key: 'ipTypeDictCode' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.expirationTime', key: 'expirationTime', type: 'date' },
    { labelKey: 'accessRuleWithIpDetail.fields.active', key: 'active', type: 'boolean' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.parentCreateTime', key: 'parentCreateTime', type: 'date' },
    { labelKey: 'accessRuleWithIpDetail.fields.parentUpdateTime', key: 'parentUpdateTime', type: 'date' },
  ],
  [
    { labelKey: 'accessRuleWithIpDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class AccessRuleWithIpDetailPage extends BaseDetailPage {
  protected async preLoad(): Promise<void> {
    // The systemCode field renders as an atomic-service label, so the lookup map must be populated first.
    await this.loadAtomicServices();
  }

  protected getRootActionPath(): string {
    return 'sys/accessRuleIp';
  }

  protected getDetailLoadUrl(): string {
    return 'sys/accessRuleIp/getAccessRuleWithIp';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    this.state.detail = data ?? null;
    if (this.showAfterLoadData()) {
      this.render();
    }
  }
}

export default defineComponent({
  name: 'AccessRuleWithIpDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new AccessRuleWithIpDetailPage(props, context)) as AccessRuleWithIpDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accessRuleWithIpDetail.empty',
      yesNoKey: 'accessRuleWithIpList.common',
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
