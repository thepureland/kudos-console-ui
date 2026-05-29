<!--
 * Group-role assignment dialog with server-side candidate search.
 *
 * Backend (AuthGroupAdminController, kudos-ms-auth):
 *   GET    /api/admin/auth/group/listRoleIds?groupId=...           → Set<roleId>
 *   POST   /api/admin/auth/group/bindRoles?groupId=...  body=[ids] → newly created count
 *   DELETE /api/admin/auth/group/unbindRole?groupId=...&roleId=... → boolean
 *
 * Candidates come from rbac/role/pagingSearch one debounced page at a time. See
 * GroupUserAssignmentDialog for the search-via-filterMethod pattern explanation.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('groupRoleAssignment.title')" v-model="visible" width="40%" center @close="close">
    <div class="paged-transfer">
      <el-transfer
        v-model="assignedRoleIds"
        style="text-align: left; display: inline-block"
        filterable
        :filter-method="filterMethod"
        :filter-placeholder="t('groupRoleAssignment.searchPlaceholder')"
        :titles="[t('groupRoleAssignment.unassigned'), t('groupRoleAssignment.assigned')]"
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
        {{ t('groupRoleAssignment.candidatesHint', { shown: candidateItems.length, total: candidateTotal < 0 ? '?' : candidateTotal }) }}
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('groupRoleAssignment.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('groupRoleAssignment.confirm') }}</el-button>
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

const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');

class GroupRoleAssignmentDialog extends BaseDetailPage {
  private originalAssignedIds: Set<string> = new Set();
  private lastKeyword = '';

  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'rbac/group';
  }

  protected initState(): any {
    return {
      candidateItems: [] as TransferItem[],
      assignedItems: [] as TransferItem[],
      assignedRoleIds: [] as string[],
      candidateTotal: 0,
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listRoleIds';
  }

  protected createDetailLoadParams(): any {
    return { groupId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    await this.refetchCandidates('');
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const ids = normalizeIdSet(data);
    this.originalAssignedIds = new Set(ids);
    this.state.assignedRoleIds = [...ids];
    this.resolveAssigned(ids).then(items => { this.state.assignedItems = items; });
    super.postLoadDataSuccessfully(data);
  }

  private async resolveAssigned(ids: string[]): Promise<TransferItem[]> {
    return resolveAssignedItems({
      searchUrl: 'rbac/role/pagingSearch',
      ids,
      pickLabel: roleLabel,
    });
  }

  private async refetchCandidates(keyword: string): Promise<void> {
    const baseParams: Record<string, unknown> = { active: true };
    if (this.props.subSystemCode) baseParams.subSystemCode = this.props.subSystemCode;
    if (this.props.tenantId) baseParams.tenantId = this.props.tenantId;
    const result = await searchCandidates({
      searchUrl: 'rbac/role/pagingSearch',
      keyword,
      keywordField: 'name',
      baseParams,
      pageNo: 1,
      pageSize: 50,
      pickLabel: roleLabel,
    });
    this.state.candidateItems = result.items;
    this.state.candidateTotal = result.totalCount;
  }

  public filterMethod!: (query: string, item: TransferItem) => boolean;

  private debouncedSearch = debounce((kw: string) => { void this.refetchCandidates(kw); }, 300);

  public submit!: () => void;

  protected async doSubmit(): Promise<void> {
    const current = new Set<string>(this.state.assignedRoleIds as string[]);
    const toBind: string[] = [];
    current.forEach(id => { if (!this.originalAssignedIds.has(id)) toBind.push(id); });
    const toUnbind: string[] = [];
    this.originalAssignedIds.forEach(id => { if (!current.has(id)) toUnbind.push(id); });

    try {
      if (toBind.length > 0) {
        const bindUrl = `${this.getRootActionPath()}/bindRoles?groupId=${encodeURIComponent(this.props.rid)}`;
        const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: toBind as unknown as Record<string, unknown> });
        if (!isApiSuccessResponse(bindResult)) {
          ElMessage.error(await resolveApiResponseMessage(bindResult) || getApiResponseMessage(bindResult) || 'Bind failed');
          return;
        }
      }
      for (const roleId of toUnbind) {
        const unbindResult = await backendRequest({
          url: this.getRootActionPath() + '/unbindRole',
          method: 'delete',
          params: { groupId: this.props.rid, roleId },
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
  name: 'GroupRoleAssignmentDialog',
  props: {
    modelValue: Boolean,
    rid: String,
    subSystemCode: String,
    tenantId: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new GroupRoleAssignmentDialog(props, context));
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
