<!--
 * Batch bind users to N owners (roles or groups) in one shot.
 *
 * Parameterized so role and group list pages can share the same UI. Caller provides:
 *   - owners:     [{ id, label }] — the rows the operator pre-selected
 *   - ownerKind:  'role' | 'group' — controls label keys
 *   - bindUrl:    e.g. 'auth/role/bindUsers' or 'auth/group/bindUsers'.
 *                 The batch endpoint URL is derived by replacing 'bindUsers' with 'batchBindUsers'.
 *   - paramName:  'roleId' or 'groupId'. The owner-ids JSON key in the batch body is derived by
 *                 appending an 's'.
 *
 * Operator picks users via the standard server-search transfer (assignedItems starts empty —
 * "selected" means "will be bound to all owners"). Submit issues a single POST to the backend's
 * batchBindUsers aggregator; partial failures come back in the response payload and are surfaced
 * in a warning toast with per-owner detail (the dialog stays open in that case).
 *
 * Intentionally NOT a transfer with diff:
 *   "Unbind from N owners at once" is rarely what an operator wants; if they need to revoke
 *   they should open the single-owner dialog and do it explicitly.
 *
 * @author K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="title" v-model="visible" width="42%" center @close="close" :close-on-click-modal="false">
    <div class="paged-transfer">
      <el-alert
        :title="t('batchBindUsers.summary', { n: owners.length })"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      />
      <div class="batch-bind__owners">
        <el-tag v-for="o in owners" :key="o.id" type="info" size="small" style="margin: 2px;">{{ o.label }}</el-tag>
      </div>
      <el-transfer
        v-model="selectedUserIds"
        style="text-align: left; display: inline-block; margin-top: 12px;"
        filterable
        :filter-method="filterMethod"
        :filter-placeholder="t('batchBindUsers.searchPlaceholder')"
        :titles="[t('batchBindUsers.candidate'), t('batchBindUsers.toBind')]"
        :format="{ noChecked: '${total}', hasChecked: '${checked}/${total}' }"
        :data="candidateItems"
      >
        <template #default="{ option }"><span>{{ option.label }}</span></template>
      </el-transfer>
      <div class="paged-transfer__hint">
        {{ t('batchBindUsers.candidatesHint', { shown: candidateItems.length, total: candidateTotal < 0 ? '?' : candidateTotal }) }}
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="close">{{ t('batchBindUsers.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" :disabled="selectedUserIds.length === 0" @click="submit">
          {{ t('batchBindUsers.confirm', { calls: owners.length * selectedUserIds.length }) }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { computed, defineComponent, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { type TransferItem, debounce, searchCandidates } from './assignmentTransferUtils';

interface OwnerRef {
  id: string;
  label: string;
}

export default defineComponent({
  name: 'BatchBindUsersDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    owners: { type: Array as () => OwnerRef[], required: true },
    /** 'role' | 'group' — title/label namespacing. */
    ownerKind: { type: String, default: 'role' },
    /** e.g. 'auth/role/bindUsers' or 'auth/group/bindUsers'. */
    bindUrl: { type: String, required: true },
    /** Query-string key the bind endpoint expects, e.g. 'roleId' or 'groupId'. */
    paramName: { type: String, required: true },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, { emit }) {
    const { t } = useI18n();
    // `visible` is always true on mount; the component is created fresh each time the parent opens
    // the dialog, so we don't need to sync it from `modelValue` after mount.
    const visible = ref(true);
    const candidateItems = ref<TransferItem[]>([]);
    // Initialized to 0; set to -1 only when the server omits a totalCount (rare), in which case
    // the template renders '?' via the `candidateTotal < 0` check.
    const candidateTotal = ref(0);
    const selectedUserIds = ref<string[]>([]);
    const submitting = ref(false);
    // Tracks the last query sent to the server so filterMethod can skip duplicate fetches.
    let lastKeyword = '';

    const title = computed(() => t(props.ownerKind === 'group' ? 'batchBindUsers.titleGroup' : 'batchBindUsers.titleRole'));

    async function refetch(keyword: string): Promise<void> {
      const result = await searchCandidates({
        searchUrl: 'user/account/pagingSearch',
        keyword,
        keywordField: 'username',
        pageNo: 1,
        pageSize: 50,
        pickLabel: row => String(row.username ?? row.realName ?? row.id ?? ''),
      });
      candidateItems.value = result.items;
      candidateTotal.value = result.totalCount;
    }

    onMounted(() => { void refetch(''); });

    const debouncedSearch = debounce((kw: string) => { void refetch(kw); }, 300);

    // el-transfer calls filterMethod on every keystroke for every visible item. We repurpose it as
    // a side-channel to trigger server-side search: only fire when the query actually changes, and
    // always return true so el-transfer shows all items (real filtering is done server-side).
    function filterMethod(query: string, _item: TransferItem): boolean {
      if (query !== lastKeyword) {
        lastKeyword = query;
        debouncedSearch(query);
      }
      return true;
    }

    function close(): void {
      visible.value = false;
      emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      if (props.owners.length === 0 || selectedUserIds.value.length === 0) return;
      submitting.value = true;
      try {
        // One POST to the backend's batch aggregator. We derive the batch URL and the owner-ids
        // JSON key from the existing `bindUrl` / `paramName` props so existing call sites don't
        // need to change. Backend per-owner transactional boundary mirrors what we used to do
        // sequentially in this loop — partial failures come back in the response payload.
        const batchUrl = props.bindUrl.replace(/bindUsers$/, 'batchBindUsers');
        const ownerIdsKey = `${props.paramName}s`; // 'roleId' → 'roleIds', 'groupId' → 'groupIds'
        const body: Record<string, unknown> = {
          [ownerIdsKey]: props.owners.map(o => o.id),
          userIds: selectedUserIds.value,
        };
        const result = await backendRequest({ url: batchUrl, method: 'post', params: body });
        if (!isApiSuccessResponse(result)) {
          const reason = (await resolveApiResponseMessage(result)) || getApiResponseMessage(result) || 'failed';
          ElMessage.error(reason);
          emit('response', { ok: 0, failed: props.owners.length });
          return;
        }
        const payload = getApiResponseData<{ ok?: number; failures?: Array<{ ownerId: string; reason: string }> }>(result);
        const ok = typeof payload?.ok === 'number' ? payload.ok : 0;
        const failures = payload?.failures ?? [];
        if (failures.length === 0) {
          ElMessage.success(t('batchBindUsers.allSucceeded', { n: ok, users: selectedUserIds.value.length }));
          emit('response', { ok, failed: 0 });
          emit('update:modelValue', false);
        } else {
          // Partial-success: keep the dialog open so the operator can see which owners failed.
          const ownerLabelById = new Map(props.owners.map(o => [o.id, o.label]));
          const detail = failures
            .map(f => `${ownerLabelById.get(f.ownerId) ?? f.ownerId}: ${f.reason}`)
            .join('; ');
          ElMessage.warning(t('batchBindUsers.partial', { ok, failed: failures.length, detail }));
          emit('response', { ok, failed: failures.length });
        }
      } finally {
        submitting.value = false;
      }
    }

    return {
      t,
      title,
      visible,
      candidateItems,
      candidateTotal,
      selectedUserIds,
      submitting,
      filterMethod,
      close,
      submit,
    };
  },
});
</script>

<style lang='css' scoped>
.batch-bind__owners {
  max-height: 80px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}
.paged-transfer__hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
