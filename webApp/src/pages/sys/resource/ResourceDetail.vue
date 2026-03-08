<!-- 资源详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="resourceDetail.title"
    empty-key="resourceDetail.empty"
    width="65%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, watch } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';
import { Pair } from '../../../components/model/Pair';

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'resourceDetail.sections.basicInfo' },
  { start: 5, titleKey: 'resourceDetail.sections.audit' },
  { start: 7, titleKey: 'resourceDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'resourceDetail.fields.id', key: 'id' },
    { labelKey: 'resourceDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'resourceDetail.fields.url', key: 'url' },
    { labelKey: 'resourceDetail.fields.seqNo', key: 'seqNo' },
  ],
  [
    { labelKey: 'resourceDetail.fields.icon', key: 'icon' },
    { labelKey: 'resourceDetail.fields.resourceTypeDictCode', key: 'resourceTypeDictCode', type: 'dict', dictModule: 'kuark:sys', dictCode: 'resource_type' },
  ],
  [
    { labelKey: 'resourceDetail.fields.parentId', key: 'parentId' },
    { labelKey: 'resourceDetail.fields.subSysDictCode', key: 'subSysDictCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'resourceDetail.fields.ownerId', key: 'ownerId' },
  ],
  [
    { labelKey: 'resourceDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'resourceDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'resourceDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'resourceDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'resourceDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'resourceDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'resourceDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
    await this.loadDicts(['resource_type'], 'kuark:sys');
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }
}

export default defineComponent({
  name: 'ResourceDetail',
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
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'resourceDetail.empty',
      yesNoKey: 'resourceList.common',
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

    return {
      ...toRefs(page),
      ...toRefs(page.state),
      rowsWithSections,
      formatFieldValue,
    };
  },
});
</script>
