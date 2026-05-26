<template>
  <el-dialog
    :model-value="modelValue"
    :width="width"
    center
    class="sectioned-detail-dialog"
    align-center
    :append-to-body="false"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="onClose"
  >
    <template #header>
      <slot name="header">
        <div class="sectioned-detail-header">
          <span class="sectioned-detail-header-title">{{ t(titleKey) }}</span>
        </div>
      </slot>
    </template>
    <div class="sectioned-detail-body">
      <template v-for="(item, rowIndex) in rowsWithSections" :key="rowIndex">
        <div v-if="item.sectionTitle" class="detail-section-title">
          {{ item.sectionTitle }}
        </div>
        <div class="detail-row">
          <template v-for="(field, colIndex) in item.row" :key="field.key">
            <div class="detail-item" :class="{ 'detail-item--value-span-3': field.valueSpan === 3 }">
              <span class="detail-label">{{ field.label }}:</span>
              <span class="detail-value">
                <el-tag
                  v-if="field.type === 'boolean'"
                  :type="detail?.[field.key] ? 'success' : 'info'"
                  size="small"
                  effect="plain"
                  round
                >
                  {{ formatFieldValue(field) }}
                </el-tag>
                <template v-else>{{ formatFieldValue(field) || '—' }}</template>
              </span>
            </div>
          </template>
        </div>
      </template>
    </div>
    <div v-if="$slots.default" class="sectioned-detail-extra">
      <slot />
    </div>
  </el-dialog>
</template>

<script lang="ts">
/**
 * Sectioned detail dialog: renders section titles and field rows from rowsWithSections, displaying values by type via formatFieldValue.
 * Pairs with useSectionedDetail; used for cache detail, parameter detail, and similar pages.
 */
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FieldConfig, SectionedDetailRow } from './sectionedDetail';

export default defineComponent({
  name: 'SectionedDetailDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    titleKey: {
      type: String,
      required: true,
    },
    emptyKey: {
      type: String,
      required: true,
    },
    width: {
      type: String,
      default: '65%',
    },
    rowsWithSections: {
      type: Array as () => SectionedDetailRow[],
      required: true,
    },
    detail: {
      type: Object as () => Record<string, unknown> | null,
      default: null,
    },
    formatFieldValue: {
      type: Function as (field: FieldConfig) => string,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t } = useI18n();
    function onClose() {
      emit('update:modelValue', false);
    }
    return { t, onClose };
  },
});
</script>

<style scoped>
/* Halve only Element Plus's dialog primary padding variable (default ~20px -> 10px) */
.sectioned-detail-dialog :deep(.el-dialog) {
  --el-dialog-padding-primary: 10px;
}

.sectioned-detail-dialog :deep(.el-dialog__header) {
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-right: 0;
  background: linear-gradient(to bottom, var(--el-fill-color-light) 0%, var(--el-bg-color) 100%);
}

.sectioned-detail-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sectioned-detail-header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.3px;
}

.sectioned-detail-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.sectioned-detail-body {
  background: var(--el-bg-color);
  border-radius: 10px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* Left vertical bar matches CacheFormPage.vue .form-section__title, keeping the section's light-gray background */
.detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  margin: 16px 0 12px 0;
  padding: 8px 12px 8px 5px;
  /* Bar tinted with the same color but very faint: mix --el-color-primary with the background */
  background-color: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
  border-left: 3px solid var(--el-color-primary);
}

.detail-section-title:first-child {
  margin-top: 0;
}

.detail-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0 28px;
  padding: 12px 0 12px 20px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-item {
  display: flex;
  align-items: baseline;
  min-width: 0;
  flex: 1 1 calc(50% - 14px);
  max-width: calc(50% - 14px);
}

.detail-label {
  flex: 0 0 auto;
  min-width: 110px;
  margin-right: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  line-height: 1.65;
  text-align: right;
}

.detail-value {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.65;
  word-break: break-word;
}

.detail-value :deep(.el-tag) {
  font-size: 12px;
}

/* Value spans 3 columns: the item takes its own row, label stays aligned with other rows (110px), value fills the rest */
.detail-item--value-span-3 {
  flex: 1 1 100%;
  max-width: 100%;
}
.detail-item--value-span-3 .detail-label {
  flex: 0 0 auto;
  min-width: 110px;
}
.detail-item--value-span-3 .detail-value {
  flex: 1 1 auto;
}

.sectioned-detail-extra {
  margin-top: 16px;
}
</style>
