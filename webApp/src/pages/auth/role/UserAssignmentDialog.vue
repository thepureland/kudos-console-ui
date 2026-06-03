<!--
 * Role-user assignment dialog with server-side candidate search.
 *
 * Backend (AuthRoleAdminController, kudos-ms-auth):
 *   GET    /api/admin/auth/role/listUserIds?roleId=...           → Set<userId>
 *   POST   /api/admin/auth/role/bindUsers?roleId=...  body=[ids] → newly created count
 *   DELETE /api/admin/auth/role/unbindUser?roleId=...&userId=... → boolean
 *
 * See GroupUserAssignmentDialog for the filterMethod-as-debounced-search trick.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('roleUserAssignment.title')" v-model="visible" width="40%" center @close="close">
    <div class="paged-transfer">
      <el-transfer
        v-model="assignedUserIds"
        style="text-align: left; display: inline-block"
        filterable
        :filter-method="filterMethod"
        :filter-placeholder="t('roleUserAssignment.searchPlaceholder')"
        :titles="[t('roleUserAssignment.unassigned'), t('roleUserAssignment.assigned')]"
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
        {{ t('roleUserAssignment.candidatesHint', { shown: candidateItems.length, total: candidateTotal < 0 ? '?' : candidateTotal }) }}
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('roleUserAssignment.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('roleUserAssignment.confirm') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { computed, defineComponent, reactive, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { tGlobal } from '../../../i18n';
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

const userLabel = (row: Record<string, unknown>) => String(row.username ?? row.realName ?? row.id ?? '');

class RoleUserAssignmentDialog extends BaseDetailPage {
  private originalAssignedIds: Set<string> = new Set();
  private lastKeyword = '';

  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'auth/role';
  }

  protected initState(): any {
    return {
      candidateItems: [] as TransferItem[],
      assignedItems: [] as TransferItem[],
      assignedUserIds: [] as string[],
      candidateTotal: 0,
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listUserIds';
  }

  protected createDetailLoadParams(): any {
    return { roleId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    await this.refetchCandidates('');
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const ids = normalizeIdSet(data);
    this.originalAssignedIds = new Set(ids);
    this.state.assignedUserIds = [...ids];
    this.resolveAssigned(ids).then(items => { this.state.assignedItems = items; });
    super.postLoadDataSuccessfully(data);
  }

  private async resolveAssigned(ids: string[]): Promise<TransferItem[]> {
    return resolveAssignedItems({
      searchUrl: 'user/account/pagingSearch',
      ids,
      pickLabel: userLabel,
    });
  }

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
      pickLabel: userLabel,
    });
    this.state.candidateItems = result.items;
    this.state.candidateTotal = result.totalCount;
  }

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
        const bindUrl = `${this.getRootActionPath()}/bindUsers?roleId=${encodeURIComponent(this.props.rid)}`;
        const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: toBind as unknown as Record<string, unknown> });
        if (!isApiSuccessResponse(bindResult)) {
          ElMessage.error(await resolveApiResponseMessage(bindResult) || getApiResponseMessage(bindResult) || tGlobal('assignmentCommon.bindFailed'));
          return;
        }
      }
      for (const userId of toUnbind) {
        const unbindResult = await backendRequest({
          url: this.getRootActionPath() + '/unbindUser',
          method: 'delete',
          params: { roleId: this.props.rid, userId },
        });
        if (!isApiSuccessResponse(unbindResult)) {
          ElMessage.error(await resolveApiResponseMessage(unbindResult) || getApiResponseMessage(unbindResult) || tGlobal('assignmentCommon.unbindFailed'));
          return;
        }
      }
      ElMessage.success(tGlobal('assignmentCommon.saveSuccess'));
      this.context.emit('update:modelValue', false);
    } catch (err) {
      ElMessage.error(tGlobal('assignmentCommon.opFailed'));
    }
  }

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
  name: 'UserAssignmentDialog',
  props: {
    modelValue: Boolean,
    rid: String,
    subSystemCode: String,
    tenantId: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new RoleUserAssignmentDialog(props, context));
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
