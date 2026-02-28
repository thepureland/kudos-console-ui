<!-- 数据源详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="dataSourceDetail.title"
    empty-key="dataSourceDetail.empty"
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
  { start: 0, titleKey: 'dataSourceDetail.sections.basicInfo' },
  { start: 4, titleKey: 'dataSourceDetail.sections.config' },
  { start: 7, titleKey: 'dataSourceDetail.sections.audit' },
  { start: 9, titleKey: 'dataSourceDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'dataSourceDetail.fields.id', key: 'id' },
    { labelKey: 'dataSourceDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.url', key: 'url' },
    { labelKey: 'dataSourceDetail.fields.subSysDictCode', key: 'subSysDictCode', type: 'atomicService' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.username', key: 'username' },
    { labelKey: 'dataSourceDetail.fields.password', key: 'password' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.tenantId', key: 'tenantId' },
    { labelKey: 'dataSourceDetail.fields.tenantName', key: 'tenantName' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.initialSize', key: 'initialSize' },
    { labelKey: 'dataSourceDetail.fields.maxActive', key: 'maxActive' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.maxIdle', key: 'maxIdle' },
    { labelKey: 'dataSourceDetail.fields.minIdle', key: 'minIdle' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.maxWait', key: 'maxWait' },
    { labelKey: 'dataSourceDetail.fields.maxAge', key: 'maxAge' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'dataSourceDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'dataSourceDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'dataSourceDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'dataSourceDetail.fields.remark', key: 'remark', valueSpan: 3 },
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
  }

  protected getRootActionPath(): string {
    return 'sys/dataSource';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }
}

export default defineComponent({
  name: 'DataSourceDetail',
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
      emptyKey: 'dataSourceDetail.empty',
      yesNoKey: 'dataSourceList.common',
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
