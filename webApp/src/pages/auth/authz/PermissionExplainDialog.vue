<!--
 * "Why does this user have — or not have — this permission?"
 *
 * Backend (kudos-ms-auth):
 *   GET /api/admin/auth/authz/explain?userId=&permissionCode=&clientIp=  → verdict + evidence
 *
 * Every other screen in this module answers *what* somebody can do. This answers *why*, which is
 * the question that actually gets asked when something is wrong — and the one that, without this,
 * gets answered by reading the role tree by hand and hoping.
 *
 * The evidence comes from the decision point itself rather than from a re-derivation, so what is
 * shown here can never disagree with what enforcement actually did.
 *
 * @author K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('permissionExplain.title')"
    width="720px"
    center
    class="add-edit-dialog permission-explain-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form label-width="120px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('permissionExplain.labels.permissionCode')">
        <el-input
          v-model="permissionCode"
          :placeholder="t('permissionExplain.placeholders.permissionCode')"
          clearable
          @keyup.enter="explain"
        />
      </el-form-item>
      <el-form-item :label="t('permissionExplain.labels.clientIp')">
        <el-input v-model="clientIp" :placeholder="t('permissionExplain.placeholders.clientIp')" clearable />
        <span class="pxd-hint">{{ t('permissionExplain.hints.clientIp') }}</span>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" :disabled="!permissionCode" @click="explain">
          {{ t('permissionExplain.buttons.explain') }}
        </el-button>
      </el-form-item>
    </el-form>

    <div v-if="explanation" v-loading="loading" class="pxd-result">
      <el-alert
        :title="verdictTitle"
        :type="explanation.decision.permitted ? 'success' : 'error'"
        :description="explanation.decision.detail ?? ''"
        :closable="false"
        show-icon
      />

      <div class="pxd-section-title">{{ t('permissionExplain.evidenceTitle') }}</div>
      <el-table v-if="explanation.relevantGrants.length > 0" :data="explanation.relevantGrants" size="small" max-height="260">
        <el-table-column prop="permissionCode" :label="t('permissionExplain.columns.code')" min-width="160" />
        <el-table-column :label="t('permissionExplain.columns.effect')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.effect === 'DENY' ? 'danger' : 'success'" size="small">{{ row.effect }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('permissionExplain.columns.role')" min-width="160">
          <template #default="{ row }">{{ row.roleName ?? row.roleCode ?? row.roleId ?? '-' }}</template>
        </el-table-column>
        <el-table-column :label="t('permissionExplain.columns.source')" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ t(`permissionExplain.sources.${row.source}`) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('permissionExplain.columns.condition')" min-width="140">
          <template #default="{ row }">{{ row.condition ?? '-' }}</template>
        </el-table-column>
      </el-table>
      <!-- An empty list IS the explanation, and the most common one: nothing this subject holds
           speaks to the permission at all. Saying so beats an empty table with no caption. -->
      <el-empty v-else :description="t('permissionExplain.noEvidence')" :image-size="72" />
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('permissionExplain.buttons.close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../../utils/backendRequest';

interface GrantEvidence {
  permissionCode: string;
  effect: string;
  roleId: string | null;
  roleCode: string | null;
  roleName: string | null;
  source: string;
  condition: string | null;
}

interface Explanation {
  userId: string;
  permissionCode: string;
  decision: { permitted: boolean; reason: string; matchedCode: string | null; detail: string | null };
  relevantGrants: GrantEvidence[];
}

export default defineComponent({
  name: 'PermissionExplainDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    userId: { type: String, required: true },
    userName: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(false);
    const permissionCode = ref('');
    const clientIp = ref('');
    const explanation = ref<Explanation | null>(null);

    const verdictTitle = computed(() => {
      const e = explanation.value;
      if (!e) return '';
      const reason = t(`permissionExplain.reasons.${e.decision.reason}`);
      return e.decision.permitted
        ? t('permissionExplain.verdictAllowed', { user: props.userName || props.userId, reason })
        : t('permissionExplain.verdictDenied', { user: props.userName || props.userId, reason });
    });

    async function explain(): Promise<void> {
      if (!permissionCode.value) return;
      loading.value = true;
      try {
        const result = await backendRequest({
          url: 'auth/authz/explain',
          method: 'get',
          params: {
            userId: props.userId,
            permissionCode: permissionCode.value.trim(),
            clientIp: clientIp.value.trim() || null,
          },
        });
        if (isApiSuccessResponse(result)) {
          explanation.value = getApiResponseData<Explanation>(result) ?? null;
        } else {
          ElMessage.error(resolveApiResponseMessage(result, t('permissionExplain.messages.failed')));
        }
      } finally {
        loading.value = false;
      }
    }

    function handleClose(): void {
      explanation.value = null;
      permissionCode.value = '';
      clientIp.value = '';
      context.emit('update:modelValue', false);
    }

    return { props, t, loading, permissionCode, clientIp, explanation, verdictTitle, explain, handleClose };
  },
});
</script>

<style scoped>
.pxd-result {
  margin-top: 8px;
}

.pxd-section-title {
  margin: 14px 0 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pxd-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
