<!--
 * The row-filtering migration work-list: what shadow mode has observed.
 *
 * Backend (kudos-ms-auth):
 *   GET    /api/admin/auth/authz/rowScopeFindings  → status + findings
 *   DELETE /api/admin/auth/authz/rowScopeFindings  → clear, after acting on them
 *
 * Turning row filtering on is the one change in this module that alters what queries *return*, so it
 * is adopted in shadow mode: observe first, switch on second. This page is what makes "observe" a
 * finite task instead of an open-ended log-grepping exercise — the two finding kinds map directly
 * onto the two things you have to do:
 *
 *   WOULD_FILTER → a predicate is about to be applied; check it says what you meant
 *   WOULD_FAIL   → this call has no subject; it needs DataScopeContext.runAsSystem { } or @SystemScoped
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="row-scope-shadow-page" v-loading="loading">
    <!-- An empty list means nothing on its own: it reads very differently depending on whether the
         feature is even switched on. So the state comes first. -->
    <el-alert :title="statusTitle" :type="statusType" :closable="false" show-icon class="rss-status" />

    <el-alert
      v-if="status && status.droppedCount > 0"
      class="rss-status"
      type="error"
      :closable="false"
      show-icon
      :title="t('rowScopeShadow.truncated', { n: status.droppedCount })"
    />

    <div class="rss-toolbar">
      <el-button type="primary" :loading="loading" @click="load">{{ t('rowScopeShadow.actions.refresh') }}</el-button>
      <el-button :disabled="!status || status.findings.length === 0" @click="clear">
        {{ t('rowScopeShadow.actions.clear') }}
      </el-button>
      <span v-if="status" class="rss-declared">
        {{ t('rowScopeShadow.declared', { n: status.declaredEntities.length }) }}
        <el-tag v-for="e in status.declaredEntities" :key="e" size="small" class="rss-tag">{{ e }}</el-tag>
      </span>
    </div>

    <el-table :data="status?.findings ?? []" size="small" border stripe>
      <el-table-column :label="t('rowScopeShadow.columns.kind')" width="180">
        <template #default="{ row }">
          <el-tag :type="row.kind === 'WOULD_FAIL' ? 'danger' : 'warning'" size="small">
            {{ t(`rowScopeShadow.kinds.${row.kind}`) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="entity" :label="t('rowScopeShadow.columns.entity')" min-width="160" />
      <el-table-column prop="table" :label="t('rowScopeShadow.columns.table')" min-width="150" />
      <el-table-column prop="detail" :label="t('rowScopeShadow.columns.detail')" min-width="260" />
      <el-table-column prop="count" :label="t('rowScopeShadow.columns.count')" width="90" align="right" />
      <el-table-column :label="t('rowScopeShadow.columns.lastSeen')" width="170">
        <template #default="{ row }">{{ formatTime(row.lastSeen) }}</template>
      </el-table-column>
      <el-table-column :label="t('rowScopeShadow.columns.todo')" min-width="260">
        <template #default="{ row }">{{ t(`rowScopeShadow.todo.${row.kind}`) }}</template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyDescription" :image-size="80" />
      </template>
    </el-table>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface Finding {
  kind: string;
  entity: string;
  table: string;
  detail: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

interface RowScopeStatus {
  enabled: boolean;
  shadowMode: boolean;
  declaredEntities: string[];
  droppedCount: number;
  findings: Finding[];
}

export default defineComponent({
  name: 'RowScopeShadowPage',
  setup() {
    const { t } = useI18n();
    const loading = ref(false);
    const status = ref<RowScopeStatus | null>(null);

    const statusTitle = computed(() => {
      const s = status.value;
      if (!s) return '';
      if (!s.enabled) return t('rowScopeShadow.status.disabled');
      return s.shadowMode ? t('rowScopeShadow.status.shadow') : t('rowScopeShadow.status.enforcing');
    });

    const statusType = computed(() => {
      const s = status.value;
      if (!s) return 'info';
      if (!s.enabled) return 'info';
      return s.shadowMode ? 'warning' : 'success';
    });

    // "No findings" means opposite things in the three states; saying which avoids a false all-clear.
    const emptyDescription = computed(() => {
      const s = status.value;
      if (!s || !s.enabled) return t('rowScopeShadow.empty.disabled');
      if (!s.shadowMode) return t('rowScopeShadow.empty.enforcing');
      return t('rowScopeShadow.empty.shadow');
    });

    async function load(): Promise<void> {
      loading.value = true;
      try {
        const result = await backendRequest({ url: 'auth/authz/rowScopeFindings', method: 'get' });
        if (isApiSuccessResponse(result)) {
          status.value = getApiResponseData<RowScopeStatus>(result) ?? null;
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('rowScopeShadow.messages.loadFailed')));
        }
      } finally {
        loading.value = false;
      }
    }

    async function clear(): Promise<void> {
      const result = await backendRequest({ url: 'auth/authz/rowScopeFindings', method: 'delete' });
      if (isApiSuccessResponse(result)) {
        ElMessage.success(t('rowScopeShadow.messages.cleared'));
        await load();
      } else {
        ElMessage.error(resolveApiResponseMessage(result, t('rowScopeShadow.messages.clearFailed')));
      }
    }

    function formatTime(value: string | null): string {
      if (!value) return '-';
      return String(value).replace('T', ' ').slice(0, 19);
    }

    onMounted(load);

    return { t, loading, status, statusTitle, statusType, emptyDescription, load, clear, formatTime };
  },
});
</script>

<style scoped>
.row-scope-shadow-page {
  padding: 16px;
}

.rss-status {
  margin-bottom: 12px;
}

.rss-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.rss-declared {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rss-tag {
  margin-left: 6px;
}
</style>
