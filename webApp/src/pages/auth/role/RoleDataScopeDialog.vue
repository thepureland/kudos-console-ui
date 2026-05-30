<!--
 * Configure a role's data scope (数据权限) — the row-level visibility policy for users holding it.
 *
 * Backend (kudos-ms-auth):
 *   GET  /api/admin/auth/role/getDetail?id=...                 → role detail (dataScope, subsysCode, tenantId)
 *   POST /api/admin/auth/roleDataScope/updateScope?roleId=&dataScope=   → set the policy code
 *   GET  /api/admin/auth/roleDataScope/getRoleOrgIds?roleId=...         → current CUSTOM org grants
 *   POST /api/admin/auth/roleDataScope/bindRoleOrgs  { roleId, orgIds } → replace CUSTOM org grants
 *   GET  /api/admin/auth/user/organization/loadTree  { subSystemCode, tenantId } → org tree (CUSTOM picker)
 *
 * Self-sufficient: given only the role id it loads the role detail to read the current scope and
 * the tenant/subsystem needed to scope the org tree. The CUSTOM org picker is only shown (and the
 * tree only loaded) when the scope is CUSTOM.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('roleDataScope.title')"
    width="560px"
    center
    class="add-edit-dialog role-data-scope-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form label-width="110px" label-position="right" class="add-edit-dialog-form">
        <el-form-item :label="t('roleDataScope.labels.scope')">
          <el-select v-model="scope" class="rds-full" @change="onScopeChange">
            <el-option v-for="s in scopeOptions" :key="s.value" :value="s.value" :label="s.label" />
          </el-select>
        </el-form-item>
        <el-alert :title="scopeDescription" type="info" :closable="false" show-icon class="rds-desc" />
        <el-form-item v-if="scope === 'CUSTOM'" :label="t('roleDataScope.labels.orgs')" class="rds-orgs-item">
          <el-tree-select
            v-model="selectedOrgIds"
            :data="orgTree"
            :props="treeProps"
            node-key="id"
            multiple
            show-checkbox
            check-on-click-node
            :render-after-expand="false"
            collapse-tags
            collapse-tags-tooltip
            clearable
            :placeholder="t('roleDataScope.placeholders.orgs')"
            class="rds-full"
          />
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('roleDataScope.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('roleDataScope.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

const SCOPE_CODES = ['ALL', 'ORG_AND_CHILD', 'ORG', 'SELF', 'CUSTOM'] as const;

export default defineComponent({
  name: 'RoleDataScopeDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(true);
    const submitting = ref(false);
    const scope = ref<string>('ALL');
    const selectedOrgIds = ref<string[]>([]);
    const orgTree = ref<Array<Record<string, unknown>>>([]);
    const subSystemCode = ref<string | null>(null);
    const tenantId = ref<string | null>(null);
    const treeProps = { label: 'name', children: 'children' };

    const scopeOptions = computed(() => SCOPE_CODES.map(code => ({ value: code, label: t(`roleDataScope.scopes.${code}`) })));
    const scopeDescription = computed(() => t(`roleDataScope.descriptions.${scope.value}`));

    async function loadOrgTree(): Promise<void> {
      if (orgTree.value.length > 0) return;
      if (!subSystemCode.value) { orgTree.value = []; return; }
      const result = await backendRequest({
        url: 'user/organization/loadTree',
        method: 'get',
        params: { subSystemCode: subSystemCode.value, tenantId: tenantId.value },
      });
      const payload = getApiResponseData<Array<Record<string, unknown>>>(result);
      orgTree.value = Array.isArray(payload) ? payload : [];
    }

    async function onScopeChange(): Promise<void> {
      if (scope.value === 'CUSTOM') await loadOrgTree();
    }

    async function load(): Promise<void> {
      loading.value = true;
      try {
        // 1) Role detail → current scope + tenant/subsystem for the org tree.
        const detailRes = await backendRequest({ url: 'auth/role/getDetail', method: 'get', params: { id: props.rid } });
        const detail = getApiResponseData<Record<string, unknown>>(detailRes) ?? {};
        const code = String(detail.dataScope ?? 'ALL');
        scope.value = (SCOPE_CODES as readonly string[]).includes(code) ? code : 'ALL';
        subSystemCode.value = (detail.subsysCode ?? null) as string | null;
        tenantId.value = (detail.tenantId ?? null) as string | null;

        // 2) When already CUSTOM, load the tree first (so labels render) then the current grants.
        if (scope.value === 'CUSTOM') {
          await loadOrgTree();
          const orgRes = await backendRequest({ url: 'auth/roleDataScope/getRoleOrgIds', method: 'get', params: { roleId: props.rid } });
          const orgIds = getApiResponseData<string[]>(orgRes);
          selectedOrgIds.value = Array.isArray(orgIds) ? orgIds.map(String) : [];
        }
      } finally {
        loading.value = false;
      }
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      submitting.value = true;
      try {
        // updateScope binds via @RequestParam → send params in the query string.
        const scopeRes = await backendRequest({
          url: 'auth/roleDataScope/updateScope',
          method: 'post',
          params: { roleId: props.rid, dataScope: scope.value },
          paramsInQuery: true,
        });
        if (!isApiSuccessResponse(scopeRes)) {
          ElMessage.error(await resolveApiResponseMessage(scopeRes) || getApiResponseMessage(scopeRes) || t('roleDataScope.messages.failed'));
          return;
        }
        // Only CUSTOM carries explicit org grants; other scopes ignore the auth_role_org table.
        if (scope.value === 'CUSTOM') {
          const bindRes = await backendRequest({
            url: 'auth/roleDataScope/bindRoleOrgs',
            method: 'post',
            params: { roleId: props.rid, orgIds: selectedOrgIds.value },
          });
          if (!isApiSuccessResponse(bindRes)) {
            ElMessage.error(await resolveApiResponseMessage(bindRes) || getApiResponseMessage(bindRes) || t('roleDataScope.messages.failed'));
            return;
          }
        }
        ElMessage.success(t('roleDataScope.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        submitting.value = false;
      }
    }

    onMounted(load);

    return {
      props,
      t,
      loading,
      submitting,
      scope,
      selectedOrgIds,
      orgTree,
      treeProps,
      scopeOptions,
      scopeDescription,
      onScopeChange,
      handleClose,
      submit,
    };
  },
});
</script>

<style lang="css" scoped>
.role-data-scope-dialog .rds-full {
  width: 100%;
}
.role-data-scope-dialog .rds-desc {
  margin: 0 0 16px;
}
.role-data-scope-dialog .rds-orgs-item :deep(.el-select) {
  width: 100%;
}
</style>
