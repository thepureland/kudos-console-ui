<!-- 组织机构详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="organizationDetail.title"
    empty-key="organizationDetail.empty"
    width="65%"
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

/** 与 CacheDetail 一致：每行最多 2 个字段；其他信息放最后，备注单独一行。 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'organizationDetail.sections.basicInfo' },
  { start: 2, titleKey: 'organizationDetail.sections.audit' },
  { start: 4, titleKey: 'organizationDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'organizationDetail.fields.id', key: 'id' },
    { labelKey: 'organizationDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'organizationDetail.fields.abbrName', key: 'abbrName' },
    { labelKey: 'organizationDetail.fields.orgTypeDictCode', key: 'orgTypeDictCode' },
  ],
  [
    { labelKey: 'organizationDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'organizationDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'organizationDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'organizationDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'organizationDetail.fields.subSysDictCode', key: 'subSysDictCode', type: 'atomicService' },
    { labelKey: 'organizationDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'organizationDetail.fields.tenantName', key: 'tenantName' },
    { labelKey: 'organizationDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'organizationDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'organizationDetail.fields.remark', key: 'remark' },
  ],
];

class DetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'user/organization';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }
}

export default defineComponent({
  name: 'OrganizationDetail',
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
    const page = reactive(new DetailPage(props, context)) as DetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'organizationDetail.empty',
      yesNoKey: 'organizationList.common',
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
