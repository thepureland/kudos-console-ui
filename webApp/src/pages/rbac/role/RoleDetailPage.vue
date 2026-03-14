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
import { defineComponent, reactive, toRefs, watch, computed } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';

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
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'rbac/role';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }
}

export default defineComponent({
  name: 'RoleDetailPage',
  components: { SectionedDetailDialog },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const page = reactive(new RoleDetailPage(props, context)) as RoleDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'roleDetail.empty',
      yesNoKey: 'roleList.common',
    });

    watch(
      () => props.rid,
      (newRid, oldRid) => {
        const id = newRid ? String(newRid) : '';
        page.state.rid = id;
        if (oldRid !== undefined && id && id !== String(oldRid)) {
          page.state.detail = null;
          page.loadData();
        }
      }
    );

    const visible = computed(() => props.modelValue as boolean);
    function close() {
      context.emit('update:modelValue', false);
    }

    return {
      ...toRefs(page),
      ...toRefs(page.state),
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
