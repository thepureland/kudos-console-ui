<!--
 * Role-resource assignment dialog (flat transfer; for non-menu resource types).
 *
 * Backend (AuthRoleAdminController, kudos-ms-auth):
 *   GET    /api/admin/auth/role/listResourceIds?roleId=...           → Set<resourceId>
 *   POST   /api/admin/auth/role/bindResources?roleId=...  body=[ids] → newly created count
 *   DELETE /api/admin/auth/role/unbindResource?roleId=...&resourceId=... → boolean
 *
 * Candidates come from sys/resource/pagingSearch filtered by resourceTypeDictCode + (optional)
 * subSystemCode, page-at-a-time via the filterMethod-debounced-search pattern. Menus (type='1')
 * use the dedicated MenuAuthorization tree dialog; this component is mounted only for other
 * resource types (button, API, data field, ...).
 *
 * Scoping rule: the assigned-id set returned by listResourceIds covers ALL resource types on
 * the role; we narrow it down to candidates of this resource type only so this dialog can't
 * accidentally unbind menus or other types it doesn't render.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="title" v-model="visible" width="42%" center @close="close">
    <div class="paged-transfer">
      <el-transfer
        v-model="assignedResourceIds"
        style="text-align: left; display: inline-block"
        filterable
        :filter-method="filterMethod"
        :filter-placeholder="t('roleResourceAssignment.searchPlaceholder')"
        :titles="[t('roleResourceAssignment.unassigned'), t('roleResourceAssignment.assigned')]"
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
        {{ t('roleResourceAssignment.candidatesHint', { shown: candidateItems.length, total: candidateTotal < 0 ? '?' : candidateTotal }) }}
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('roleResourceAssignment.cancel') }}</el-button>
        <el-button type="primary" @click="submit">{{ t('roleResourceAssignment.confirm') }}</el-button>
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

const resourceLabel = (row: Record<string, unknown>) => String(row.name ?? row.code ?? row.url ?? row.id ?? '');

class RoleResourceAssignmentDialog extends BaseDetailPage {
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
      assignedResourceIds: [] as string[],
      candidateTotal: 0,
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listResourceIds';
  }

  protected createDetailLoadParams(): any {
    return { roleId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    await this.refetchCandidates('');
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const allIds = normalizeIdSet(data);
    // Resolve metadata for all assigned IDs but narrow them to this resource type only.
    // This dialog only owns resources of one type — unbinding others would be a bug.
    void resolveAssignedItems({
      searchUrl: 'sys/resource/pagingSearch',
      ids: allIds,
      baseParams: { resourceTypeDictCode: this.props.resourceTypeDictCode },
      pickLabel: resourceLabel,
    }).then(items => {
      this.state.assignedItems = items;
      const scopedIds = items.map(i => i.key);
      this.originalAssignedIds = new Set(scopedIds);
      this.state.assignedResourceIds = scopedIds;
    });
    super.postLoadDataSuccessfully(data);
  }

  private async refetchCandidates(keyword: string): Promise<void> {
    const baseParams: Record<string, unknown> = {
      resourceTypeDictCode: this.props.resourceTypeDictCode,
    };
    if (this.props.subSystemCode) baseParams.subSystemCode = this.props.subSystemCode;
    const result = await searchCandidates({
      searchUrl: 'sys/resource/pagingSearch',
      keyword,
      keywordField: 'name',
      baseParams,
      pageNo: 1,
      pageSize: 50,
      pickLabel: resourceLabel,
    });
    this.state.candidateItems = result.items;
    this.state.candidateTotal = result.totalCount;
  }

  public filterMethod!: (query: string, item: TransferItem) => boolean;
  private debouncedSearch = debounce((kw: string) => { void this.refetchCandidates(kw); }, 300);

  public submit!: () => void;

  protected async doSubmit(): Promise<void> {
    const current = new Set<string>(this.state.assignedResourceIds as string[]);
    const toBind: string[] = [];
    current.forEach(id => { if (!this.originalAssignedIds.has(id)) toBind.push(id); });
    const toUnbind: string[] = [];
    this.originalAssignedIds.forEach(id => { if (!current.has(id)) toUnbind.push(id); });

    try {
      if (toBind.length > 0) {
        const bindUrl = `${this.getRootActionPath()}/bindResources?roleId=${encodeURIComponent(this.props.rid)}`;
        const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: toBind as unknown as Record<string, unknown> });
        if (!isApiSuccessResponse(bindResult)) {
          ElMessage.error(await resolveApiResponseMessage(bindResult) || getApiResponseMessage(bindResult) || 'Bind failed');
          return;
        }
      }
      for (const resourceId of toUnbind) {
        const unbindResult = await backendRequest({
          url: this.getRootActionPath() + '/unbindResource',
          method: 'delete',
          params: { roleId: this.props.rid, resourceId },
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
  name: 'RoleResourceAssignmentDialog',
  props: {
    modelValue: Boolean,
    rid: String,
    resourceTypeDictCode: { type: String, required: true },
    resourceTypeLabelKey: String,
    subSystemCode: String,
    tenantId: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t, te } = useI18n();
    const dialog = reactive(new RoleResourceAssignmentDialog(props, context));
    const title = computed(() => {
      const fallback = t('roleResourceAssignment.title');
      const key = props.resourceTypeLabelKey;
      if (!key) return fallback;
      const translated = te(key) ? t(key) : key;
      return t('roleResourceAssignment.titleWithType', { type: translated });
    });
    const transferData = computed<TransferItem[]>(() => mergeTransferData(
      (dialog.state as any).candidateItems as TransferItem[],
      (dialog.state as any).assignedItems as TransferItem[],
    ));
    return {
      t,
      title,
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
