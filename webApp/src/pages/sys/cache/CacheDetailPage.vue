<!-- Cache detail -->
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
import { defineComponent, reactive } from 'vue';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';

/**
 * Section header positions within ROW_FIELDS.
 * Each entry marks the row index where that section's title is injected by SectionedDetailDialog.
 * The last section ("otherInfo") captures all remaining rows after index 7.
 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'cacheDetail.sections.basicInfo' },
  { start: 1, titleKey: 'cacheDetail.sections.config' },
  { start: 5, titleKey: 'cacheDetail.sections.audit' },
  { start: 7, titleKey: 'cacheDetail.sections.otherInfo' },
];

/**
 * Field layout for the detail dialog — each inner array is one rendered row (up to 2 fields per row).
 * Row indices must align with the `start` values in SECTION_MAP above.
 */
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
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new CacheDetailPage(props, context)) as CacheDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'cacheDetail.empty',
      yesNoKey: 'cacheList.common',
    });

    // Watch the `rid` prop so that selecting a different row in the list immediately
    // triggers a fresh detail fetch without having to close and reopen the dialog.
    useDetailPageRidSync(props, page);

    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
    };
  },
});
</script>
