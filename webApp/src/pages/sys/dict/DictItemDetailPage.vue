<!-- 字典项详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="dictItemDetail.title"
    empty-key="dictItemDetail.empty"
    width="67%"
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

/** 分组：基本信息、审计信息、其他信息 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'dictItemDetail.sections.basicInfo' },
  { start: 3, titleKey: 'dictItemDetail.sections.audit' },
  { start: 5, titleKey: 'dictItemDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'dictItemDetail.fields.id', key: 'id' },
    { labelKey: 'dictItemDetail.fields.dictId', key: 'dictId' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.itemCode', key: 'itemCode' },
    { labelKey: 'dictItemDetail.fields.itemName', key: 'itemName' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.parentId', key: 'parentId' },
    { labelKey: 'dictItemDetail.fields.seqNo', key: 'seqNo' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'dictItemDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'dictItemDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
    { labelKey: 'dictItemDetail.fields.active', key: 'active', type: 'boolean' },
  ],
  [
    { labelKey: 'dictItemDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DictItemDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/dictItem';
  }
}

export default defineComponent({
  name: 'DictItemDetailPage',
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
    const page = reactive(new DictItemDetailPage(props, context)) as DictItemDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'dictItemDetail.empty',
      yesNoKey: 'dictList.common',
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
