<!-- Remote account search scoped to the current organization (backendRequest adds organizationId). -->
<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    clearable
    :remote-method="search"
    :loading="loading"
    :disabled="disabled"
    :placeholder="t('organizationConsole.management.accountPlaceholder')"
    @update:model-value="$emit('update:modelValue', $event ?? '')"
    @visible-change="(open: boolean) => open && !options.length && search('')"
  >
    <el-option v-for="item in options" :key="item.id" :value="item.id" :label="item.label" />
  </el-select>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { backendRequest, resolveApiPayload } from '../../utils/backendRequest';
defineProps<{ modelValue: string; disabled?: boolean }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();
const options = ref<Array<{ id: string; label: string }>>([]);
const loading = ref(false);
let sequence = 0;
async function search(keyword: string): Promise<void> {
  const current = ++sequence;
  loading.value = true;
  try {
    const raw = await backendRequest({ url: 'user/account/pagingSearch', method: 'post', params: { username: keyword || null, pageNo: 1, pageSize: 30 } });
    const payload = await resolveApiPayload<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(raw, 'Unable to load accounts');
    if (current !== sequence) return;
    const rows = Array.isArray(payload) ? payload : payload?.data ?? [];
    options.value = rows.map(row => ({ id: String(row.id), label: row.realName ? `${row.username} · ${row.realName}` : String(row.username ?? row.id) }));
  } catch {
    if (current === sequence) options.value = [];
  } finally {
    if (current === sequence) loading.value = false;
  }
}
</script>
