<!-- 系统详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="systemDetail.title"
    empty-key="systemDetail.empty"
    width="67%"
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

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'systemDetail.sections.basicInfo' },
  { start: 2, titleKey: 'systemDetail.sections.audit' },
  { start: 4, titleKey: 'systemDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'systemDetail.fields.id', key: 'id' },
    { labelKey: 'systemDetail.fields.code', key: 'code' },
  ],
  [
    { labelKey: 'systemDetail.fields.name', key: 'name' },
    { labelKey: 'systemDetail.fields.parentCode', key: 'parentCode' },
  ],
  [
    { labelKey: 'systemDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'systemDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'systemDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'systemDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'systemDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'systemDetail.fields.subSystem', key: 'subSystem', type: 'boolean' },
  ],
  [
    { labelKey: 'systemDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
    { labelKey: 'systemDetail.fields.remark', key: 'remark', valueSpan: 2 },
  ],
];

class SystemDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/system';
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.createTime == null) data.createTime = null;
      if (data.updateTime == null) data.updateTime = null;
      if (data.createUser == null) data.createUser = '';
      if (data.updateUser == null) data.updateUser = '';
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
  name: 'SystemDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new SystemDetailPage(props, context)) as SystemDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'systemDetail.empty',
      yesNoKey: 'systemList.common',
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
