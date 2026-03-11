<!-- 域名详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="domainDetail.title"
    empty-key="domainDetail.empty"
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
import { backendRequest } from '../../../utils/backendRequest';
import { ElMessage } from 'element-plus';

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'domainDetail.sections.basicInfo' },
  { start: 3, titleKey: 'domainDetail.sections.audit' },
  { start: 5, titleKey: 'domainDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'domainDetail.fields.id', key: 'id' },
    { labelKey: 'domainDetail.fields.domain', key: 'domain' },
  ],
  [
    { labelKey: 'domainDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'domainDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'domainDetail.fields.tenantName', key: 'tenantName' },
  ],
  [
    { labelKey: 'domainDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'domainDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'domainDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'domainDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'domainDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'domainDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'domainDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DomainDetailPage extends BaseDetailPage {
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
    return 'sys/domain';
  }

  protected createDetailLoadParams(): Record<string, unknown> {
    return { id: String(this.state.rid || this.props.rid || ''), pageNo: 1, pageSize: 1 };
  }

  protected async loadData(): Promise<void> {
    const params = this.createDetailLoadParams();
    const result = await backendRequest({ url: this.getDetailLoadUrl(), method: 'get', params });
    if (result != null && typeof result === 'object' && !Array.isArray(result)) {
      this.postLoadDataSuccessfully(result as Record<string, unknown>);
    } else {
      ElMessage.error('数据加载失败！');
    }
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
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
  name: 'DomainDetail',
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
    const page = reactive(new DomainDetailPage(props, context)) as DomainDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'domainDetail.empty',
      yesNoKey: 'domainList.common',
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
