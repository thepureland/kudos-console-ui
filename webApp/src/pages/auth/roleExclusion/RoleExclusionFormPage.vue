<!--
 * Create an SoD (Separation of Duties) role-exclusion pair.
 *
 * Backend (AuthRoleExclusionAdminController, kudos-ms-auth):
 *   POST /api/admin/auth/roleExclusion/save  body={ roleAId, roleBId, tenantId, description }
 *
 * Two remote-search role selects. Picking role A locks the tenant; role B search is then
 * constrained to the same tenant so the backend's "both roles must share a tenant" rule can
 * never be violated from the UI. The pair order is irrelevant — the backend canonicalises.
 *
 * Only create + delete are exposed (no edit of the pair itself); to change a pair, delete and
 * recreate. (The backend does allow editing the description, but that's a rare operation we
 * skip in v1 to keep the form focused.)
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('roleExclusionForm.title')"
    width="520px"
    center
    class="add-edit-dialog role-exclusion-form-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formModel" :rules="rules" label-width="120px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('roleExclusionForm.labels.roleA')" prop="roleAId" class="is-required">
        <el-select
          v-model="formModel.roleAId"
          :placeholder="t('roleExclusionForm.placeholders.roleA')"
          filterable
          remote
          clearable
          :remote-method="(q) => searchRoles('A', q)"
          :loading="loadingA"
          class="form-select-full"
          @change="onRoleAChange"
        >
          <el-option v-for="r in candidatesA" :key="r.id" :value="r.id" :label="r.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('roleExclusionForm.labels.roleB')" prop="roleBId" class="is-required">
        <el-select
          v-model="formModel.roleBId"
          :placeholder="formModel.roleAId ? t('roleExclusionForm.placeholders.roleB') : t('roleExclusionForm.placeholders.roleBLocked')"
          filterable
          remote
          clearable
          :disabled="!formModel.roleAId"
          :remote-method="(q) => searchRoles('B', q)"
          :loading="loadingB"
          class="form-select-full"
        >
          <el-option v-for="r in candidatesB" :key="r.id" :value="r.id" :label="r.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('roleExclusionForm.labels.description')" prop="description">
        <el-input
          v-model="formModel.description"
          type="textarea"
          :rows="3"
          :placeholder="t('roleExclusionForm.placeholders.description')"
          :maxlength="256"
          show-word-limit
          resize="none"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('roleExclusionForm.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('roleExclusionForm.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

interface RoleOption {
  id: string;
  label: string;
  tenantId: string | null;
}

const roleLabel = (row: Record<string, unknown>) =>
  String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');

export default defineComponent({
  name: 'RoleExclusionFormPage',
  props: {
    modelValue: { type: Boolean, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const formRef = ref<FormInstance | null>(null);
    const formModel = reactive({
      roleAId: null as string | null,
      roleBId: null as string | null,
      description: null as string | null,
    });
    const candidatesA = ref<RoleOption[]>([]);
    const candidatesB = ref<RoleOption[]>([]);
    const loadingA = ref(false);
    const loadingB = ref(false);
    const submitting = ref(false);
    /** Tenant locked by the role-A choice; role-B candidates are constrained to it. */
    const lockedTenantId = ref<string | null>(null);

    const rules = computed(() => ({
      roleAId: [{ required: true, message: t('roleExclusionForm.validation.requiredRoleA'), trigger: 'change' }],
      roleBId: [
        { required: true, message: t('roleExclusionForm.validation.requiredRoleB'), trigger: 'change' },
        {
          validator: (_r: unknown, v: string | null, cb: (e?: Error) => void) => {
            if (v && v === formModel.roleAId) cb(new Error(t('roleExclusionForm.validation.distinct')));
            else cb();
          },
          trigger: 'change',
        },
      ],
    }));

    async function searchRoles(side: 'A' | 'B', keyword: string): Promise<void> {
      const loadingRef = side === 'A' ? loadingA : loadingB;
      const targetRef = side === 'A' ? candidatesA : candidatesB;
      loadingRef.value = true;
      try {
        const params: Record<string, unknown> = { pageNo: 1, pageSize: 50, active: true };
        if (keyword?.trim()) params.name = keyword.trim();
        // Role B is constrained to the tenant locked by role A.
        if (side === 'B' && lockedTenantId.value) params.tenantId = lockedTenantId.value;
        const result = await backendRequest({ url: 'auth/role/pagingSearch', method: 'post', params });
        if (!isApiSuccessResponse(result)) { targetRef.value = []; return; }
        const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
        const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? []);
        targetRef.value = rows
          .map(r => ({ id: String(r.id ?? ''), label: roleLabel(r), tenantId: (r.tenantId ?? null) as string | null }))
          .filter(o => o.id !== '');
      } finally {
        loadingRef.value = false;
      }
    }

    function onRoleAChange(roleId: string | null): void {
      const picked = candidatesA.value.find(r => r.id === roleId);
      lockedTenantId.value = picked?.tenantId ?? null;
      // Clear role B since its tenant constraint just changed.
      formModel.roleBId = null;
      candidatesB.value = [];
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      const inst = formRef.value;
      if (!inst) return;
      const valid = await inst.validate().catch(() => false);
      if (!valid) return;
      if (!lockedTenantId.value) {
        ElMessage.error(t('roleExclusionForm.messages.tenantMissing'));
        return;
      }
      submitting.value = true;
      try {
        const payload: Record<string, unknown> = {
          roleAId: formModel.roleAId,
          roleBId: formModel.roleBId,
          tenantId: lockedTenantId.value,
          description: formModel.description,
        };
        const result = await backendRequest({ url: 'auth/roleExclusion/save', method: 'post', params: payload });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('roleExclusionForm.messages.createFailed'));
          return;
        }
        ElMessage.success(t('roleExclusionForm.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        submitting.value = false;
      }
    }

    // Pre-load the first page so both selects show options before the user types.
    void searchRoles('A', '');

    return {
      props,
      t,
      formRef,
      formModel,
      rules,
      candidatesA,
      candidatesB,
      loadingA,
      loadingB,
      submitting,
      searchRoles,
      onRoleAChange,
      handleClose,
      submit,
    };
  },
});
</script>

<style lang="css" scoped>
.role-exclusion-form-dialog .form-select-full {
  width: 100%;
}
</style>
