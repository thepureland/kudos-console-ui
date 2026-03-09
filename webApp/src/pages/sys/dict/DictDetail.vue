<!-- 字典类型详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="dictDetail.title"
    empty-key="dictDetail.empty"
    width="65%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  >
    <div v-if="(tableData?.length ?? 0) > 0" class="dict-detail-items-section">
      <div class="dict-detail-items-title">
        <span class="dict-detail-items-title-text">{{ t('dictDetail.sections.dictItems') }}</span>
      </div>
      <el-table border stripe :data="tableData" max-height="400" :header-cell-style="{ textAlign: 'center' }">
        <el-table-column type="index" width="50" :label="''" />
        <el-table-column prop="itemCode" width="150" :label="t('dictDetail.table.itemCode')" />
        <el-table-column prop="itemName" width="150" :label="t('dictDetail.table.itemName')" />
        <el-table-column prop="seqNo" width="70" :label="t('dictDetail.table.seqNo')" />
        <el-table-column prop="active" width="70" :label="t('dictDetail.table.active')">
          <template #default="scope">
            {{ scope.row.active ? t('dictList.common.yes') : t('dictList.common.no') }}
          </template>
        </el-table-column>
        <el-table-column prop="builtIn" width="70" :label="t('dictDetail.table.builtIn')">
          <template #default="scope">
            {{ scope.row.builtIn ? t('dictList.common.yes') : t('dictList.common.no') }}
          </template>
        </el-table-column>
        <el-table-column width="155" :label="t('dictDetail.table.createTime')">
          <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column prop="remark" min-width="120" :label="t('dictDetail.table.remark')" show-overflow-tooltip />
      </el-table>
    </div>
  </SectionedDetailDialog>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n } from '../../../i18n';

/** 分组：基本信息、审计信息、其他信息 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'dictDetail.sections.basicInfo' },
  { start: 3, titleKey: 'dictDetail.sections.audit' },
  { start: 5, titleKey: 'dictDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'dictDetail.fields.id', key: 'id' },
    { labelKey: 'dictDetail.fields.dictType', key: 'dictType' },
  ],
  [
    { labelKey: 'dictDetail.fields.dictName', key: 'dictName' },
    { labelKey: 'dictDetail.fields.module', key: 'module', type: 'atomicService' },
  ],
  [
    { labelKey: 'dictDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'dictDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'dictDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'dictDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'dictDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'dictDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DictDetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected initState(): Record<string, unknown> {
    return {
      ...super.initBaseState(),
      tableData: [] as Record<string, unknown>[],
    };
  }

  protected async preLoad(): Promise<void> {
    await this.loadDicts(['module'], 'kuark:sys');
  }

  protected getRootActionPath(): string {
    return 'sys/dict';
  }

  /** 字典详情用 getDict 接口（与 mock/后端一致），参数 id + isDict=true */
  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/getDict';
  }

  /** 始终用 state.rid 请求详情 */
  protected createDetailLoadParams(): Record<string, unknown> {
    return { id: String(this.state.rid || this.props.rid || ''), isDict: true };
  }

  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.id == null && data.dictId != null) data.id = data.dictId;
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

  protected async loadOthers(): Promise<void> {
    const rid = String(this.state.rid || this.props.rid || '');
    if (!rid) return;
    const result = await backendRequest({
      url: 'sys/dictItem/getDictItemsByDictId',
      params: { dictId: rid },
    });
    const list = Array.isArray(result) ? result : null;
    if (list != null) {
      (this.state as Record<string, unknown>).tableData = list;
    } else {
      ElMessage.error((i18n.global.t('dictDetail.messages.loadItemsFailed') as string) || '字典项加载失败！');
    }
  }
}

export default defineComponent({
  name: 'DictDetail',
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
    const { t } = useI18n();
    const page = reactive(new DictDetailPage(props, context)) as DictDetailPage & {
      state: { detail: Record<string, unknown> | null; tableData: Record<string, unknown>[] };
      formatDate: (value: unknown) => string;
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'dictDetail.empty',
      yesNoKey: 'dictList.common',
    });

    watch(
      () => props.rid,
      (newRid, oldRid) => {
        const id = newRid ? String(newRid) : '';
        page.state.rid = id;
        if (oldRid !== undefined && id && id !== String(oldRid)) {
          page.state.detail = null;
          (page.state as Record<string, unknown>).tableData = [];
          page.loadData().then(() => page.loadOthers());
        }
      }
    );

    return {
      ...toRefs(page),
      ...toRefs(page.state),
      t,
      rowsWithSections,
      formatFieldValue,
    };
  },
});
</script>

<style scoped>
.dict-detail-items-section {
  margin-top: 16px;
}

.dict-detail-items-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  margin-bottom: 12px;
  padding: 10px 14px 10px 12px;
  background-color: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
  border-left: 4px solid var(--el-color-primary);
  border-radius: 0 6px 6px 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.dict-detail-items-title-text {
  letter-spacing: 0.3px;
}
</style>
