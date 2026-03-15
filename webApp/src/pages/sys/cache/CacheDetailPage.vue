<!-- 缓存详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="cacheDetail.title"
    empty-key="cacheDetail.empty"
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

/** 分组：从第几行开始显示分组标题（其他信息放最后） */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'cacheDetail.sections.basicInfo' },
  { start: 1, titleKey: 'cacheDetail.sections.config' },
  { start: 5, titleKey: 'cacheDetail.sections.audit' },
  { start: 7, titleKey: 'cacheDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'cacheDetail.fields.id', key: 'id' },
    { labelKey: 'cacheDetail.fields.name', key: 'name' },
  ],
  [
    { labelKey: 'cacheDetail.fields.atomicServiceCode', key: 'atomicServiceCode', type: 'atomicService' },
    { labelKey: 'cacheDetail.fields.strategyDictCode', key: 'strategyDictCode', type: 'dict', dictModule: 'sys', dictCode: 'cache_strategy' },
  ],
  [
    { labelKey: 'cacheDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'cacheDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'cacheDetail.fields.writeOnBoot', key: 'writeOnBoot', type: 'boolean' },
    { labelKey: 'cacheDetail.fields.writeInTime', key: 'writeInTime', type: 'boolean' },
  ],
  [
    { labelKey: 'cacheDetail.fields.ttl', key: 'ttl' },
    { labelKey: 'cacheDetail.fields.hash', key: 'hash', type: 'boolean' },
  ],
  [
    { labelKey: 'cacheDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'cacheDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'cacheDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'cacheDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'cacheDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class CacheDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'sys/cache';
  }
}

export default defineComponent({
  name: 'CacheDetailPage',
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
    const page = reactive(new CacheDetailPage(props, context)) as CacheDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'cacheDetail.empty',
      yesNoKey: 'cacheList.common',
    });

    // 列表传入的 rid（当前行 id）变化时，同步并重新拉取该 id 的详情
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
