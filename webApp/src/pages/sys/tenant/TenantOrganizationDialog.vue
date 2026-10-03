<!--
 * Platform: associate a tenant with an organization (auth/organization/tenant/associate). The tenant
 * starts not open; the organization's admins open it after a preview.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('organizationConsole.tenantList.associateTitle', { tenant: tenantName })"
    width="min(520px, 94vw)"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <el-alert :title="t('organizationConsole.tenantList.associateHint')" type="info" :closable="false" class="hint" />
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="hint" />
    <el-form label-position="top">
      <el-form-item :label="t('organizationConsole.organization')" required>
        <organization-owner-field v-model="organizationId" />
      </el-form-item>
      <el-form-item :label="t('organizationConsole.reason')">
        <el-input v-model="reason" :placeholder="t('organizationConsole.reasonPlaceholder')" maxlength="200" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('organizationConsole.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" :disabled="!organizationId" @click="associate">{{ t('organizationConsole.tenantList.associate') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { organizationAuthorizationApi } from '../../../api/organizationAuthorizationApi';
import { organizationErrorText } from '../../../components/auth/organizationMessages';

const props = defineProps<{ modelValue: boolean; tenantId: string; tenantName: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; response: [] }>();
const { t } = useI18n();
const organizationId = ref(''), reason = ref(''), saving = ref(false), error = ref('');

watch(() => props.modelValue, visible => { if (visible) { organizationId.value = ''; reason.value = ''; error.value = ''; } });

async function associate(): Promise<void> {
  saving.value = true; error.value = '';
  try {
    await organizationAuthorizationApi.associateTenant(props.tenantId, organizationId.value, reason.value.trim() || undefined);
    ElMessage.success(t('organizationConsole.tenantList.associated'));
    emit('response');
    emit('update:modelValue', false);
  } catch (err) {
    error.value = organizationErrorText(t, err);
  } finally { saving.value = false; }
}
</script>

<style scoped>
.hint { margin-bottom: 12px; }
</style>
