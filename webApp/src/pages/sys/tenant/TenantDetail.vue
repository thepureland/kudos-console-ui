<!-- 租户详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="tenantDetail.title"
    empty-key="tenantDetail.empty"
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
import { backendRequest } from '../../../utils/backendRequest';
import { ElMessage } from 'element-plus';

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'tenantDetail.sections.basicInfo' },
  { start: 2, titleKey: 'tenantDetail.sections.audit' },
  { start: 4, titleKey: 'tenantDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'tenantDetail.fields.id', key: 'id' },
    { labelKey: 'tenantDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'tenantDetail.fields.subSystemCodes', key: 'subSystemCodes' },
  ],
  [
    { labelKey: 'tenantDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'tenantDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'tenantDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'tenantDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'tenantDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'tenantDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'tenantDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class TenantDetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  /** 详情接口：sys/tenant/getDetail，按 id 取一条 */
  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected async loadData(): Promise<void> {
    const params = this.createDetailLoadParams();
    const result = await backendRequest({ url: this.getDetailLoadUrl(), params });
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
  name: 'TenantDetail',
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
    const page = reactive(new TenantDetailPage(props, context)) as TenantDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue: baseFormatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'tenantDetail.empty',
      yesNoKey: 'tenantList.common',
    });
    function formatFieldValue(field: FieldConfig): string {
      if (field.key === 'subSystemCodes') {
        const val = page.state.detail?.[field.key];
        if (Array.isArray(val)) return val.map((c) => page.transAtomicService(String(c ?? ''))).filter(Boolean).join(', ');
        if (val != null && val !== '') return page.transAtomicService(String(val));
        return '';
      }
      return baseFormatFieldValue(field);
    }

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
