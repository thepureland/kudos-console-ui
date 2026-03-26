<!-- 角色详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="roleDetail.title"
    empty-key="roleDetail.empty"
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

/** 与 CacheDetail 一致：每行最多 2 个字段；其他信息放最后，备注接在启用后面。 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'roleDetail.sections.basicInfo' },
  { start: 2, titleKey: 'roleDetail.sections.audit' },
  { start: 4, titleKey: 'roleDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'roleDetail.fields.id', key: 'id' },
    { labelKey: 'roleDetail.fields.roleCode', key: 'roleCode' },
  ],
  [
    { labelKey: 'roleDetail.fields.roleName', key: 'roleName' },
  ],
  [
    { labelKey: 'roleDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'roleDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'roleDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'roleDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'roleDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'roleDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'roleDetail.fields.tenantName', key: 'tenantName' },
    { labelKey: 'roleDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'roleDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'roleDetail.fields.remark', key: 'remark' },
  ],
];

class RoleDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'rbac/role';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }
}

export default defineComponent({
  name: 'RoleDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new RoleDetailPage(props, context)) as RoleDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'roleDetail.empty',
      yesNoKey: 'roleList.common',
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
