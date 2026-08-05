<!--
 * Instance-level shares: "this person may act on this particular row".
 *
 * Backend (kudos-ms-auth):
 *   GET    /api/admin/auth/instanceGrant/listShares?resourceType=&instanceId=
 *   GET    /api/admin/auth/instanceGrant/listSharesOfPrincipal?principalId=&resourceType=
 *   POST   /api/admin/auth/instanceGrant/share       { principalId, tenantId, resourceType, instanceId, action, effect, startTime, endTime }
 *   DELETE /api/admin/auth/instanceGrant/unshare?grantId=&reason=
 *
 * **Why this page exists at all**, given sharing itself is an application action (a document app
 * calls the service when somebody presses Share). What has no other home is the *oversight*.
 * Instance grants sit outside the role model on purpose, so every role report is blind to them —
 * which means "what does this person have access to" has an answer that is quietly incomplete, and
 * an offboarding review misses precisely the access that was handed out informally.
 *
 * Hence two directions, and the by-principal one is the default: it is the question no other screen
 * in the console can answer.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="instance-grant-page">
    <el-alert :title="t('instanceGrant.intro')" type="info" :closable="false" show-icon class="ig-intro" />

    <el-radio-group v-model="direction" class="ig-direction" @change="onDirectionChange">
      <el-radio-button value="principal">{{ t('instanceGrant.directions.principal') }}</el-radio-button>
      <el-radio-button value="instance">{{ t('instanceGrant.directions.instance') }}</el-radio-button>
    </el-radio-group>

    <div class="ig-toolbar">
      <template v-if="direction === 'principal'">
        <el-select
          v-model="query.principalId"
          filterable
          remote
          clearable
          :remote-method="searchUsers"
          :loading="userLoading"
          :placeholder="t('instanceGrant.placeholders.principal')"
          style="width: 260px"
        >
          <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
        </el-select>
        <el-input
          v-model="query.resourceType"
          :placeholder="t('instanceGrant.placeholders.resourceTypeOptional')"
          clearable
          style="width: 180px"
        />
      </template>
      <template v-else>
        <el-input
          v-model="query.resourceType"
          :placeholder="t('instanceGrant.placeholders.resourceType')"
          clearable
          style="width: 180px"
        />
        <el-input
          v-model="query.instanceId"
          :placeholder="t('instanceGrant.placeholders.instanceId')"
          clearable
          style="width: 220px"
          @keyup.enter="load"
        />
      </template>
      <el-button type="primary" :loading="loading" :disabled="!canQuery" @click="load">
        {{ t('instanceGrant.actions.search') }}
      </el-button>
      <el-button @click="openShareDialog">{{ t('instanceGrant.actions.share') }}</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" size="small" border stripe>
      <el-table-column :label="t('instanceGrant.columns.principal')" min-width="180">
        <template #default="{ row }">{{ row.principalName ?? row.principalId }}</template>
      </el-table-column>
      <el-table-column prop="resourceType" :label="t('instanceGrant.columns.resourceType')" min-width="120" />
      <el-table-column prop="instanceId" :label="t('instanceGrant.columns.instanceId')" min-width="180" />
      <el-table-column prop="action" :label="t('instanceGrant.columns.action')" min-width="150" />
      <el-table-column :label="t('instanceGrant.columns.effect')" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.effect === 'DENY' ? 'danger' : 'success'" size="small">{{ row.effect }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('instanceGrant.columns.window')" min-width="220">
        <template #default="{ row }">{{ formatWindow(row.startTime, row.endTime) }}</template>
      </el-table-column>
      <el-table-column prop="grantedBy" :label="t('instanceGrant.columns.grantedBy')" min-width="160">
        <template #default="{ row }">{{ row.grantedBy ?? '-' }}</template>
      </el-table-column>
      <el-table-column :label="t('instanceGrant.columns.operation')" width="100" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="danger" @click="unshare(row)">
            {{ t('instanceGrant.actions.unshare') }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyDescription" :image-size="80" />
      </template>
    </el-table>

    <!-- Share editor -->
    <el-dialog
      v-model="shareVisible"
      :title="t('instanceGrant.share.title')"
      width="620px"
      center
      class="add-edit-dialog"
      align-center
      :append-to-body="false"
      :close-on-click-modal="false"
    >
      <el-form label-width="120px" label-position="right" class="add-edit-dialog-form">
        <el-form-item :label="t('instanceGrant.labels.principal')" class="is-required">
          <el-select
            v-model="draft.principalId"
            filterable
            remote
            clearable
            :remote-method="searchUsers"
            :loading="userLoading"
            :placeholder="t('instanceGrant.placeholders.principal')"
            class="ig-full"
          >
            <el-option v-for="u in userCandidates" :key="u.id" :value="u.id" :label="u.label" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.tenantId')" class="is-required">
          <el-input v-model="draft.tenantId" :placeholder="t('instanceGrant.placeholders.tenantId')" clearable />
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.resourceType')" class="is-required">
          <el-input v-model="draft.resourceType" :placeholder="t('instanceGrant.placeholders.resourceType')" clearable />
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.instanceId')" class="is-required">
          <el-input v-model="draft.instanceId" :placeholder="t('instanceGrant.placeholders.instanceId')" clearable />
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.action')" class="is-required">
          <el-input v-model="draft.action" :placeholder="t('instanceGrant.placeholders.action')" clearable />
          <span class="ig-hint">{{ t('instanceGrant.hints.action') }}</span>
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.effect')">
          <el-select v-model="draft.effect" style="width: 120px">
            <el-option value="ALLOW" label="ALLOW" />
            <el-option value="DENY" label="DENY" />
          </el-select>
          <span class="ig-hint">{{ t('instanceGrant.hints.effect') }}</span>
        </el-form-item>
        <el-form-item :label="t('instanceGrant.labels.window')">
          <el-date-picker
            v-model="draft.window"
            type="datetimerange"
            :start-placeholder="t('instanceGrant.placeholders.startTime')"
            :end-placeholder="t('instanceGrant.placeholders.endTime')"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="ig-full"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="add-edit-dialog-footer">
          <el-button @click="shareVisible = false">{{ t('instanceGrant.actions.cancel') }}</el-button>
          <el-button type="primary" :loading="sharing" :disabled="!canShare" @click="submitShare">
            {{ t('instanceGrant.actions.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface InstanceGrantRow {
  id: string;
  principalId: string;
  principalName: string | null;
  principalType: string | null;
  resourceType: string;
  instanceId: string;
  action: string;
  effect: string;
  startTime: string | null;
  endTime: string | null;
  grantedBy: string | null;
  active: boolean;
}

interface UserOption {
  id: string;
  label: string;
}

export default defineComponent({
  name: 'InstanceGrantPage',
  setup() {
    const { t } = useI18n();
    const loading = ref(false);
    const sharing = ref(false);
    const userLoading = ref(false);
    const shareVisible = ref(false);
    // By-principal is the default because it is the direction no other console screen can answer.
    const direction = ref<'principal' | 'instance'>('principal');
    const rows = ref<InstanceGrantRow[]>([]);
    const userCandidates = ref<UserOption[]>([]);
    const query = reactive({ principalId: '', resourceType: '', instanceId: '' });
    const draft = reactive({
      principalId: '',
      tenantId: '',
      resourceType: '',
      instanceId: '',
      action: '',
      effect: 'ALLOW',
      window: null as string[] | null,
    });

    const canQuery = computed(() =>
      direction.value === 'principal'
        ? Boolean(query.principalId)
        : Boolean(query.resourceType && query.instanceId),
    );

    const canShare = computed(() =>
      Boolean(draft.principalId && draft.tenantId && draft.resourceType && draft.instanceId && draft.action),
    );

    // An empty table says opposite things before and after a query; saying which avoids reading a
    // blank result as "this person has nothing".
    const emptyDescription = computed(() =>
      canQuery.value ? t('instanceGrant.empty.noResults') : t('instanceGrant.empty.noQuery'),
    );

    function onDirectionChange(): void {
      rows.value = [];
    }

    async function load(): Promise<void> {
      if (!canQuery.value) return;
      loading.value = true;
      try {
        const result =
          direction.value === 'principal'
            ? await backendRequest({
                url: 'auth/instanceGrant/listSharesOfPrincipal',
                method: 'get',
                params: { principalId: query.principalId, resourceType: query.resourceType || null },
              })
            : await backendRequest({
                url: 'auth/instanceGrant/listShares',
                method: 'get',
                params: { resourceType: query.resourceType, instanceId: query.instanceId },
              });
        if (isApiSuccessResponse(result)) {
          rows.value = getApiResponseData<InstanceGrantRow[]>(result) ?? [];
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('instanceGrant.messages.loadFailed')));
        }
      } finally {
        loading.value = false;
      }
    }

    async function searchUsers(keyword: string): Promise<void> {
      userLoading.value = true;
      try {
        const result = await backendRequest({
          url: 'user/account/search',
          method: 'post',
          data: { username: keyword || null, pageNo: 1, pageSize: 20 },
        });
        const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>> }>(result);
        const list = Array.isArray(payload?.rows) ? payload!.rows! : [];
        userCandidates.value = list.map(row => ({
          id: String(row.id ?? ''),
          label: String(row.displayName ?? row.username ?? row.id ?? ''),
        }));
      } finally {
        userLoading.value = false;
      }
    }

    function openShareDialog(): void {
      // Carry over whatever the operator has already typed — they are usually sharing the very
      // thing they were just looking at.
      draft.principalId = direction.value === 'principal' ? query.principalId : '';
      draft.resourceType = query.resourceType;
      draft.instanceId = direction.value === 'instance' ? query.instanceId : '';
      draft.action = '';
      draft.effect = 'ALLOW';
      draft.window = null;
      shareVisible.value = true;
    }

    async function submitShare(): Promise<void> {
      sharing.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/instanceGrant/share',
          method: 'post',
          data: {
            principalId: draft.principalId,
            tenantId: draft.tenantId.trim(),
            resourceType: draft.resourceType.trim(),
            instanceId: draft.instanceId.trim(),
            action: draft.action.trim(),
            effect: draft.effect,
            startTime: draft.window?.[0] ?? null,
            endTime: draft.window?.[1] ?? null,
          },
        });
        if (isApiSuccessResponse(result)) {
          ElMessage.success(t('instanceGrant.messages.shared'));
          shareVisible.value = false;
          await load();
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('instanceGrant.messages.shareFailed')));
        }
      } finally {
        sharing.value = false;
      }
    }

    async function unshare(row: InstanceGrantRow): Promise<void> {
      let reason = '';
      try {
        const prompt = await ElMessageBox.prompt(
          t('instanceGrant.confirm.unshare', { instance: `${row.resourceType}#${row.instanceId}` }),
          t('instanceGrant.confirm.title'),
          {
            type: 'warning',
            inputPlaceholder: t('instanceGrant.placeholders.reason'),
            inputValue: '',
          },
        );
        reason = prompt.value ?? '';
      } catch {
        return; // dismissed
      }
      const result = await backendRequest({
        url: 'auth/instanceGrant/unshare',
        method: 'delete',
        params: { grantId: row.id, reason: reason || null },
      });
      if (isApiSuccessResponse(result)) {
        ElMessage.success(t('instanceGrant.messages.unshared'));
        await load();
      } else {
        ElMessage.error(resolveApiResponseMessage(result, t('instanceGrant.messages.unshareFailed')));
      }
    }

    function formatWindow(start: string | null, end: string | null): string {
      if (!start && !end) return t('instanceGrant.unbounded');
      const fmt = (v: string | null) => (v ? String(v).replace('T', ' ').slice(0, 19) : '—');
      return `${fmt(start)} ~ ${fmt(end)}`;
    }

    return {
      t,
      loading,
      sharing,
      userLoading,
      shareVisible,
      direction,
      rows,
      userCandidates,
      query,
      draft,
      canQuery,
      canShare,
      emptyDescription,
      onDirectionChange,
      load,
      searchUsers,
      openShareDialog,
      submitShare,
      unshare,
      formatWindow,
    };
  },
});
</script>

<style scoped>
.instance-grant-page {
  padding: 16px;
}

.ig-intro {
  margin-bottom: 12px;
}

.ig-direction {
  margin-bottom: 12px;
}

.ig-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ig-full {
  width: 100%;
}

.ig-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
