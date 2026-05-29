<!--
 * Audit log detail dialog.
 *
 * Loads via sys/auditLog/getDetail which should return a flattened combination of
 * SysAuditLogVo (main table) + SysAuditDetailLogVo (detail table), joined on audit_id.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="auditLogDetail.title"
    empty-key="auditLogDetail.empty"
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
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel, FieldConfig, SectionConfig } from '../../../components/pages/detail';

const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'auditLogDetail.sections.summary' },
  { start: 3, titleKey: 'auditLogDetail.sections.context' },
  { start: 6, titleKey: 'auditLogDetail.sections.client' },
  { start: 8, titleKey: 'auditLogDetail.sections.payload' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'auditLogDetail.fields.id', key: 'id' },
    { labelKey: 'auditLogDetail.fields.operateTime', key: 'operateTime', type: 'date' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.operator', key: 'operator' },
    { labelKey: 'auditLogDetail.fields.operatorId', key: 'operatorId' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.operatorUserType', key: 'operatorUserType' },
    { labelKey: 'auditLogDetail.fields.requestType', key: 'requestType' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.moduleName', key: 'moduleName' },
    { labelKey: 'auditLogDetail.fields.moduleCode', key: 'moduleCode' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.operateType', key: 'operateType' },
    { labelKey: 'auditLogDetail.fields.entityId', key: 'entityId' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.tenantId', key: 'tenantId' },
    { labelKey: 'auditLogDetail.fields.subSysCode', key: 'subSysCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.operateIp', key: 'operateIp' },
    { labelKey: 'auditLogDetail.fields.operateIpDictCode', key: 'operateIpDictCode' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.clientOs', key: 'clientOs' },
    { labelKey: 'auditLogDetail.fields.clientBrowser', key: 'clientBrowser' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.description', key: 'description' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.operateUrl', key: 'operateUrl' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.stringParams', key: 'stringParams' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.objectParams', key: 'objectParams' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.requestFormData', key: 'requestFormData' },
  ],
  [
    { labelKey: 'auditLogDetail.fields.requestReferer', key: 'requestReferer' },
  ],
];

class AuditLogDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/auditLog';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }
}

export default defineComponent({
  name: 'AuditLogDetailPage',
  components: { SectionedDetailDialog },
  props: { ...commonDetailDialogProps },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new AuditLogDetailPage(props, context)) as AuditLogDetailPage & DetailPageViewModel;
    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'auditLogDetail.empty',
      yesNoKey: 'auditLogList.common',
    });
    useDetailPageRidSync(props, page);
    const { visible, close } = useDetailDialogVisibility(props, context);
    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
