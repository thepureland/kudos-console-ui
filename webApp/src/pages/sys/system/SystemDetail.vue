<!-- 系统详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="systemDetail.title"
    empty-key="systemDetail.empty"
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
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'sys/system';
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
  name: 'SystemDetail',
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
    const page = reactive(new SystemDetailPage(props, context)) as SystemDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'systemDetail.empty',
      yesNoKey: 'systemList.common',
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
