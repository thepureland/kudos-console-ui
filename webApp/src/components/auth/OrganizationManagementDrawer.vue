<!--
 * Organization management panel: open / close tenants after a preview, designate organization admins,
 * and grant management roles. Controls are hidden by the caller's rank from the overview; the server
 * stays authoritative and its refusals are shown as they come.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-drawer
    :model-value="organizationContext.managementVisible"
    :title="t('organizationConsole.management.title')"
    size="min(920px, 96vw)"
    append-to-body
    destroy-on-close
    @update:model-value="(value: boolean) => (organizationContext.managementVisible = value)"
    @open="refresh"
  >
    <div v-loading="loading">
      <div class="head">
        <el-tag v-if="overview" type="primary">{{ t('organizationConsole.management.yourRank', { rank: t(`organizationConsole.rank.${overview.callerRank}`) }) }}</el-tag>
        <el-text v-if="overview" type="info" size="small">{{ t('organizationConsole.organization') }}: {{ overview.organizationId }} · {{ t('organizationConsole.revision', { revision: overview.revision }) }}</el-text>
        <span class="spacer" />
        <el-button link type="primary" :disabled="busy" @click="refresh">{{ t('organizationConsole.reload') }}</el-button>
      </div>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="notice" />

      <el-tabs v-model="tab" @tab-change="loadTab">
        <el-tab-pane :label="t('organizationConsole.management.tenants')" name="tenants">
          <el-table :data="overview?.tenants ?? []" border size="small">
            <el-table-column :label="t('organizationConsole.tenant')" prop="name" min-width="160" />
            <el-table-column :label="t('organizationConsole.management.state')" width="140">
              <template #default="{ row }">
                <el-tag :type="row.open ? 'success' : 'info'">{{ row.open ? t('organizationConsole.open') : t('organizationConsole.closed') }}</el-tag>
                <el-tag v-if="!row.active" type="danger" class="gap">{{ t('organizationConsole.management.inactive') }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('organizationConsole.management.systems')" min-width="140">
              <template #default="{ row }">{{ (row.subSystemCodes ?? []).join(', ') || '—' }}</template>
            </el-table-column>
            <el-table-column v-if="canOpen" :label="t('organizationConsole.actions')" width="160">
              <template #default="{ row }">
                <el-button size="small" :type="row.open ? 'warning' : 'primary'" :disabled="busy" @click="previewOpening(row)">
                  {{ row.open ? t('organizationConsole.management.closeAction') : t('organizationConsole.management.openAction') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('organizationConsole.management.admins')" name="admins">
          <div v-if="canAssign" class="form-row">
            <organization-account-picker v-model="adminUserId" class="picker" />
            <el-input v-model="adminReason" :placeholder="t('organizationConsole.reasonPlaceholder')" class="reason" />
            <el-button type="primary" :disabled="!adminUserId || busy" @click="assignAdmin">{{ t('organizationConsole.management.assign') }}</el-button>
          </div>
          <el-table :data="admins" border size="small">
            <el-table-column :label="t('organizationConsole.account')" min-width="140">
              <template #default="{ row }">{{ row.username }}<el-tag v-if="!row.active" size="small" type="danger" class="gap">{{ t('organizationConsole.management.inactive') }}</el-tag></template>
            </el-table-column>
            <el-table-column :label="t('organizationConsole.management.assignedBy')" prop="assignedBy" min-width="120" />
            <el-table-column :label="t('organizationConsole.management.assignedTime')" prop="assignedTime" min-width="160" />
            <el-table-column :label="t('organizationConsole.actions')" width="190">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openMemberAuthorization(row.userId)">{{ t('organizationConsole.management.authorize') }}</el-button>
                <el-button v-if="canAssign" size="small" type="danger" plain :disabled="busy" @click="revokeAdmin(row)">{{ t('organizationConsole.management.revoke') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('organizationConsole.management.managementRoles')" name="roles">
          <div v-if="grantableKinds.length" class="form-row">
            <organization-account-picker v-model="grantUserId" class="picker" />
            <el-select v-model="grantKind" class="kind" :placeholder="t('organizationConsole.management.kindLabel')">
              <el-option v-for="kind in grantableKinds" :key="kind" :value="kind" :label="t(`organizationConsole.kind.${kind}`)" />
            </el-select>
            <el-select v-if="grantKind === 'TENANT_PERMISSION_ADMIN'" v-model="grantTenantIds" multiple class="tenants" :placeholder="t('organizationConsole.management.tenantsLabel')">
              <el-option v-for="tenant in overview?.tenants ?? []" :key="tenant.tenantId" :value="tenant.tenantId" :label="tenant.name" />
            </el-select>
            <el-input v-model="grantReason" :placeholder="t('organizationConsole.reasonPlaceholder')" class="reason" />
            <el-button type="primary" :disabled="!canGrant || busy" @click="grant">{{ t('organizationConsole.management.grant') }}</el-button>
          </div>
          <el-table :data="managementRoles" border size="small">
            <el-table-column :label="t('organizationConsole.account')" prop="username" min-width="120" />
            <el-table-column :label="t('organizationConsole.management.kindLabel')" min-width="170">
              <template #default="{ row }">{{ row.roleKind ? t(`organizationConsole.kind.${row.roleKind}`) : '' }}</template>
            </el-table-column>
            <el-table-column :label="t('organizationConsole.management.tenantsLabel')" min-width="140">
              <template #default="{ row }">{{ row.tenantId ? tenantName(row.tenantId) : t('organizationConsole.management.allTenants') }}</template>
            </el-table-column>
            <el-table-column :label="t('organizationConsole.management.grantedBy')" prop="grantedBy" min-width="100" />
            <el-table-column :label="t('organizationConsole.actions')" width="190">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="openMemberAuthorization(row.userId)">{{ t('organizationConsole.management.authorize') }}</el-button>
                <el-button v-if="grantableKinds.includes(row.roleKind)" size="small" type="danger" plain :disabled="busy" @click="revokeRole(row)">{{ t('organizationConsole.management.revoke') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="openingVisible"
      :title="openingTitle"
      width="min(720px, 94vw)"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
    >
      <template v-if="opening">
        <h5>{{ opening.open ? t('organizationConsole.management.affectedOpen') : t('organizationConsole.management.affectedClose') }} ({{ opening.affectedMembers.length }})</h5>
        <el-table :data="opening.affectedMembers" border size="small" max-height="240">
          <el-table-column :label="t('organizationConsole.member')" min-width="120">
            <template #default="{ row }">{{ row.username }}<el-tag v-if="row.organizationAdmin" size="small" type="danger" class="gap">{{ t('organizationConsole.rank.ORGANIZATION_ADMIN') }}</el-tag></template>
          </el-table-column>
          <el-table-column :label="t('organizationConsole.role')" min-width="220">
            <template #default="{ row }">
              <el-tag v-for="id in row.roleIds" :key="id" size="small" class="gap">{{ roleName(id) }}</el-tag>
              <el-text v-if="!row.roleIds?.length" size="small" type="info">—</el-text>
            </template>
          </el-table-column>
        </el-table>
        <h5>{{ t('organizationConsole.management.excluded') }} ({{ opening.excludedMembers.length }})</h5>
        <div class="tags">
          <el-tag v-for="member in opening.excludedMembers" :key="member.userId" type="info" size="small">{{ member.username }}</el-tag>
          <el-text v-if="!opening.excludedMembers.length" size="small" type="info">{{ t('organizationConsole.none') }}</el-text>
        </div>
        <h5>{{ t('organizationConsole.management.membersPerRole') }}</h5>
        <div class="tags">
          <el-tag v-for="(count, roleId) in opening.membersPerRole" :key="roleId" size="small">{{ roleName(String(roleId)) }} × {{ count }}</el-tag>
          <el-text v-if="!Object.keys(opening.membersPerRole).length" size="small" type="info">{{ t('organizationConsole.none') }}</el-text>
        </div>
        <el-input v-model="openingReason" :placeholder="t('organizationConsole.reasonPlaceholder')" class="opening-reason" />
      </template>
      <template #footer>
        <el-button @click="openingVisible = false">{{ t('organizationConsole.cancel') }}</el-button>
        <el-button :type="opening?.open ? 'primary' : 'warning'" :loading="saving" :disabled="!openingReason.trim()" @click="confirmOpening">{{ t('organizationConsole.confirm') }}</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { organizationContext, openMemberAuthorization, refreshOrganizationTenants } from '../../store/organizationContext';
import { organizationAuthorizationApi } from '../../api/organizationAuthorizationApi';
import {
  buildManagementRole, buildSetOpen, canAssignAdmins, canOpenTenants, grantableManagementKinds,
  type ManagementRoleKind, type ManagementRoleRow, type OrganizationAdminRow, type OrganizationOverview,
  type OrganizationTenant, type RoleCatalogItem, type TenantOpeningPreview,
} from '../../api/authorizationModel';
import { organizationErrorText } from './organizationMessages';
import OrganizationAccountPicker from './OrganizationAccountPicker.vue';

const { t } = useI18n();
const tab = ref<'tenants' | 'admins' | 'roles'>('tenants');
const overview = ref<OrganizationOverview | null>(null);
const catalog = ref<RoleCatalogItem[]>([]);
const admins = ref<OrganizationAdminRow[]>([]);
const managementRoles = ref<ManagementRoleRow[]>([]);
const loading = ref(false), saving = ref(false), error = ref('');
const adminUserId = ref(''), adminReason = ref('');
const grantUserId = ref(''), grantKind = ref<ManagementRoleKind | ''>(''), grantTenantIds = ref<string[]>([]), grantReason = ref('');
const openingVisible = ref(false), opening = ref<TenantOpeningPreview | null>(null), openingReason = ref('');
let sequence = 0;

const organizationId = computed(() => organizationContext.current?.organizationId ?? '');
const busy = computed(() => loading.value || saving.value);
const rank = computed(() => overview.value?.callerRank ?? 'NONE');
const canOpen = computed(() => canOpenTenants(rank.value));
const canAssign = computed(() => canAssignAdmins(rank.value));
const grantableKinds = computed(() => grantableManagementKinds(rank.value));
const canGrant = computed(() => !!grantUserId.value && !!grantKind.value && (grantKind.value !== 'TENANT_PERMISSION_ADMIN' || grantTenantIds.value.length > 0));
const openingTitle = computed(() => {
  if (!opening.value) return '';
  const tenant = tenantName(opening.value.tenantId);
  return t(opening.value.open ? 'organizationConsole.management.previewOpen' : 'organizationConsole.management.previewClose', { tenant });
});
const tenantName = (id: string) => overview.value?.tenants.find(tenant => tenant.tenantId === id)?.name ?? id;
const roleName = (id: string) => catalog.value.find(role => role.id === id)?.name ?? id;
const fail = (err: unknown) => { error.value = organizationErrorText(t, err, { role: roleName, tenant: tenantName }); };

async function guarded<T>(work: () => Promise<T>): Promise<T | undefined> {
  const current = ++sequence;
  loading.value = true; error.value = '';
  try {
    const result = await work();
    return current === sequence ? result : undefined;
  } catch (err) { if (current === sequence) fail(err); return undefined; }
  finally { if (current === sequence) loading.value = false; }
}

async function refresh(): Promise<void> {
  if (!organizationId.value) return;
  await guarded(async () => {
    const [nextOverview, nextCatalog] = await Promise.all([
      organizationAuthorizationApi.overview(organizationId.value),
      organizationAuthorizationApi.roleCatalog(organizationId.value),
    ]);
    overview.value = nextOverview; catalog.value = nextCatalog;
  });
  await loadTab();
  if (!grantableKinds.value.includes(grantKind.value as ManagementRoleKind)) grantKind.value = grantableKinds.value[0] ?? '';
}
async function loadTab(): Promise<void> {
  if (!organizationId.value) return;
  if (tab.value === 'admins') await guarded(async () => { admins.value = await organizationAuthorizationApi.listAdmins(organizationId.value); });
  if (tab.value === 'roles') await guarded(async () => { managementRoles.value = await organizationAuthorizationApi.listManagementRoles(organizationId.value); });
}

/** Runs one write; on success shows a message and re-reads (the overview carries the new revision). */
async function write(work: () => Promise<unknown>, done = t('organizationConsole.management.done')): Promise<boolean> {
  saving.value = true; error.value = '';
  let succeeded = false;
  try { await work(); succeeded = true; ElMessage.success(done); }
  catch (err) { fail(err); }
  finally { saving.value = false; }
  // Failures keep the form and the message; the user reloads explicitly (e.g. after a 409).
  if (succeeded) await refresh();
  return succeeded;
}

async function previewOpening(tenant: OrganizationTenant): Promise<void> {
  const result = await guarded(() => organizationAuthorizationApi.previewOpening(tenant.tenantId, !tenant.open));
  if (!result) return;
  opening.value = result; openingReason.value = ''; openingVisible.value = true;
}
async function confirmOpening(): Promise<void> {
  const preview = opening.value;
  if (!preview) return;
  const ok = await write(() => organizationAuthorizationApi.setOpen(buildSetOpen(preview.tenantId, preview.open, preview.revision, openingReason.value)),
    t(preview.open ? 'organizationConsole.management.opened' : 'organizationConsole.management.closedDone'));
  if (ok) {
    openingVisible.value = false;
    // Opening or closing changes which tenants the scope selector may offer to the caller.
    void refreshOrganizationTenants().catch(() => undefined);
  }
}

async function confirmReason(message: string): Promise<string | null> {
  try {
    const answer = await ElMessageBox.prompt(message, t('organizationConsole.management.title'), {
      inputPlaceholder: t('organizationConsole.reasonPlaceholder'),
      confirmButtonText: t('organizationConsole.confirm'), cancelButtonText: t('organizationConsole.cancel'), type: 'warning',
    });
    return (answer as { value: string }).value ?? '';
  } catch { return null; }
}
async function assignAdmin(): Promise<void> {
  if (await write(() => organizationAuthorizationApi.assignAdmin(organizationId.value, adminUserId.value, adminReason.value.trim() || undefined))) { adminUserId.value = ''; adminReason.value = ''; }
}
async function revokeAdmin(row: OrganizationAdminRow): Promise<void> {
  const reason = await confirmReason(t('organizationConsole.management.confirmRevokeAdmin', { member: row.username }));
  if (reason == null) return;
  await write(() => organizationAuthorizationApi.revokeAdmin(organizationId.value, row.userId, reason.trim() || undefined));
}
async function grant(): Promise<void> {
  if (!grantKind.value) return;
  const kind = grantKind.value;
  if (await write(() => organizationAuthorizationApi.grantManagementRole(buildManagementRole(organizationId.value, grantUserId.value, kind, grantTenantIds.value, grantReason.value)))) {
    grantUserId.value = ''; grantTenantIds.value = []; grantReason.value = '';
  }
}
async function revokeRole(row: ManagementRoleRow): Promise<void> {
  const reason = await confirmReason(t('organizationConsole.management.confirmRevokeRole', { member: row.username, kind: t(`organizationConsole.kind.${row.roleKind}`) }));
  if (reason == null) return;
  await write(() => organizationAuthorizationApi.revokeManagementRole(buildManagementRole(organizationId.value, row.userId, row.roleKind, row.tenantId ? [row.tenantId] : [], reason)));
}

watch(() => organizationContext.generation, () => { if (organizationContext.managementVisible) void refresh(); });
// The member dialog writes move the revision too; re-read when it closes over the drawer.
watch(() => organizationContext.memberDialogVisible, visible => { if (!visible && organizationContext.managementVisible) void refresh(); });
</script>

<style scoped>
.head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.spacer { flex: 1; }
.notice { margin: 8px 0; }
.form-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
.picker { width: 240px; }
.kind { width: 200px; }
.tenants { width: 220px; }
.reason { flex: 1; min-width: 200px; }
.gap { margin-left: 4px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }
h5 { margin: 12px 0 6px; }
.opening-reason { margin-top: 14px; }
</style>
