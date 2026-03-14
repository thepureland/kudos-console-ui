<!-- 国际化详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="i18nDetail.title"
    empty-key="i18nDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, watch, computed } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';

const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'i18nDetail.sections.basicInfo' },
  { start: 4, titleKey: 'i18nDetail.sections.audit' },
  { start: 6, titleKey: 'i18nDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'i18nDetail.fields.id', key: 'id' },
    { labelKey: 'i18nDetail.fields.locale', key: 'locale' },
  ],
  [
    { labelKey: 'i18nDetail.fields.key', key: 'key' },
    { labelKey: 'i18nDetail.fields.value', key: 'value' },
  ],
  [
    { labelKey: 'i18nDetail.fields.atomicServiceCode', key: 'atomicServiceCode', type: 'atomicService' },
    { labelKey: 'i18nDetail.fields.i18nTypeDictCode', key: 'i18nTypeDictCode', type: 'dict', dictModule: 'sys', dictCode: 'i18n_type' },
  ],
  [
    { labelKey: 'i18nDetail.fields.namespace', key: 'namespace' },
  ],
  [
    { labelKey: 'i18nDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'i18nDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'i18nDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'i18nDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'i18nDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'i18nDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'i18nDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class I18nDetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'sys/i18n';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }
}

export default defineComponent({
  name: 'I18NDetail',
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
    const page = reactive(new I18nDetailPage(props, context)) as I18nDetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'i18nDetail.empty',
      yesNoKey: 'i18nList.common',
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

    const visible = computed(() => props.modelValue as boolean);
    function close() {
      context.emit('update:modelValue', false);
    }

    return {
      ...toRefs(page),
      ...toRefs(page.state),
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
