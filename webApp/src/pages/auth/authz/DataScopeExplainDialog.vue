<!--
 * "Which data can this user see, and why?"
 *
 * Backend (kudos-ms-auth):
 *   GET /api/admin/auth/roleDataScope/explain?userId=...  → resolved scope + per-role breakdown
 *
 * The companion to PermissionExplainDialog: that one answers "may they press this button", this one
 * answers "may they see this row". Both are the questions operators actually ask; every other screen
 * in the module answers "what is configured", which is not the same thing.
 *
 * Why the per-role breakdown carries the weight here: resolution takes the **most permissive**
 * policy across every effective role, so the outcome cannot be read off any single role's config.
 * The recurring confusion — "I restricted this role and he still sees everything" — has exactly one
 * cause, another role of theirs being ALL, and the banner below names it.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('dataScopeExplain.title', { user: props.userName || props.userId })"
    width="760px"
    center
    class="add-edit-dialog data-scope-explain-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <template v-if="explanation">
        <!-- The headline: what the row filter will actually apply. -->
        <el-alert :title="verdict" :type="explanation.resolved.all ? 'warning' : 'success'" :closable="false" show-icon />

        <!-- The single most useful sentence this dialog can produce. -->
        <el-alert
          v-if="explanation.overriddenBy"
          class="dse-override"
          type="error"
          :closable="false"
          show-icon
          :title="t('dataScopeExplain.overridden', {
            role: explanation.overriddenBy.roleName ?? explanation.overriddenBy.roleCode ?? explanation.overriddenBy.roleId,
          })"
        />

        <div class="dse-section-title">{{ t('dataScopeExplain.resolvedTitle') }}</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('dataScopeExplain.labels.self')">
            {{ explanation.resolved.self ? t('dataScopeExplain.yes') : t('dataScopeExplain.no') }}
          </el-descriptions-item>
          <el-descriptions-item
            v-for="(values, dim) in explanation.resolved.dimensions"
            :key="dim"
            :label="dim"
          >
            <el-tag v-for="v in values" :key="v" size="small" class="dse-tag">{{ v }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <!-- An unrestricted subject has no dimensions at all; saying so beats an empty table. -->
        <el-empty
          v-if="!explanation.resolved.all && Object.keys(explanation.resolved.dimensions).length === 0 && !explanation.resolved.self"
          :description="t('dataScopeExplain.noDimensions')"
          :image-size="60"
        />

        <div class="dse-section-title">{{ t('dataScopeExplain.contributionsTitle') }}</div>
        <el-table :data="explanation.contributions" size="small" max-height="260">
          <el-table-column :label="t('dataScopeExplain.columns.role')" min-width="160">
            <template #default="{ row }">{{ row.roleName ?? row.roleCode ?? row.roleId }}</template>
          </el-table-column>
          <el-table-column :label="t('dataScopeExplain.columns.policy')" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="row.policy === 'ALL' ? 'danger' : 'info'" size="small">
                {{ t(`roleList.dataScopes.${row.policy}`) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('dataScopeExplain.columns.source')" width="110" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ t(`permissionExplain.sources.${row.source}`) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('dataScopeExplain.columns.contributed')" min-width="240">
            <template #default="{ row }">
              <span v-if="row.contributesSelf">{{ t('dataScopeExplain.contributesSelf') }}</span>
              <span v-else-if="Object.keys(row.contributed).length === 0" class="dse-muted">
                {{ t('dataScopeExplain.contributesNothing') }}
              </span>
              <span v-else>
                <span v-for="(values, dim) in row.contributed" :key="dim" class="dse-contrib">
                  {{ dim }}: {{ values.length ?? Object.keys(values).length }}
                </span>
              </span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="t('dataScopeExplain.noRoles')" :image-size="72" />
          </template>
        </el-table>
      </template>
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('dataScopeExplain.buttons.close') }}</el-button>
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

interface RoleContribution {
  roleId: string;
  roleCode: string | null;
  roleName: string | null;
  policy: string;
  source: string;
  contributed: Record<string, string[]>;
  contributesSelf: boolean;
}

interface DataScopeExplanation {
  userId: string;
  resolved: { all: boolean; self: boolean; dimensions: Record<string, string[]> };
  contributions: RoleContribution[];
  overriddenBy: RoleContribution | null;
}

export default defineComponent({
  name: 'DataScopeExplainDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const explanation = ref<DataScopeExplanation | null>(null);

    const verdict = computed(() => {
      const e = explanation.value;
      if (!e) return '';
      if (e.resolved.all) return t('dataScopeExplain.verdictAll');
      const dims = Object.keys(e.resolved.dimensions).length;
      if (dims === 0 && e.resolved.self) return t('dataScopeExplain.verdictSelfOnly');
      return t('dataScopeExplain.verdictRestricted', { n: dims });
    });

    async function load(): Promise<void> {
      loading.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/roleDataScope/explain',
          method: 'get',
          params: { userId: props.userId },
        });
        if (isApiSuccessResponse(result)) {
          explanation.value = getApiResponseData<DataScopeExplanation>(result) ?? null;
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('dataScopeExplain.messages.failed')));
        }
      } finally {
        loading.value = false;
      }
    }

    watch(
      () => props.modelValue,
      visible => {
        if (visible) {
          explanation.value = null;
          void load();
        }
      },
      { immediate: true },
    );

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    return { props, t, loading, explanation, verdict, handleClose };
  },
});
</script>

<style scoped>
.dse-override {
  margin-top: 10px;
}

.dse-section-title {
  margin: 14px 0 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dse-tag {
  margin: 0 6px 4px 0;
}

.dse-contrib {
  margin-right: 12px;
}

.dse-muted {
  color: var(--el-text-color-secondary);
}
</style>
