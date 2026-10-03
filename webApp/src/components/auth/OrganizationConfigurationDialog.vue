<!--
 * Member authorization in organization mode: default roles (with a preview step) and, per tenant,
 * role-level overrides — remove a default role in this tenant, add a role in this tenant, or restore
 * inheritance. Every write sends the revision of the last read, then re-reads the member.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="organizationContext.memberDialogVisible"
    :title="t('organizationConsole.memberDialog.title')"
    width="min(1080px, 96vw)"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    :before-close="close"
  >
    <div v-loading="loading" class="member-authorization">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="notice">
        <el-button v-if="conflict" size="small" @click="load">{{ t('organizationConsole.reload') }}</el-button>
      </el-alert>
      <el-empty v-if="!view && !loading && !error" :description="t('organizationConsole.memberDialog.noMember')" />

      <template v-if="view">
        <header class="member-head">
          <strong class="member-name">{{ view.username }}</strong>
          <el-tag v-if="view.organizationAdmin" type="danger" effect="dark">{{ t('organizationConsole.memberDialog.organizationAdmin') }}</el-tag>
          <el-tag v-for="role in view.managementRoles" :key="role" type="warning">{{ managementLabel(role) }}</el-tag>
          <span class="spacer" />
          <el-text type="info" size="small">{{ t('organizationConsole.revision', { revision: view.revision }) }}</el-text>
          <el-button link type="primary" :disabled="busy" @click="load">{{ t('organizationConsole.reload') }}</el-button>
        </header>

        <section class="block">
          <h4>{{ t('organizationConsole.memberDialog.defaults') }}</h4>
          <el-text type="info" size="small" class="hint">{{ t('organizationConsole.memberDialog.defaultsHint') }}</el-text>
          <div class="row">
            <el-select
              v-model="draftDefaults"
              multiple
              filterable
              class="defaults-select"
              :disabled="!view.defaultsEditable || busy"
              @change="defaultsPreview = null"
            >
              <el-option v-for="role in view.roleCatalog" :key="role.id" :value="role.id" :label="roleLabel(role.id)" :disabled="!role.active" />
            </el-select>
            <el-button :disabled="!defaultsDirty || busy" @click="revertDefaults">{{ t('organizationConsole.revert') }}</el-button>
            <el-button type="primary" plain :disabled="!defaultsDirty || !view.defaultsEditable || busy" @click="previewDefaults">{{ t('organizationConsole.preview') }}</el-button>
          </div>
          <div v-if="groupRelayed.length" class="row">
            <el-text size="small">{{ t('organizationConsole.memberDialog.groupRelayed') }}:</el-text>
            <el-tag v-for="id in groupRelayed" :key="id" size="small" type="info">{{ roleLabel(id) }}</el-tag>
          </div>
          <el-text v-if="!view.defaultsEditable" type="info" size="small">{{ t('organizationConsole.memberDialog.defaultsReadOnly') }}</el-text>

          <div v-if="defaultsPreview" class="preview">
            <div class="preview-title">{{ t('organizationConsole.memberDialog.previewTitle') }}</div>
            <div class="row">
              <el-text size="small">{{ t('organizationConsole.memberDialog.added') }}:</el-text>
              <el-tag v-for="id in defaultsPreview.addedRoleIds" :key="`+${id}`" size="small" type="success">+ {{ roleLabel(id) }}</el-tag>
              <el-text v-if="!defaultsPreview.addedRoleIds.length" size="small" type="info">{{ t('organizationConsole.none') }}</el-text>
              <el-text size="small">{{ t('organizationConsole.memberDialog.removed') }}:</el-text>
              <el-tag v-for="id in defaultsPreview.removedRoleIds" :key="`-${id}`" size="small" type="danger">− {{ roleLabel(id) }}</el-tag>
              <el-text v-if="!defaultsPreview.removedRoleIds.length" size="small" type="info">{{ t('organizationConsole.none') }}</el-text>
            </div>
            <el-alert
              v-for="change in defaultsPreview.entryChanges"
              :key="change.tenantId"
              :type="change.regains ? 'warning' : 'error'"
              :title="t(change.regains ? 'organizationConsole.memberDialog.regains' : 'organizationConsole.memberDialog.loses', { tenant: change.tenantName })"
              show-icon
              :closable="false"
              class="notice"
            />
            <div v-if="tenantChangeRows.length" class="tenant-changes">
              <el-text size="small">{{ t('organizationConsole.memberDialog.tenantChanges') }}</el-text>
              <div v-for="row in tenantChangeRows" :key="row.tenantId" class="row">
                <span class="tenant-name">{{ row.tenantName }}</span>
                <el-tag v-for="change in row.changes" :key="change.roleId + change.added" size="small" :type="change.added ? 'success' : 'danger'">
                  {{ change.added ? '+' : '−' }} {{ roleLabel(change.roleId) }}
                </el-tag>
              </div>
            </div>
            <el-alert
              v-for="conflict in defaultsPreview.sodConflicts"
              :key="conflict"
              type="error"
              :title="`${t('organizationConsole.memberDialog.sod')}: ${sodText(conflict)}`"
              show-icon
              :closable="false"
              class="notice"
            />
            <el-text v-if="previewEmpty" size="small" type="info">{{ t('organizationConsole.memberDialog.noChanges') }}</el-text>
            <div class="row">
              <el-input v-model="defaultsReason" :placeholder="t('organizationConsole.reasonPlaceholder')" maxlength="200" class="reason" />
              <el-button
                type="primary"
                :loading="saving"
                :disabled="!defaultsReason.trim() || defaultsPreview.sodConflicts.length > 0 || busy"
                @click="saveDefaults"
              >{{ t('organizationConsole.save') }}</el-button>
            </div>
          </div>
        </section>

        <section class="block">
          <h4>{{ t('organizationConsole.memberDialog.tenants') }}</h4>
          <el-tabs v-model="activeTenant">
            <el-tab-pane v-for="tenant in view.tenants" :key="tenant.tenantId" :name="tenant.tenantId">
              <template #label>
                <span class="tab-label">
                  {{ tenant.tenantName }}
                  <el-tag size="small" :type="tenant.canEnter ? 'success' : 'info'">{{ tenant.canEnter ? t('organizationConsole.memberDialog.canEnter') : t('organizationConsole.memberDialog.cannotEnter') }}</el-tag>
                </span>
              </template>
              <div class="row">
                <el-tag :type="tenant.open ? 'success' : 'info'">{{ tenant.open ? t('organizationConsole.open') : t('organizationConsole.closed') }}</el-tag>
                <el-tag :type="tenant.canEnter ? 'success' : 'danger'">{{ tenant.canEnter ? t('organizationConsole.memberDialog.canEnter') : t('organizationConsole.memberDialog.cannotEnter') }}</el-tag>
                <el-text v-if="tenant.entryDenial" size="small" type="info">{{ denialText(tenant.entryDenial) }}</el-text>
                <el-tag v-if="!tenant.editable" type="info" effect="plain">{{ t('organizationConsole.readOnly') }}</el-tag>
              </div>
              <el-text v-if="!tenant.editable" size="small" type="info">{{ t('organizationConsole.memberDialog.tenantReadOnly') }}</el-text>
              <el-table :data="tenant.roles" border size="small" class="roles-table" :empty-text="t('organizationConsole.memberDialog.empty')">
                <el-table-column :label="t('organizationConsole.role')" min-width="180">
                  <template #default="{ row }">{{ roleLabel(row.roleId) }}<el-text size="small" type="info"> · {{ roleSystem(row.roleId) }}</el-text></template>
                </el-table-column>
                <el-table-column :label="t('organizationConsole.management.state')" min-width="220">
                  <template #default="{ row }">
                    <el-tag v-for="tag in roleStatusTags(row)" :key="tag" size="small" :type="tagType(tag)" class="status-tag">{{ t(`organizationConsole.status.${tag}`) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column :label="t('organizationConsole.memberDialog.result')" width="110">
                  <template #default="{ row }">
                    <el-text :type="row.applies ? 'success' : 'info'">{{ row.applies ? t('organizationConsole.memberDialog.applies') : t('organizationConsole.memberDialog.notApplies') }}</el-text>
                  </template>
                </el-table-column>
                <el-table-column :label="t('organizationConsole.actions')" min-width="220">
                  <template #default="{ row }">
                    <el-button v-if="roleRowActions(row, tenant.editable).removeHere" size="small" :disabled="busy" @click="changeOverride(tenant, row.roleId, 'REMOVE')">{{ t('organizationConsole.memberDialog.removeHere') }}</el-button>
                    <el-button v-if="roleRowActions(row, tenant.editable).restore" size="small" type="primary" plain :disabled="busy" @click="changeOverride(tenant, row.roleId, 'RESTORE')">{{ t('organizationConsole.memberDialog.restore') }}</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="row">
                <el-select
                  v-model="addRoleId"
                  filterable
                  clearable
                  class="add-select"
                  :disabled="!tenant.editable || busy"
                  :placeholder="t('organizationConsole.memberDialog.addRolePlaceholder')"
                >
                  <el-option v-for="role in addableRoles(view.roleCatalog, tenant)" :key="role.id" :value="role.id" :label="roleLabel(role.id)" />
                </el-select>
                <el-button :disabled="!tenant.editable || !addRoleId || busy" @click="changeOverride(tenant, addRoleId, 'ADD')">{{ t('organizationConsole.memberDialog.addRole') }}</el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </section>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { organizationContext } from '../../store/organizationContext';
import { organizationAuthorizationApi } from '../../api/organizationAuthorizationApi';
import {
  addableRoles, buildRemoveOverride, buildSaveDefaults, buildSaveOverride, expectedEntryChange, parseManagementRole, parseOrganizationError,
  parseRoleChange, roleRowActions, roleStatusTags,
  type DefaultRolesPreview, type MemberAuthorizationView, type MemberTenantView, type RoleChange, type RoleStatusTag,
} from '../../api/authorizationModel';
import { isRevisionConflict, organizationErrorText } from './organizationMessages';

const { t, te } = useI18n();
const view = ref<MemberAuthorizationView | null>(null);
const loading = ref(false), saving = ref(false);
const error = ref(''), conflict = ref(false);
const draftDefaults = ref<string[]>([]);
const defaultsPreview = ref<DefaultRolesPreview | null>(null);
const defaultsReason = ref('');
const activeTenant = ref('');
const addRoleId = ref('');
let sequence = 0;

const busy = computed(() => loading.value || saving.value);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));
const defaultsDirty = computed(() => !!view.value && !sameSet(draftDefaults.value, view.value.directDefaultRoleIds));
const groupRelayed = computed(() => view.value ? view.value.defaultRoleIds.filter(id => !view.value!.directDefaultRoleIds.includes(id)) : []);
const tenantName = (id: string) => view.value?.tenants.find(tenant => tenant.tenantId === id)?.tenantName ?? id;
const tenantChangeRows = computed(() => Object.entries(defaultsPreview.value?.tenantRoleChanges ?? {})
  .map(([tenantId, changes]) => ({ tenantId, tenantName: tenantName(tenantId), changes: changes.map(parseRoleChange) }))
  .filter(row => row.changes.length));
const previewEmpty = computed(() => !!defaultsPreview.value && !defaultsPreview.value.addedRoleIds.length && !defaultsPreview.value.removedRoleIds.length && !tenantChangeRows.value.length);

function roleLabel(id: string): string { return view.value?.roleCatalog.find(role => role.id === id)?.name ?? id; }
function roleSystem(id: string): string { return view.value?.roleCatalog.find(role => role.id === id)?.subSystemCode ?? '—'; }
function managementLabel(value: string): string {
  const parsed = parseManagementRole(value);
  if (!parsed) return value;
  const kind = t(`organizationConsole.kind.${parsed.kind}`);
  return parsed.tenantId ? `${kind} · ${tenantName(parsed.tenantId)}` : kind;
}
function denialText(code: string): string {
  const key = `organizationConsole.memberDialog.denial.${code}`;
  return te(key) ? t(key) : code;
}
function tagType(tag: RoleStatusTag): 'info' | 'success' | 'danger' | 'warning' {
  return tag === 'INHERITED' ? 'info' : tag === 'ADDED_HERE' ? 'success' : tag === 'REMOVED_HERE' ? 'danger' : 'warning';
}
function sodText(code: string): string {
  const info = parseOrganizationError(400, { message: code });
  return info.kind === 'SOD_CONFLICT' ? t('organizationConsole.errors.AUTHZ_SOD_CONFLICT', { tenant: tenantName(info.tenantId), roleA: roleLabel(info.roleA), roleB: roleLabel(info.roleB) }) : code;
}
function fail(err: unknown): void {
  conflict.value = isRevisionConflict(err);
  error.value = organizationErrorText(t, err, { role: roleLabel, tenant: tenantName });
}

async function load(): Promise<void> {
  const userId = organizationContext.memberUserId;
  const organizationId = organizationContext.current?.organizationId;
  if (!userId || !organizationId) { view.value = null; return; }
  const current = ++sequence;
  loading.value = true; error.value = ''; conflict.value = false;
  try {
    const result = await organizationAuthorizationApi.readMember(organizationId, userId);
    if (current !== sequence) return;
    const keepDraft = defaultsDirty.value && view.value?.userId === result.userId;
    view.value = result;
    // A reload after a conflict keeps the user's draft; the preview is stale and must be redone.
    if (!keepDraft) draftDefaults.value = [...result.directDefaultRoleIds];
    defaultsPreview.value = null;
    if (!result.tenants.some(tenant => tenant.tenantId === activeTenant.value)) {
      activeTenant.value = result.tenants.find(tenant => tenant.tenantId === organizationContext.current?.tenantId)?.tenantId ?? result.tenants[0]?.tenantId ?? '';
    }
  } catch (err) {
    if (current === sequence) fail(err);
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function revertDefaults(): void {
  draftDefaults.value = [...(view.value?.directDefaultRoleIds ?? [])];
  defaultsPreview.value = null;
}

async function previewDefaults(): Promise<void> {
  if (!view.value) return;
  saving.value = true; error.value = ''; conflict.value = false;
  try {
    defaultsPreview.value = await organizationAuthorizationApi.previewDefaults(view.value.organizationId, view.value.userId, [...draftDefaults.value]);
  } catch (err) { fail(err); } finally { saving.value = false; }
}

async function saveDefaults(): Promise<void> {
  if (!view.value || !defaultsPreview.value) return;
  saving.value = true; error.value = ''; conflict.value = false;
  try {
    await organizationAuthorizationApi.saveDefaults(buildSaveDefaults(view.value, draftDefaults.value, defaultsReason.value));
    ElMessage.success(t('organizationConsole.memberDialog.saved'));
    defaultsReason.value = '';
    // Saved: the draft is no longer a draft, so the re-read replaces it with the server's result.
    view.value = { ...view.value, directDefaultRoleIds: [...draftDefaults.value] };
    await load();
  } catch (err) { fail(err); } finally { saving.value = false; }
}

async function changeOverride(tenant: MemberTenantView, roleId: string, change: RoleChange): Promise<void> {
  if (!view.value || !roleId) return;
  const member = view.value;
  const names = { role: roleLabel(roleId), member: member.username, tenant: tenant.tenantName };
  const message = t(change === 'REMOVE' ? 'organizationConsole.memberDialog.confirmRemove' : change === 'ADD' ? 'organizationConsole.memberDialog.confirmAdd' : 'organizationConsole.memberDialog.confirmRestore', names);
  const entry = expectedEntryChange(tenant, member.organizationAdmin, roleId, change);
  const warning = entry == null ? '' : `\n${t('organizationConsole.memberDialog.entryWarning', { message: t(entry ? 'organizationConsole.memberDialog.regains' : 'organizationConsole.memberDialog.loses', { tenant: tenant.tenantName }) })}`;
  let reason: string;
  try {
    const answer = await ElMessageBox.prompt(message + warning, t('organizationConsole.memberDialog.title'), {
      inputPlaceholder: t('organizationConsole.reasonPlaceholder'),
      inputValidator: (value: string) => (value ?? '').trim() ? true : t('organizationConsole.reasonRequired'),
      confirmButtonText: t('organizationConsole.confirm'),
      cancelButtonText: t('organizationConsole.cancel'),
      type: entry === false ? 'warning' : undefined,
      customClass: 'organization-prompt',
    });
    reason = (answer as { value: string }).value;
  } catch { return; }
  saving.value = true; error.value = ''; conflict.value = false;
  try {
    if (change === 'RESTORE') await organizationAuthorizationApi.removeOverride(buildRemoveOverride(member, tenant.tenantId, roleId, reason));
    else await organizationAuthorizationApi.saveOverride(buildSaveOverride(member, tenant.tenantId, roleId, change, reason));
    ElMessage.success(t('organizationConsole.memberDialog.saved'));
    if (change === 'ADD') addRoleId.value = '';
    await load();
  } catch (err) { fail(err); } finally { saving.value = false; }
}

async function close(done?: () => void): Promise<void> {
  if (saving.value) return;
  ++sequence;
  organizationContext.memberDialogVisible = false;
  done?.();
}

watch(() => [organizationContext.memberDialogVisible, organizationContext.memberUserId] as const, ([visible]) => {
  if (!visible) return;
  view.value = null; error.value = ''; conflict.value = false; defaultsPreview.value = null; defaultsReason.value = ''; addRoleId.value = ''; activeTenant.value = '';
  draftDefaults.value = [];
  void load();
}, { immediate: true });
watch(activeTenant, () => { addRoleId.value = ''; });
</script>

<style scoped>
.member-authorization { min-height: 160px; }
.member-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.member-name { font-size: 16px; }
.spacer { flex: 1; }
.block { margin-top: 16px; }
.block h4 { margin: 0 0 4px; }
.hint { display: block; margin-bottom: 8px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
.defaults-select { flex: 1; min-width: 260px; }
.add-select { width: 280px; }
.reason { flex: 1; min-width: 240px; }
.preview { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 10px 12px; margin-top: 8px; background: var(--el-fill-color-light); }
.preview-title { font-weight: 600; margin-bottom: 4px; }
.notice { margin: 8px 0; }
.tenant-name { min-width: 120px; }
.roles-table { margin-top: 8px; }
.status-tag { margin-right: 4px; }
.tab-label { display: inline-flex; gap: 6px; align-items: center; }
</style>
<style>
.organization-prompt .el-message-box__message p { white-space: pre-line; }
</style>
