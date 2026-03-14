<!-- 参数详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="paramDetail.title"
    empty-key="paramDetail.empty"
    width="70%"
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
  { start: 0, titleKey: 'paramDetail.sections.basicInfo' },
  { start: 3, titleKey: 'paramDetail.sections.audit' },
  { start: 5, titleKey: 'paramDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'paramDetail.fields.id', key: 'id' },
    { labelKey: 'paramDetail.fields.paramName', key: 'paramName' },
  ],
  [
    { labelKey: 'paramDetail.fields.paramValue', key: 'paramValue' },
    { labelKey: 'paramDetail.fields.defaultValue', key: 'defaultValue' },
  ],
  [
    { labelKey: 'paramDetail.fields.seqNo', key: 'seqNo' },
    { labelKey: 'paramDetail.fields.module', key: 'module', type: 'atomicService' },
  ],
  [
    { labelKey: 'paramDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'paramDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'paramDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'paramDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'paramDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'paramDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'paramDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class ParamDetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected getRootActionPath(): string {
    return 'sys/param';
  }

  protected createDetailLoadParams(): Record<string, unknown> {
    return { id: String(this.state.rid || this.props.rid || '') };
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.createTime == null) data.createTime = null;
      if (data.updateTime == null) data.updateTime = null;
      if (data.createUser == null) data.createUser = '';
      if (data.updateUser == null) data.updateUser = '';
      if (data.builtIn == null) data.builtIn = false;
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
  name: 'ParamDetail',
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
    const page = reactive(new ParamDetailPage(props, context)) as ParamDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'paramDetail.empty',
      yesNoKey: 'paramList.common',
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
