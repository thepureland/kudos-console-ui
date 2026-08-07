<!--
 * Code-addressed permission bindings on a role: `sys:user:*`, ALLOW or DENY, optional condition.
 *
 * Backend (kudos-ms-auth):
 *   GET    /api/admin/auth/role/listPermissionBindings?roleId=...   → the role's code bindings
 *   POST   /api/admin/auth/role/savePermissionBinding  { roleId, permissionCode, effect, condition }
 *   DELETE /api/admin/auth/role/removePermissionBinding?bindingId=...
 *
 * Deliberately NOT folded into the resource tree. A resource binding is a checkbox on a node; these
 * are rules with three independent decisions each (which code, which effect, under what condition).
 * Putting them in the tree would force every node to grow an effect and condition editor, which is
 * the wrong shape for the overwhelming majority of nodes that are a plain ALLOW.
 *
 * @author K
 * @author AI: Codex
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('rolePermissionCode.title', { role: props.roleName })"
    width="820px"
    center
    class="add-edit-dialog role-permission-code-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-alert :title="t('rolePermissionCode.intro')" type="info" :closable="false" show-icon class="rpc-intro" />

    <el-form :inline="true" class="rpc-editor">
      <el-form-item :label="t('rolePermissionCode.labels.code')">
        <el-input
          v-model="draft.permissionCode"
          :placeholder="t('rolePermissionCode.placeholders.code')"
          clearable
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item :label="t('rolePermissionCode.labels.effect')">
        <el-select v-model="draft.effect" style="width: 110px">
          <el-option value="ALLOW" label="ALLOW" />
          <el-option value="DENY" label="DENY" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('rolePermissionCode.labels.condition')">
        <permission-condition-editor v-model="draft.condition" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" :disabled="!draft.permissionCode" @click="save">
          {{ t('rolePermissionCode.buttons.save') }}
        </el-button>
      </el-form-item>
    </el-form>
    <div class="rpc-hint">{{ t('rolePermissionCode.hints.denyWins') }}</div>

    <el-table v-loading="loading" :data="bindings" size="small" max-height="320" class="rpc-table">
      <el-table-column prop="permissionCode" :label="t('rolePermissionCode.columns.code')" min-width="200" />
      <el-table-column :label="t('rolePermissionCode.columns.effect')" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.effect === 'DENY' ? 'danger' : 'success'" size="small">{{ row.effect }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('rolePermissionCode.columns.condition')" min-width="200">
        <template #default="{ row }">{{ row.condition ?? '-' }}</template>
      </el-table-column>
      <el-table-column :label="t('rolePermissionCode.columns.operation')" width="150" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="edit(row)">
            {{ t('rolePermissionCode.buttons.edit') }}
          </el-button>
          <el-button size="small" link type="danger" @click="remove(row)">
            {{ t('rolePermissionCode.buttons.remove') }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="t('rolePermissionCode.empty')" :image-size="72" />
      </template>
    </el-table>

    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('rolePermissionCode.buttons.close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import PermissionConditionEditor from '../../../components/auth/PermissionConditionEditor.vue';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface PermissionBinding {
  id: string;
  roleId: string;
  permissionCode: string;
  effect: string;
  condition: string | null;
}

export default defineComponent({
  name: 'RolePermissionCodeDialog',
  components: { PermissionConditionEditor },
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
    roleName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const saving = ref(false);
    const bindings = ref<PermissionBinding[]>([]);
    const draft = reactive({ permissionCode: '', effect: 'ALLOW', condition: '' });

    async function load(): Promise<void> {
      loading.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/role/listPermissionBindings',
          method: 'get',
          params: { roleId: props.rid },
        });
        bindings.value = getApiResponseData<PermissionBinding[]>(result) ?? [];
      } finally {
        loading.value = false;
      }
    }

    watch(
      () => props.modelValue,
      visible => {
        if (visible) {
          resetDraft();
          void load();
        }
      },
      { immediate: true },
    );

    function resetDraft(): void {
      draft.permissionCode = '';
      draft.effect = 'ALLOW';
      draft.condition = '';
    }

    /** Loading a row into the editor rather than editing inline: saving is upsert-by-code anyway. */
    function edit(row: PermissionBinding): void {
      draft.permissionCode = row.permissionCode;
      draft.effect = row.effect;
      draft.condition = row.condition ?? '';
    }

    async function save(): Promise<void> {
      saving.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/role/savePermissionBinding',
          method: 'post',
          data: {
            roleId: props.rid,
            permissionCode: draft.permissionCode.trim(),
            effect: draft.effect,
            condition: draft.condition.trim() || null,
          },
        });
        if (isApiSuccessResponse(result)) {
          ElMessage.success(t('rolePermissionCode.messages.saved'));
          resetDraft();
          await load();
          context.emit('response', result);
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('rolePermissionCode.messages.saveFailed')));
        }
      } finally {
        saving.value = false;
      }
    }

    async function remove(row: PermissionBinding): Promise<void> {
      try {
        await ElMessageBox.confirm(
          t('rolePermissionCode.confirm.remove', { code: row.permissionCode }),
          t('rolePermissionCode.confirm.title'),
          { type: 'warning' },
        );
      } catch {
        return; // dismissed
      }
      const result = await backendRequest({
        url: 'auth/role/removePermissionBinding',
        method: 'delete',
        params: { bindingId: row.id },
      });
      if (isApiSuccessResponse(result)) {
        ElMessage.success(t('rolePermissionCode.messages.removed'));
        await load();
        context.emit('response', result);
      } else {
        ElMessage.error(resolveApiResponseMessage(result, t('rolePermissionCode.messages.removeFailed')));
      }
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    return { props, t, loading, saving, bindings, draft, edit, save, remove, handleClose };
  },
});
</script>

<style scoped>
.rpc-intro {
  margin-bottom: 12px;
}

.rpc-editor {
  margin-bottom: 0;
}

.rpc-hint {
  margin: 0 0 12px 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rpc-table {
  width: 100%;
}
</style>
