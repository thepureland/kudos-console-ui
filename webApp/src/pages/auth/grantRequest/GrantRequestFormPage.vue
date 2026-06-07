<!--
 * Submit a new role-grant approval request.
 *
 * Backend (AuthRoleGrantRequestAdminController, kudos-ms-auth):
 *   POST /api/admin/auth/roleGrantRequest/submit  body={ roleId, userId, reason }  → new id
 *
 * Tenant is derived server-side from the chosen role, so the caller supplies only role + user +
 * reason. Both selects are remote-searched (role by name, user by username).
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('grantRequestForm.title')"
    width="520px"
    center
    class="add-edit-dialog grant-request-form-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formModel" :rules="rules" label-width="120px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('grantRequestForm.labels.role')" prop="roleId" class="is-required">
        <el-select
          v-model="formModel.roleId"
          :placeholder="t('grantRequestForm.placeholders.role')"
          filterable
          remote
          clearable
          :remote-method="searchRoles"
          :loading="loadingRole"
          class="form-select-full"
        >
          <el-option v-for="r in roleCandidates" :key="r.id" :value="r.id" :label="r.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('grantRequestForm.labels.user')" prop="userId" class="is-required">
        <el-select
          v-model="formModel.userId"
          :placeholder="t('grantRequestForm.placeholders.user')"
          filterable
          remote
          clearable
          :remote-method="searchUsers"
          :loading="loadingUser"
          class="form-select-full"
        >
          <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('grantRequestForm.labels.reason')" prop="reason">
        <el-input
          v-model="formModel.reason"
          type="textarea"
          :rows="3"
          :placeholder="t('grantRequestForm.placeholders.reason')"
          :maxlength="512"
          show-word-limit
          resize="none"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('grantRequestForm.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('grantRequestForm.buttons.confirm') }}</el-button>
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

interface Option {
  id: string;
  label: string;
}

// Label extractors: try the most-descriptive field first, fall back to id.
// NOTE: identical copies live in GrantRequestDetailPage.vue — keep in sync if field names change.
const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');
const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

export default defineComponent({
  name: 'GrantRequestFormPage',
  props: {
    modelValue: { type: Boolean, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const formRef = ref<FormInstance | null>(null);
    const formModel = reactive({
      roleId: null as string | null,
      userId: null as string | null,
      reason: null as string | null,
    });
    const roleCandidates = ref<Option[]>([]);
    const userCandidates = ref<Option[]>([]);
    const loadingRole = ref(false);
    const loadingUser = ref(false);
    const submitting = ref(false);

    const rules = computed(() => ({
      roleId: [{ required: true, message: t('grantRequestForm.validation.requiredRole'), trigger: 'change' }],
      userId: [{ required: true, message: t('grantRequestForm.validation.requiredUser'), trigger: 'change' }],
    }));

    /**
     * Generic remote-search helper shared by both role and user selects.
     *
     * Sends a paged POST search, then maps the result rows to {id, label} Option pairs.
     * On API error the dropdown is cleared rather than leaving stale options.
     *
     * @param searchUrl   - Backend path relative to the API base (e.g. 'auth/role/pagingSearch').
     * @param keywordField - Request param name for the search keyword (e.g. 'name', 'username').
     * @param keyword      - Raw text typed by the user; trimmed before sending.
     * @param pickLabel    - Extracts a display string from a raw API row object.
     * @param loadingRef   - Reactive boolean toggled while the request is in-flight.
     * @param targetRef    - Reactive array updated with the resulting Option list.
     */
    async function searchEntities(
      searchUrl: string,
      keywordField: string,
      keyword: string,
      pickLabel: (row: Record<string, unknown>) => string,
      loadingRef: { value: boolean },
      targetRef: { value: Option[] },
    ): Promise<void> {
      loadingRef.value = true;
      try {
        const params: Record<string, unknown> = { pageNo: 1, pageSize: 50, active: true };
        if (keyword?.trim()) params[keywordField] = keyword.trim();
        const result = await backendRequest({ url: searchUrl, method: 'post', params });
        if (!isApiSuccessResponse(result)) { targetRef.value = []; return; }
        const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
        // The API may return either a plain array or a paginated wrapper { data: [...] }.
        const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? []);
        targetRef.value = rows
          .map(r => ({ id: String(r.id ?? ''), label: pickLabel(r) }))
          .filter(o => o.id !== '');
      } finally {
        loadingRef.value = false;
      }
    }

    const searchRoles = (q: string) => searchEntities('auth/role/pagingSearch', 'name', q, roleLabel, loadingRole, roleCandidates);
    const searchUsers = (q: string) => searchEntities('user/account/pagingSearch', 'username', q, userLabel, loadingUser, userCandidates);

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      const inst = formRef.value;
      if (!inst) return;
      const valid = await inst.validate().catch(() => false);
      if (!valid) return;
      submitting.value = true;
      try {
        const payload: Record<string, unknown> = {
          roleId: formModel.roleId,
          userId: formModel.userId,
          reason: formModel.reason,
        };
        const result = await backendRequest({ url: 'auth/roleGrantRequest/submit', method: 'post', params: payload });
        if (!isApiSuccessResponse(result)) {
          // Prefer the resolved (translated/enriched) message, then raw message, then generic fallback.
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('grantRequestForm.messages.submitFailed'));
          return;
        }
        ElMessage.success(t('grantRequestForm.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        submitting.value = false;
      }
    }

    // Pre-load the first page of each select so options show before the user types.
    void searchRoles('');
    void searchUsers('');

    return {
      props,
      t,
      formRef,
      formModel,
      rules,
      roleCandidates,
      userCandidates,
      loadingRole,
      loadingUser,
      submitting,
      searchRoles,
      searchUsers,
      handleClose,
      submit,
    };
  },
});
</script>

<style lang="css" scoped>
.grant-request-form-dialog .form-select-full {
  width: 100%;
}
</style>
