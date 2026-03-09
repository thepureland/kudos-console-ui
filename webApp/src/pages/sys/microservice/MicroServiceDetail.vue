<!-- 微服务详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="microServiceDetail.title"
    empty-key="microServiceDetail.empty"
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

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'microServiceDetail.sections.basicInfo' },
  { start: 3, titleKey: 'microServiceDetail.sections.audit' },
  { start: 5, titleKey: 'microServiceDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'microServiceDetail.fields.id', key: 'id' },
    { labelKey: 'microServiceDetail.fields.code', key: 'code' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.name', key: 'name' },
    { labelKey: 'microServiceDetail.fields.parentCode', key: 'parentCode' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.context', key: 'context' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'microServiceDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'microServiceDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'microServiceDetail.fields.atomicService', key: 'atomicService', type: 'boolean' },
  ],
  [
    { labelKey: 'microServiceDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
    { labelKey: 'microServiceDetail.fields.remark', key: 'remark', valueSpan: 2 },
  ],
];

class MicroServiceDetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'sys/microService';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
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
  name: 'MicroServiceDetail',
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
    const page = reactive(new MicroServiceDetailPage(props, context)) as MicroServiceDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'microServiceDetail.empty',
      yesNoKey: 'microServiceList.common',
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
