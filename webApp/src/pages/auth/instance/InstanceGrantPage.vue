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
 * @author AI: Codex
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

    <instance-grant-dialog
      v-if="shareVisible"
      v-model="shareVisible"
      :principal-id="shareDefaults.principalId"
      :resource-type="shareDefaults.resourceType"
      :instance-id="shareDefaults.instanceId"
      @shared="onShared"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import InstanceGrantDialog from '../../../components/auth/InstanceGrantDialog.vue';
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
  components: { InstanceGrantDialog },
  setup() {
    const { t } = useI18n();
    const loading = ref(false);
    const userLoading = ref(false);
    const shareVisible = ref(false);
    // By-principal is the default because it is the direction no other console screen can answer.
    const direction = ref<'principal' | 'instance'>('principal');
    const rows = ref<InstanceGrantRow[]>([]);
    const userCandidates = ref<UserOption[]>([]);
    const query = reactive({ principalId: '', resourceType: '', instanceId: '' });
    const shareDefaults = reactive({ principalId: '', resourceType: '', instanceId: '' });

    const canQuery = computed(() =>
      direction.value === 'principal'
        ? Boolean(query.principalId)
        : Boolean(query.resourceType && query.instanceId),
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
          params: { username: keyword || null, pageNo: 1, pageSize: 20 },
        });
        const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(result);
        const list = Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload?.data) ? payload.data : [];
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
      shareDefaults.principalId = direction.value === 'principal' ? query.principalId : '';
      shareDefaults.resourceType = query.resourceType;
      shareDefaults.instanceId = direction.value === 'instance' ? query.instanceId : '';
      shareVisible.value = true;
    }

    async function onShared(): Promise<void> {
      await load();
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
      userLoading,
      shareVisible,
      direction,
      rows,
      userCandidates,
      query,
      shareDefaults,
      canQuery,
      emptyDescription,
      onDirectionChange,
      load,
      searchUsers,
      openShareDialog,
      onShared,
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

</style>
