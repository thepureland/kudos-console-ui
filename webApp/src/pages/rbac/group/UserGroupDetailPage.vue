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
import { defineComponent, reactive, toRefs, watch, computed } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';

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
    const page = reactive(new UserGroupDetailPage(props, context)) as UserGroupDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'userGroupDetail.empty',
      yesNoKey: 'userGroupList.common',
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
