<!-- 组详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="userGroupDetail.title"
    empty-key="userGroupDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, watch } from 'vue';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/** 与 CacheDetail 一致：每行最多 2 个字段；其他信息放最后，备注接在内置后面。 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'userGroupDetail.sections.basicInfo' },
  { start: 2, titleKey: 'userGroupDetail.sections.audit' },
  { start: 4, titleKey: 'userGroupDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'userGroupDetail.fields.id', key: 'id' },
    { labelKey: 'userGroupDetail.fields.groupCode', key: 'groupCode' },
  ],
  [
    { labelKey: 'userGroupDetail.fields.groupName', key: 'groupName' },
    { labelKey: 'userGroupDetail.fields.active', key: 'active', type: 'boolean' },
  ],
  [
    { labelKey: 'userGroupDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'userGroupDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'userGroupDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'userGroupDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'userGroupDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'userGroupDetail.fields.ownerId', key: 'ownerId' },
  ],
  [
    { labelKey: 'userGroupDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
    { labelKey: 'userGroupDetail.fields.remark', key: 'remark' },
  ],
];

class UserGroupDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'rbac/group';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }
}

export default defineComponent({
  name: 'UserGroupDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new UserGroupDetailPage(props, context)) as UserGroupDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'userGroupDetail.empty',
      yesNoKey: 'userGroupList.common',
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
