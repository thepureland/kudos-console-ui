<!--
 * Reusable instance-share editor. Domain pages provide the resource context while the framework
 * owns principal lookup, validity windows, ALLOW/DENY semantics, and the auth API call.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('instanceGrant.share.title')"
    width="620px"
    center
    class="add-edit-dialog instance-grant-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="close"
  >
    <el-form label-width="120px" label-position="right" class="add-edit-dialog-form">
      <el-form-item :label="t('instanceGrant.labels.principal')" class="is-required">
        <el-select
          v-model="draft.principalId"
          filterable
          remote
          clearable
          :remote-method="searchPrincipals"
          :loading="principalLoading"
          :placeholder="t('instanceGrant.placeholders.principal')"
          class="igd-full"
        >
          <el-option v-for="option in principalCandidates" :key="option.id" :value="option.id" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('instanceGrant.labels.tenantId')" class="is-required">
        <el-input v-model="draft.tenantId" :disabled="Boolean(props.tenantId)" :placeholder="t('instanceGrant.placeholders.tenantId')" clearable />
      </el-form-item>
      <el-form-item :label="t('instanceGrant.labels.resourceType')" class="is-required">
        <el-input v-model="draft.resourceType" :disabled="Boolean(props.resourceType)" :placeholder="t('instanceGrant.placeholders.resourceType')" clearable />
      </el-form-item>
      <el-form-item :label="t('instanceGrant.labels.instanceId')" class="is-required">
        <el-input v-model="draft.instanceId" :disabled="Boolean(props.instanceId)" :placeholder="t('instanceGrant.placeholders.instanceId')" clearable />
      </el-form-item>
      <el-form-item :label="t('instanceGrant.labels.action')" class="is-required">
        <el-select
          v-if="props.actionOptions.length > 0"
          v-model="draft.action"
          filterable
          allow-create
          default-first-option
          class="igd-full"
          :placeholder="t('instanceGrant.placeholders.action')"
        >
          <el-option v-for="action in props.actionOptions" :key="action" :value="action" :label="action" />
        </el-select>
        <el-input v-else v-model="draft.action" :placeholder="t('instanceGrant.placeholders.action')" clearable />
        <span class="igd-hint">{{ t('instanceGrant.hints.action') }}</span>
      </el-form-item>
      <el-form-item v-if="props.allowDeny" :label="t('instanceGrant.labels.effect')">
        <el-select v-model="draft.effect" style="width: 120px">
          <el-option value="ALLOW" label="ALLOW" />
          <el-option value="DENY" label="DENY" />
        </el-select>
        <span class="igd-hint">{{ t('instanceGrant.hints.effect') }}</span>
      </el-form-item>
      <el-form-item :label="t('instanceGrant.labels.window')">
        <el-date-picker
          v-model="draft.window"
          type="datetimerange"
          :start-placeholder="t('instanceGrant.placeholders.startTime')"
          :end-placeholder="t('instanceGrant.placeholders.endTime')"
          value-format="YYYY-MM-DDTHH:mm:ss"
          class="igd-full"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="close">{{ t('instanceGrant.actions.cancel') }}</el-button>
        <el-button type="primary" :loading="sharing" :disabled="!canShare" @click="submitShare">
          {{ t('instanceGrant.actions.confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type PropType } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../styles/add-edit-dialog-common.css';
import {
  backendRequest,
  getApiResponseData,
  isApiSuccessResponse,
  resolveApiResponseMessage,
} from '../../utils/backendRequest';

interface InstanceGrantPrincipalOption {
  id: string;
  label: string;
}

type InstanceGrantPrincipalSearch = (keyword: string) => Promise<InstanceGrantPrincipalOption[]>;

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  tenantId: { type: String, default: '' },
  resourceType: { type: String, default: '' },
  instanceId: { type: String, default: '' },
  principalId: { type: String, default: '' },
  principalType: { type: String, default: 'USER' },
  actionOptions: { type: Array as PropType<string[]>, default: () => [] },
  allowDeny: { type: Boolean, default: true },
  principalSearch: { type: Function as PropType<InstanceGrantPrincipalSearch>, default: undefined },
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  shared: [grantId: string | null];
}>();

const { t } = useI18n();
const sharing = ref(false);
const principalLoading = ref(false);
const principalCandidates = ref<InstanceGrantPrincipalOption[]>([]);
const draft = reactive({
  principalId: '',
  tenantId: '',
  resourceType: '',
  instanceId: '',
  action: '',
  effect: 'ALLOW',
  window: null as string[] | null,
});

const canShare = computed(() => Boolean(
  draft.principalId && draft.tenantId.trim() && draft.resourceType.trim() && draft.instanceId.trim() && draft.action.trim(),
));

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return;
    draft.principalId = props.principalId;
    draft.tenantId = props.tenantId;
    draft.resourceType = props.resourceType;
    draft.instanceId = props.instanceId;
    draft.action = '';
    draft.effect = 'ALLOW';
    draft.window = null;
    principalCandidates.value = props.principalId
      ? [{ id: props.principalId, label: props.principalId }]
      : [];
  },
  { immediate: true },
);

async function searchPrincipals(keyword: string): Promise<void> {
  principalLoading.value = true;
  try {
    if (props.principalSearch) {
      principalCandidates.value = await props.principalSearch(keyword);
      return;
    }
    if (props.principalType !== 'USER') {
      principalCandidates.value = [];
      return;
    }
    const result = await backendRequest({
      url: 'user/account/search',
      method: 'post',
      params: { username: keyword || null, pageNo: 1, pageSize: 20 },
    });
    const payload = getApiResponseData<{ rows?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(result);
    const rows = Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.data) ? payload.data : [];
    principalCandidates.value = rows.map(row => ({
      id: String(row.id ?? ''),
      label: String(row.displayName ?? row.username ?? row.id ?? ''),
    }));
  } finally {
    principalLoading.value = false;
  }
}

async function submitShare(): Promise<void> {
  if (!canShare.value) return;
  sharing.value = true;
  try {
    const result = await backendRequest({
      url: 'auth/instanceGrant/share',
      method: 'post',
      params: {
        principalId: draft.principalId,
        principalType: props.principalType,
        tenantId: draft.tenantId.trim(),
        resourceType: draft.resourceType.trim(),
        instanceId: draft.instanceId.trim(),
        action: draft.action.trim(),
        effect: props.allowDeny ? draft.effect : 'ALLOW',
        startTime: draft.window?.[0] ?? null,
        endTime: draft.window?.[1] ?? null,
      },
    });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(resolveApiResponseMessage(result, t('instanceGrant.messages.shareFailed')));
      return;
    }
    const value = getApiResponseData<unknown>(result);
    ElMessage.success(t('instanceGrant.messages.shared'));
    emit('shared', value == null ? null : String(value));
    close();
  } finally {
    sharing.value = false;
  }
}

function close(): void {
  emit('update:modelValue', false);
}
</script>

<style lang="css" scoped>
.igd-full {
  width: 100%;
}

.igd-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
