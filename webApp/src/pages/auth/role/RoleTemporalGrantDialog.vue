<!--
 * Grant this role to a user with an optional validity window (时效性授权).
 *
 * Backend (kudos-ms-auth):
 *   GET  /api/admin/auth/role/getDetail?id=...                                    → role detail (tenantId, name)
 *   POST /api/admin/auth/roleUserTemporal/bind { roleId, userId, startTime?, endTime? } → grant id (replace)
 *
 * Replace semantics: re-granting the same (role, user) supersedes the previous window. An empty
 * start = effective immediately; an empty end = never expires. Effective-now filtering and expiry
 * are enforced server-side; expired grants are reaped by the "purge expired" action on the list.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('roleTemporalGrant.title')"
    width="520px"
    center
    class="add-edit-dialog role-temporal-grant-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="formModel" :rules="rules" label-width="110px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('roleTemporalGrant.labels.role')">
        <span class="rtg-role-name">{{ roleName || props.rid }}</span>
      </el-form-item>
      <el-form-item :label="t('roleTemporalGrant.labels.user')" prop="userId" class="is-required">
        <el-select
          v-model="formModel.userId"
          :placeholder="t('roleTemporalGrant.placeholders.user')"
          filterable
          remote
          clearable
          :remote-method="searchUsers"
          :loading="loadingUser"
          class="rtg-full"
        >
          <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('roleTemporalGrant.labels.startTime')" prop="startTime">
        <el-date-picker
          v-model="formModel.startTime"
          type="datetime"
          :placeholder="t('roleTemporalGrant.placeholders.startTime')"
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="rtg-full"
        />
      </el-form-item>
      <el-form-item :label="t('roleTemporalGrant.labels.endTime')" prop="endTime">
        <el-date-picker
          v-model="formModel.endTime"
          type="datetime"
          :placeholder="t('roleTemporalGrant.placeholders.endTime')"
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="rtg-full"
        />
      </el-form-item>
      <el-alert :title="t('roleTemporalGrant.hint')" type="info" :closable="false" show-icon class="rtg-hint" />
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('roleTemporalGrant.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('roleTemporalGrant.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

interface Option {
  id: string;
  label: string;
}

const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

export default defineComponent({
  name: 'RoleTemporalGrantDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const formRef = ref<FormInstance | null>(null);
    const formModel = reactive({
      userId: null as string | null,
      startTime: null as string | null,
      endTime: null as string | null,
    });
    const userCandidates = ref<Option[]>([]);
    const loadingUser = ref(false);
    const submitting = ref(false);
    const roleName = ref<string>('');
    const tenantId = ref<string | null>(null);

    const rules = computed(() => ({
      userId: [{ required: true, message: t('roleTemporalGrant.validation.requiredUser'), trigger: 'change' }],
      endTime: [{
        validator: (_r: unknown, _v: unknown, cb: (e?: Error) => void) => {
          if (formModel.startTime && formModel.endTime && formModel.startTime > formModel.endTime) {
            cb(new Error(t('roleTemporalGrant.validation.startAfterEnd')));
          } else {
            cb();
          }
        },
        trigger: 'change',
      }],
    }));

    async function searchUsers(keyword: string): Promise<void> {
      loadingUser.value = true;
      try {
        const params: Record<string, unknown> = { pageNo: 1, pageSize: 50, active: true };
        if (keyword?.trim()) params.username = keyword.trim();
        if (tenantId.value) params.tenantId = tenantId.value;
        const result = await backendRequest({ url: 'user/account/pagingSearch', method: 'post', params });
        if (!isApiSuccessResponse(result)) { userCandidates.value = []; return; }
        const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
        const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? []);
        userCandidates.value = rows.map(r => ({ id: String(r.id ?? ''), label: userLabel(r) })).filter(o => o.id !== '');
      } finally {
        loadingUser.value = false;
      }
    }

    async function loadRole(): Promise<void> {
      const res = await backendRequest({ url: 'auth/role/getDetail', method: 'get', params: { id: props.rid } });
      const detail = getApiResponseData<Record<string, unknown>>(res) ?? {};
      roleName.value = String(detail.name ?? detail.code ?? '');
      tenantId.value = (detail.tenantId ?? null) as string | null;
      // Pre-load the first page of users now that the tenant scope is known.
      void searchUsers('');
    }

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
          roleId: props.rid,
          userId: formModel.userId,
          startTime: formModel.startTime || null,
          endTime: formModel.endTime || null,
        };
        const result = await backendRequest({ url: 'auth/roleUserTemporal/bind', method: 'post', params: payload });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('roleTemporalGrant.messages.failed'));
          return;
        }
        ElMessage.success(t('roleTemporalGrant.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        submitting.value = false;
      }
    }

    onMounted(loadRole);

    return {
      props,
      t,
      formRef,
      formModel,
      rules,
      userCandidates,
      loadingUser,
      submitting,
      roleName,
      searchUsers,
      handleClose,
      submit,
    };
  },
});
</script>

<style lang="css" scoped>
.role-temporal-grant-dialog .rtg-full {
  width: 100%;
}
.role-temporal-grant-dialog .rtg-role-name {
  font-weight: 600;
}
.role-temporal-grant-dialog .rtg-hint {
  margin-top: 4px;
}
</style>
