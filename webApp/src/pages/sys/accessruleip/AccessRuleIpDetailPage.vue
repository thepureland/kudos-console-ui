<!--
 * IP 访问规则详情（sys/accessRuleIp/getDetail）。
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accessRuleIpDetail.title"
    empty-key="accessRuleIpDetail.empty"
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
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accessRuleIpDetail.sections.basicInfo' },
  { start: 3, titleKey: 'accessRuleIpDetail.sections.audit' },
  { start: 5, titleKey: 'accessRuleIpDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accessRuleIpDetail.fields.id', key: 'id' },
    { labelKey: 'accessRuleIpDetail.fields.parentRuleId', key: 'parentRuleId' },
  ],
  [
    { labelKey: 'accessRuleIpDetail.fields.ipStart', key: 'ipStart' },
    { labelKey: 'accessRuleIpDetail.fields.ipEnd', key: 'ipEnd' },
  ],
  [
    { labelKey: 'accessRuleIpDetail.fields.ipType', key: 'ipType' },
    { labelKey: 'accessRuleIpDetail.fields.expirationDate', key: 'expirationDate', type: 'date' },
  ],
  [
    { labelKey: 'accessRuleIpDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'accessRuleIpDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'accessRuleIpDetail.fields.createUser', key: 'createUserName' },
    { labelKey: 'accessRuleIpDetail.fields.updateUser', key: 'updateUserName' },
  ],
  [
    { labelKey: 'accessRuleIpDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'accessRuleIpDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class AccessRuleIpDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/accessRuleIp';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.createTime == null) data.createTime = null;
      if (data.updateTime == null) data.updateTime = null;
      if (data.createUserName == null) data.createUserName = '';
      if (data.updateUserName == null) data.updateUserName = '';
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
  name: 'AccessRuleIpDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new AccessRuleIpDetailPage(props, context)) as AccessRuleIpDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accessRuleIpDetail.empty',
      yesNoKey: 'accessRuleIpList.common',
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
