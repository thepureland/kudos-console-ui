<!--
 * Getting a new tenant to the point where it can administer itself.
 *
 * Backend (kudos-ms-auth):
 *   GET  /api/admin/auth/tenantBootstrap/status?tenantId=...
 *   POST /api/admin/auth/tenantBootstrap/seedRoles?tenantId=...
 *   POST /api/admin/auth/tenantBootstrap/bindFirstAdministrator  { tenantId, userId, roleCode?, force? }
 *
 * Why this is two buttons and not one. Seeding creates the tenant's built-in roles — derivable from
 * configuration, idempotent, and it grants nobody anything, which is why it normally happens by
 * itself the moment the tenant is created. Appointing the first administrator is what actually
 * confers access, so it stays a separate deliberate act. Folding them together would make "a tenant
 * was created" silently mean "somebody now has administrative control of it".
 *
 * The dialog leads with which of the two states the tenant is in, because that is the only thing
 * that tells an operator which button is the one they need.
 *
 * @author K
 * @author AI: Codex
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('tenantBootstrap.title', { tenant: props.tenantName })"
    width="720px"
    center
    class="add-edit-dialog tenant-bootstrap-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-alert :title="stateTitle" :type="stateType" :closable="false" show-icon class="tb-state" />

      <!-- Step 1 -->
      <div class="tb-step">
        <div class="tb-step-head">
          <span class="tb-step-no">1</span>
          <span class="tb-step-title">{{ t('tenantBootstrap.steps.seed.title') }}</span>
          <el-tag v-if="seeded" type="success" size="small">{{ t('tenantBootstrap.steps.seed.done') }}</el-tag>
        </div>
        <div class="tb-step-hint">{{ t('tenantBootstrap.steps.seed.hint') }}</div>
        <div class="tb-step-body">
          <el-button type="primary" :loading="seeding" @click="seed">
            {{ seeded ? t('tenantBootstrap.steps.seed.reRun') : t('tenantBootstrap.steps.seed.run') }}
          </el-button>
          <span v-if="lastSeedSummary" class="tb-summary">{{ lastSeedSummary }}</span>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="tb-step">
        <div class="tb-step-head">
          <span class="tb-step-no">2</span>
          <span class="tb-step-title">{{ t('tenantBootstrap.steps.appoint.title') }}</span>
          <el-tag v-if="administrators.length > 0" type="success" size="small">
            {{ t('tenantBootstrap.steps.appoint.done', { n: administrators.length }) }}
          </el-tag>
        </div>
        <div class="tb-step-hint">{{ t('tenantBootstrap.steps.appoint.hint') }}</div>

        <el-table
          v-if="administrators.length > 0"
          :data="administrators"
          size="small"
          max-height="160"
          class="tb-table"
        >
          <el-table-column :label="t('tenantBootstrap.columns.administrator')" min-width="200">
            <template #default="{ row }">{{ row.username ?? row.userId }}</template>
          </el-table-column>
          <el-table-column prop="userId" :label="t('tenantBootstrap.columns.userId')" min-width="240" />
        </el-table>

        <el-form :inline="true" class="tb-editor" :class="{ 'is-disabled': !seeded }">
          <el-form-item :label="t('tenantBootstrap.labels.user')">
            <el-select
              v-model="draftUserId"
              filterable
              remote
              clearable
              :disabled="!seeded"
              :remote-method="searchUsers"
              :loading="userLoading"
              :placeholder="t('tenantBootstrap.placeholders.user')"
              style="width: 260px"
            >
              <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="appointing"
              :disabled="!seeded || !draftUserId"
              @click="appoint"
            >
              {{ t('tenantBootstrap.steps.appoint.run') }}
            </el-button>
          </el-form-item>
        </el-form>
        <!-- Appointing a second administrator is an escalation path, so it is never the default. -->
        <div v-if="administrators.length > 0" class="tb-force">
          <el-checkbox v-model="force">{{ t('tenantBootstrap.labels.force') }}</el-checkbox>
          <span class="tb-force-hint">{{ t('tenantBootstrap.hints.force') }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('tenantBootstrap.buttons.close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface BootstrapResult {
  tenantId: string;
  createdRoleCodes: string[];
  existingRoleCodes: string[];
  createdBindings: number;
  boundRoleCode: string | null;
  boundUserId: string | null;
}

interface BootstrapStatus {
  tenantId: string;
  seeded: boolean;
  presentRoleCodes: string[];
  missingRoleCodes: string[];
  administrators: Array<{ userId: string; username: string | null }>;
}

interface UserOption {
  id: string;
  label: string;
}

export default defineComponent({
  name: 'TenantBootstrapDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    tid: { type: String, required: true },
    tenantName: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const seeding = ref(false);
    const appointing = ref(false);
    const userLoading = ref(false);
    const seeded = ref(false);
    const force = ref(false);
    const administrators = ref<BootstrapStatus['administrators']>([]);
    const userCandidates = ref<UserOption[]>([]);
    const draftUserId = ref('');
    const lastSeedSummary = ref('');

    // Three states, and the operator needs to know which one they are in before either button
    // means anything: not seeded / seeded but nobody in charge / running itself.
    const stateTitle = computed(() => {
      if (!seeded.value) return t('tenantBootstrap.state.unseeded');
      if (administrators.value.length === 0) return t('tenantBootstrap.state.noAdministrator');
      return t('tenantBootstrap.state.ready', { n: administrators.value.length });
    });
    const stateType = computed(() => {
      if (!seeded.value) return 'warning';
      return administrators.value.length === 0 ? 'warning' : 'success';
    });

    async function load(): Promise<void> {
      loading.value = true;
      try {
        // One call for both facts. Deriving "not seeded" from a failed role lookup would make this
        // dialog guess at the difference between "nothing here yet" and "something went wrong" —
        // and that difference is exactly what decides which button the operator needs.
        const result = await backendRequest({
          url: 'auth/tenantBootstrap/status',
          method: 'get',
          params: { tenantId: props.tid },
        });
        if (isApiSuccessResponse(result)) {
          const status = getApiResponseData<BootstrapStatus>(result);
          seeded.value = status?.seeded ?? false;
          administrators.value = status?.administrators ?? [];
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('tenantBootstrap.messages.loadFailed')));
        }
      } finally {
        loading.value = false;
      }
    }

    watch(
      () => props.modelValue,
      visible => {
        if (visible) {
          draftUserId.value = '';
          force.value = false;
          lastSeedSummary.value = '';
          void load();
        }
      },
      { immediate: true },
    );

    async function seed(): Promise<void> {
      seeding.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/tenantBootstrap/seedRoles',
          method: 'post',
          params: { tenantId: props.tid },
        });
        if (isApiSuccessResponse(result)) {
          const data = getApiResponseData<BootstrapResult>(result);
          const created = data?.createdRoleCodes?.length ?? 0;
          const existing = data?.existingRoleCodes?.length ?? 0;
          // Reported separately because re-running is normal: "created 0, existing 3" is the healthy
          // idempotent outcome and a bare 0 would read as a failure.
          lastSeedSummary.value = t('tenantBootstrap.messages.seeded', {
            created,
            existing,
            bindings: data?.createdBindings ?? 0,
          });
          ElMessage.success(lastSeedSummary.value);
          await load();
          context.emit('response', result);
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('tenantBootstrap.messages.seedFailed')));
        }
      } finally {
        seeding.value = false;
      }
    }

    async function searchUsers(keyword: string): Promise<void> {
      userLoading.value = true;
      try {
        const result = await backendRequest({
          url: 'user/account/search',
          method: 'post',
          params: { username: keyword || null, tenantId: props.tid, pageNo: 1, pageSize: 20 },
        });
        const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(result);
        const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : [];
        userCandidates.value = rows.map(row => ({
          id: String(row.id ?? ''),
          label: String(row.displayName ?? row.username ?? row.id ?? ''),
        }));
      } finally {
        userLoading.value = false;
      }
    }

    async function appoint(): Promise<void> {
      appointing.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/tenantBootstrap/bindFirstAdministrator',
          method: 'post',
          params: { tenantId: props.tid, userId: draftUserId.value, force: force.value },
        });
        if (isApiSuccessResponse(result)) {
          ElMessage.success(t('tenantBootstrap.messages.appointed'));
          draftUserId.value = '';
          await load();
          context.emit('response', result);
        } else {
          // The backend refuses a second administrator, a cross-tenant user, or an unseeded tenant,
          // and says which — passing that through verbatim is the whole value of the message.
          ElMessage.error(resolveApiResponseMessage(result, t('tenantBootstrap.messages.appointFailed')));
        }
      } finally {
        appointing.value = false;
      }
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    return {
      props,
      t,
      loading,
      seeding,
      appointing,
      userLoading,
      seeded,
      force,
      administrators,
      userCandidates,
      draftUserId,
      lastSeedSummary,
      stateTitle,
      stateType,
      seed,
      searchUsers,
      appoint,
      handleClose,
    };
  },
});
</script>

<style scoped>
.tb-state {
  margin-bottom: 14px;
}

.tb-step {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.tb-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.tb-step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
}

.tb-step-hint {
  margin: 6px 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.tb-step-body {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tb-summary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tb-table {
  width: 100%;
  margin-bottom: 10px;
}

.tb-editor {
  margin-bottom: 0;
}

.tb-editor.is-disabled {
  opacity: 0.6;
}

.tb-force {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tb-force-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
