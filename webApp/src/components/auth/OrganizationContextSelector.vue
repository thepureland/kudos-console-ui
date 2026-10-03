<!--
 * Header scope selector in organization mode: tenant × system options plus the organization scope
 * (management only, no tenant) when the account holds a management identity. Also hosts the member
 * authorization dialog and the organization management drawer.
 -->
<template>
  <div class="organization-context">
    <el-dropdown v-if="organizationContext.current" trigger="click" :disabled="organizationContext.switching" @command="switchTo">
      <el-button :loading="organizationContext.switching" :title="organizationContext.current.scope === 'ORGANIZATION' ? t('organizationConsole.context.organizationScopeHint') : undefined">{{ currentLabel }}</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="option in options"
            :key="option.key"
            :command="option"
            :disabled="option.key === currentKey"
            :divided="option.scope === 'TENANT' && option === firstTenantOption && options[0]?.scope === 'ORGANIZATION'"
          >
            {{ optionLabel(option) }}
          </el-dropdown-item>
          <el-dropdown-item :command="MANAGE" divided>{{ t('organizationConsole.manage') }}…</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-tooltip v-if="contextError" :content="contextError">
      <el-button type="warning" @click="load">{{ t('organizationConsole.context.error') }}</el-button>
    </el-tooltip>
    <organization-configuration-dialog v-if="organizationContext.current" />
    <organization-management-drawer v-if="organizationContext.current" />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { organizationContext, loadOrganizationContexts, switchOrganizationContext, openOrganizationManagement } from '../../store/organizationContext';
import { contextOptions, type ContextOption } from '../../api/authorizationModel';
import { organizationErrorText } from './organizationMessages';
import OrganizationConfigurationDialog from './OrganizationConfigurationDialog.vue';
import OrganizationManagementDrawer from './OrganizationManagementDrawer.vue';

const MANAGE = 'MANAGE';
const { t } = useI18n();
const store = useStore();
const contextError = ref('');
const options = computed(() => contextOptions(organizationContext.tenants, organizationContext.organizationScope));
const firstTenantOption = computed(() => options.value.find(option => option.scope === 'TENANT'));
const currentKey = computed(() => {
  const current = organizationContext.current;
  if (!current) return '';
  return current.scope === 'ORGANIZATION' ? 'ORGANIZATION' : `${current.tenantId}/${current.subSystemCode ?? ''}`;
});
function optionLabel(option: ContextOption): string {
  return option.scope === 'ORGANIZATION' ? t('organizationConsole.context.organizationScope') : `${option.tenantName} / ${option.subSystemCode}`;
}
const currentLabel = computed(() => {
  const current = organizationContext.current;
  if (!current) return '';
  if (current.scope === 'ORGANIZATION') return t('organizationConsole.context.organizationScope');
  const name = organizationContext.tenants.find(tenant => tenant.tenantId === current.tenantId)?.name ?? current.tenantId;
  return current.subSystemCode ? `${name} / ${current.subSystemCode}` : String(name);
});

async function load(): Promise<void> {
  try { await loadOrganizationContexts(); contextError.value = ''; }
  catch (err) { contextError.value = err instanceof Error ? err.message : String(err); }
}
async function switchTo(command: ContextOption | typeof MANAGE): Promise<void> {
  if (command === MANAGE) { openOrganizationManagement(); return; }
  try { await ElMessageBox.confirm(t('organizationConsole.context.switchConfirm'), t('organizationConsole.context.switch')); } catch { return; }
  try {
    await switchOrganizationContext(command.tenantId, command.subSystemCode);
    store.commit('clearTags');
    store.commit('setCurrentMenuPath', '/home');
  } catch (err) {
    ElMessage.error(organizationErrorText(t, err));
  }
}
onMounted(load);
</script>
<style scoped>.organization-context{display:flex;gap:8px;align-items:center}</style>
