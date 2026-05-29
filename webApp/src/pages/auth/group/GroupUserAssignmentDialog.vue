<!--
 * Group-user assignment dialog with server-side candidate search.
 *
 * Backend (AuthGroupAdminController, kudos-ms-auth):
 *   GET    /api/admin/auth/group/listUserIds?groupId=...           → Set<userId>
 *   POST   /api/admin/auth/group/bindUsers?groupId=...  body=[ids] → newly created count
 *   DELETE /api/admin/auth/group/unbindUser?groupId=...&userId=... → boolean
 *
 * Candidates come from user/account/pagingSearch one debounced page at a time. The transfer's
 * filter input is repurposed: filter-method always returns true (no client-side filtering) and
 * triggers a debounced server fetch when the keyword changes. Already-assigned items are kept
 * pinned in the transfer's data so they always render on the right side regardless of the
 * current candidate page.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('groupUserAssignment.title')" v-model="visible" width="40%" center @close="close">
    <div class="paged-transfer">
      <el-transfer
        v-model="assignedUserIds"
        style="text-align: left; display: inline-block"
        filterable
        :filter-method="filterMethod"
        :filter-placeholder="t('groupUserAssignment.searchPlaceholder')"
        :titles="[t('groupUserAssignment.unassigned'), t('groupUserAssignment.assigned')]"
        :format="{
          noChecked: '${total}',
          hasChecked: '${checked}/${total}',
        }"
        :data="transferData">
        <template #default="{ option }">
          <span>{{ option.label }}</span>
        </template>
      </el-transfer>
      <div class="paged-transfer__hint">
        {{ t('groupUserAssignment.candidatesHint', { shown: candidateItems.length, total: candidateTotal < 0 ? '?' : candidateTotal }) }}
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('groupUserAssignment.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('groupUserAssignment.confirm') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { computed, defineComponent, reactive, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import {
  type TransferItem,
  debounce,
  mergeTransferData,
  normalizeIdSet,
  resolveAssignedItems,
  searchCandidates,
} from '../_shared/assignmentTransferUtils';

class GroupUserAssignmentDialog extends BaseDetailPage {
  private originalAssignedIds: Set<string> = new Set();
  /** Last keyword pumped through el-transfer's filter input, for change-detection inside filterMethod. */
  private lastKeyword = '';

  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'auth/group';
  }

  protected initState(): any {
    return {
      /** Candidates fetched server-side for the current keyword. */
      candidateItems: [] as TransferItem[],
      /** Already-assigned items, fully resolved on load — pinned into transferData so they always show on the right. */
      assignedItems: [] as TransferItem[],
      /** v-model for the transfer: the keys currently on the right side. */
      assignedUserIds: [] as string[],
      candidateTotal: 0,
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listUserIds';
  }

  protected createDetailLoadParams(): any {
    return { groupId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    // Initial candidate page (no keyword).
    await this.refetchCandidates('');
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const ids = normalizeIdSet(data);
    this.originalAssignedIds = new Set(ids);
    this.state.assignedUserIds = [...ids];
    // Resolve the assigned items asynchronously so labels render on the right side.
    this.resolveAssigned(ids).then(items => { this.state.assignedItems = items; });
    super.postLoadDataSuccessfully(data);
  }

  private async resolveAssigned(ids: string[]): Promise<TransferItem[]> {
    return resolveAssignedItems({
      searchUrl: 'user/account/pagingSearch',
      ids,
      pickLabel: row => String(row.username ?? row.realName ?? row.id ?? ''),
    });
  }

  /** Fetch one page of candidates from the backend; called on open and on filter input change. */
  private async refetchCandidates(keyword: string): Promise<void> {
    const baseParams: Record<string, unknown> = {};
    if (this.props.subSystemCode) baseParams.subSystemCode = this.props.subSystemCode;
    if (this.props.tenantId) baseParams.tenantId = this.props.tenantId;
    const result = await searchCandidates({
      searchUrl: 'user/account/pagingSearch',
      keyword,
      keywordField: 'username',
      baseParams,
      pageNo: 1,
      pageSize: 50,
      pickLabel: row => String(row.username ?? row.realName ?? row.id ?? ''),
    });
    this.state.candidateItems = result.items;
    this.state.candidateTotal = result.totalCount;
  }

  /** Repurposed el-transfer filter-method: never filters client-side, only kicks off a debounced server fetch. */
  public filterMethod!: (query: string, item: TransferItem) => boolean;

  private debouncedSearch = debounce((kw: string) => { void this.refetchCandidates(kw); }, 300);

  public submit!: () => void;

  protected async doSubmit(): Promise<void> {
    const current = new Set<string>(this.state.assignedUserIds as string[]);
    const toBind: string[] = [];
    current.forEach(id => { if (!this.originalAssignedIds.has(id)) toBind.push(id); });
    const toUnbind: string[] = [];
    this.originalAssignedIds.forEach(id => { if (!current.has(id)) toUnbind.push(id); });

    try {
      if (toBind.length > 0) {
        const bindUrl = `${this.getRootActionPath()}/bindUsers?groupId=${encodeURIComponent(this.props.rid)}`;
        const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: toBind as unknown as Record<string, unknown> });
        if (!isApiSuccessResponse(bindResult)) {
          ElMessage.error(await resolveApiResponseMessage(bindResult) || getApiResponseMessage(bindResult) || 'Bind failed');
          return;
        }
      }
      for (const userId of toUnbind) {
        const unbindResult = await backendRequest({
          url: this.getRootActionPath() + '/unbindUser',
          method: 'delete',
          params: { groupId: this.props.rid, userId },
        });
        if (!isApiSuccessResponse(unbindResult)) {
          ElMessage.error(await resolveApiResponseMessage(unbindResult) || getApiResponseMessage(unbindResult) || 'Unbind failed');
          return;
        }
      }
      ElMessage.success('Saved successfully');
      this.context.emit('update:modelValue', false);
    } catch (err) {
      ElMessage.error(String(err));
    }
  }

  // Throw away unused payload signature; el-transfer calls this for every (query, item) tuple.
  private doFilter(query: string, _item: TransferItem): boolean {
    if (query !== this.lastKeyword) {
      this.lastKeyword = query;
      this.debouncedSearch(query);
    }
    return true;
  }

  protected convertThis(): void {
    super.convertThis();
    this.submit = () => { this.doSubmit(); };
    this.filterMethod = (query: string, item: TransferItem) => this.doFilter(query, item);
  }
}

export default defineComponent({
  name: 'GroupUserAssignmentDialog',
  props: {
    modelValue: Boolean,
    rid: String,
    subSystemCode: String,
    tenantId: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new GroupUserAssignmentDialog(props, context));
    const transferData = computed<TransferItem[]>(() => mergeTransferData(
      (dialog.state as any).candidateItems as TransferItem[],
      (dialog.state as any).assignedItems as TransferItem[],
    ));
    return {
      t,
      transferData,
      ...toRefs(dialog),
      ...toRefs(dialog.state),
    };
  },
});
</script>

<style lang='css' scoped>
.paged-transfer__hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
