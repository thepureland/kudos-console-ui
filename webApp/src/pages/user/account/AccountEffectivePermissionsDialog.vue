<!--
 * Effective permissions viewer for a single user.
 *
 * Aggregates client-side from kudos-ms-auth endpoints:
 *   GET /api/admin/auth/role/listRoleIdsByUser?userId=...    → direct roles
 *   GET /api/admin/auth/group/listGroupIdsByUser?userId=...  → groups the user belongs to
 *   GET /api/admin/auth/group/listRoleIds?groupId=...        → roles inherited from each group
 *   GET /api/admin/auth/role/listResourceIds?roleId=...      → resources granted by each role
 * Metadata for role/group/resource is then resolved via the respective pagingSearch.
 *
 * Three sections in one dialog:
 *   1. Roles (direct vs inherited; inherited rows show the source group)
 *   2. Groups (the user's group memberships)
 *   3. Resources (grouped by resource type; each row shows which role(s) granted it)
 *
 * Backend has no aggregator endpoint, so the dialog fans out N+M+K parallel requests where N = #groups,
 * M = #directRoles, K = #inheritedRoles. Acceptable for typical RBAC graph sizes (< few dozen).
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('accountPermissions.title')" v-model="visible" width="60%" center @close="close">
    <div v-loading="loading" class="ep-body">
      <!-- Roles -->
      <section class="ep-section">
        <h3 class="ep-section-title">
          {{ t('accountPermissions.sections.roles') }}
          <span class="ep-count">({{ roleRows.length }})</span>
        </h3>
        <el-table v-if="roleRows.length" :data="roleRows" stripe border max-height="220" size="small">
          <el-table-column type="index" width="50" />
          <el-table-column :label="t('accountPermissions.columns.roleName')" prop="label" show-overflow-tooltip />
          <el-table-column :label="t('accountPermissions.columns.source')" width="220" show-overflow-tooltip>
            <template #default="scope">
              <el-tag v-if="scope.row.direct" size="small" type="success">
                {{ t('accountPermissions.source.direct') }}
              </el-tag>
              <el-tag
                v-for="g in scope.row.viaGroups"
                :key="g.key"
                size="small"
                type="info"
                style="margin-left: 4px;"
              >
                {{ t('accountPermissions.source.viaGroupPrefix') }}{{ g.label }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="ep-empty">{{ t('accountPermissions.empty') }}</div>
      </section>

      <!-- Groups -->
      <section class="ep-section">
        <h3 class="ep-section-title">
          {{ t('accountPermissions.sections.groups') }}
          <span class="ep-count">({{ groupItems.length }})</span>
        </h3>
        <el-table v-if="groupItems.length" :data="groupItems" stripe border max-height="180" size="small">
          <el-table-column type="index" width="50" />
          <el-table-column :label="t('accountPermissions.columns.groupName')" prop="label" show-overflow-tooltip />
        </el-table>
        <div v-else class="ep-empty">{{ t('accountPermissions.empty') }}</div>
      </section>

      <!-- Resources -->
      <section class="ep-section">
        <h3 class="ep-section-title">
          {{ t('accountPermissions.sections.resources') }}
          <span class="ep-count">({{ resourceRows.length }})</span>
        </h3>
        <el-table
          v-if="resourceRows.length"
          :data="resourceRows"
          stripe
          border
          max-height="320"
          size="small"
          :default-sort="{ prop: 'resourceTypeDictCode', order: 'ascending' }"
        >
          <el-table-column type="index" width="50" />
          <el-table-column :label="t('accountPermissions.columns.resourceType')" prop="resourceTypeDictCode" width="140" sortable show-overflow-tooltip>
            <template #default="scope">
              {{ formatResourceType(scope.row.resourceTypeDictCode) }}
            </template>
          </el-table-column>
          <el-table-column :label="t('accountPermissions.columns.resourceName')" prop="label" sortable show-overflow-tooltip />
          <el-table-column :label="t('accountPermissions.columns.url')" prop="url" show-overflow-tooltip />
          <el-table-column :label="t('accountPermissions.columns.viaRoles')" min-width="200" show-overflow-tooltip>
            <template #default="scope">
              <el-tag v-for="r in scope.row.viaRoles" :key="r.key" size="small" style="margin-right: 4px;">
                {{ r.label }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div v-else class="ep-empty">{{ t('accountPermissions.empty') }}</div>
      </section>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="close">{{ t('accountPermissions.close') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { defineComponent, reactive, toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import {
  type TransferItem,
  normalizeIdSet,
  resolveAssignedItems,
} from '../../rbac/_shared/assignmentTransferUtils';

interface RoleRow {
  key: string;
  label: string;
  /** True when the role is directly assigned to the user. */
  direct: boolean;
  /** Groups that contribute this role to the user (empty if direct only). */
  viaGroups: TransferItem[];
}

interface ResourceRow {
  key: string;
  label: string;
  url: string | null;
  resourceTypeDictCode: string | null;
  /** Roles (resolved) that grant this resource to the user. */
  viaRoles: TransferItem[];
}

const roleLabel = (row: Record<string, unknown>) => String(row.roleName ?? row.name ?? row.roleCode ?? row.code ?? row.id ?? '');
const groupLabel = (row: Record<string, unknown>) => String(row.groupName ?? row.name ?? row.groupCode ?? row.code ?? row.id ?? '');
const resourceLabel = (row: Record<string, unknown>) => String(row.name ?? row.code ?? row.url ?? row.id ?? '');

class AccountEffectivePermissionsDialog extends BaseDetailPage {
  constructor(props: any, context: any) {
    super(props, context);
    this.loadDicts(['resource_type'], 'sys');
  }

  protected getRootActionPath(): string {
    // Unused — we override the loader below to aggregate from multiple endpoints.
    return 'user/account';
  }

  protected initState(): any {
    return {
      loading: true,
      roleRows: [] as RoleRow[],
      groupItems: [] as TransferItem[],
      resourceRows: [] as ResourceRow[],
    };
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['resource_type'], atomicServiceCode: 'sys' }];
  }

  /** Skip the standard single-endpoint loadData; we aggregate from many endpoints below. */
  protected getDetailLoadUrl(): string {
    return '';
  }

  protected async loadData(): Promise<void> {
    const userId = String(this.props.rid ?? this.state.rid ?? '');
    if (!userId) {
      this.state.loading = false;
      this.render();
      return;
    }
    try {
      await this.aggregate(userId);
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  private async aggregate(userId: string): Promise<void> {
    // Stage 1: direct roles + groups
    const [directRoleIds, groupIds] = await Promise.all([
      this.getIds('rbac/role/listRoleIdsByUser', { userId }),
      this.getIds('rbac/group/listGroupIdsByUser', { userId }),
    ]);

    // Stage 2: roles per group (in parallel) + resolve role/group metadata up front
    const [perGroupRoleIds, groupItems, directRoleItems] = await Promise.all([
      Promise.all(groupIds.map(gid => this.getIds('rbac/group/listRoleIds', { groupId: gid }).then(rids => ({ gid, rids })))),
      resolveAssignedItems({ searchUrl: 'rbac/group/pagingSearch', ids: groupIds, pickLabel: groupLabel }),
      resolveAssignedItems({ searchUrl: 'rbac/role/pagingSearch', ids: directRoleIds, pickLabel: roleLabel }),
    ]);

    this.state.groupItems = groupItems;
    const groupItemById = new Map<string, TransferItem>(groupItems.map(g => [g.key, g]));

    // Stage 3: build role rows (direct + inherited, deduped) and resolve inherited role metadata
    const directRoleSet = new Set(directRoleIds);
    const inheritedRoleIds = new Set<string>();
    const groupsByRoleId = new Map<string, Set<string>>(); // roleId → set of groupIds contributing
    for (const { gid, rids } of perGroupRoleIds) {
      for (const rid of rids) {
        if (!directRoleSet.has(rid)) inheritedRoleIds.add(rid);
        let s = groupsByRoleId.get(rid);
        if (!s) { s = new Set(); groupsByRoleId.set(rid, s); }
        s.add(gid);
      }
    }

    const inheritedRoleItems = await resolveAssignedItems({
      searchUrl: 'rbac/role/pagingSearch',
      ids: [...inheritedRoleIds],
      pickLabel: roleLabel,
    });

    const allRoleItems = [...directRoleItems, ...inheritedRoleItems];
    // De-dup roles (a direct role might also live in a group).
    const seenRoleKeys = new Set<string>();
    const roleRows: RoleRow[] = [];
    for (const item of allRoleItems) {
      if (seenRoleKeys.has(item.key)) continue;
      seenRoleKeys.add(item.key);
      const groups = groupsByRoleId.get(item.key);
      roleRows.push({
        key: item.key,
        label: item.label,
        direct: directRoleSet.has(item.key),
        viaGroups: groups ? [...groups].map(gid => groupItemById.get(gid)).filter((g): g is TransferItem => !!g) : [],
      });
    }
    // Direct roles first, then alphabetical.
    roleRows.sort((a, b) => (Number(b.direct) - Number(a.direct)) || a.label.localeCompare(b.label));
    this.state.roleRows = roleRows;

    // Stage 4: resources per role (parallel), then resolve resource metadata once
    const roleKeys = [...seenRoleKeys];
    const roleItemByKey = new Map<string, TransferItem>(allRoleItems.map(r => [r.key, r]));
    const perRoleResourceIds = await Promise.all(
      roleKeys.map(rid => this.getIds('rbac/role/listResourceIds', { roleId: rid }).then(resIds => ({ rid, resIds }))),
    );
    const allResourceIds = new Set<string>();
    const rolesByResourceId = new Map<string, Set<string>>(); // resourceId → set of roleIds
    for (const { rid, resIds } of perRoleResourceIds) {
      for (const resId of resIds) {
        allResourceIds.add(resId);
        let s = rolesByResourceId.get(resId);
        if (!s) { s = new Set(); rolesByResourceId.set(resId, s); }
        s.add(rid);
      }
    }
    const resourceMeta = await this.resolveResources([...allResourceIds]);
    const resourceRows: ResourceRow[] = resourceMeta.map(r => ({
      key: r.id,
      label: r.label,
      url: r.url,
      resourceTypeDictCode: r.resourceTypeDictCode,
      viaRoles: [...(rolesByResourceId.get(r.id) ?? [])]
        .map(rid => roleItemByKey.get(rid))
        .filter((it): it is TransferItem => !!it),
    }));
    resourceRows.sort((a, b) => {
      const t = String(a.resourceTypeDictCode ?? '').localeCompare(String(b.resourceTypeDictCode ?? ''));
      return t !== 0 ? t : a.label.localeCompare(b.label);
    });
    this.state.resourceRows = resourceRows;
  }

  private async getIds(url: string, params: Record<string, unknown>): Promise<string[]> {
    const result = await backendRequest({ url, method: 'get', params });
    if (!isApiSuccessResponse(result)) return [];
    return normalizeIdSet(getApiResponseData<unknown>(result));
  }

  private async resolveResources(ids: string[]): Promise<Array<{ id: string; label: string; url: string | null; resourceTypeDictCode: string | null }>> {
    if (ids.length === 0) return [];
    const params: Record<string, unknown> = { pageNo: 1, pageSize: Math.max(ids.length, 50), ids };
    const result = await backendRequest({ url: 'sys/resource/pagingSearch', method: 'post', params });
    if (!isApiSuccessResponse(result)) return [];
    const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(result);
    const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? []);
    const idSet = new Set(ids.map(String));
    return rows
      .filter(r => idSet.has(String(r.id ?? '')))
      .map(r => ({
        id: String(r.id ?? ''),
        label: resourceLabel(r),
        url: r.url != null ? String(r.url) : null,
        resourceTypeDictCode: r.resourceTypeDictCode != null ? String(r.resourceTypeDictCode) : null,
      }));
  }

  /** Localize resource_type dict code, falling back to the raw code. */
  public formatResourceType(code: unknown): string {
    if (code == null) return '';
    return this.transDict('sys', 'resource_type', String(code)) || String(code);
  }
}

export default defineComponent({
  name: 'AccountEffectivePermissionsDialog',
  props: {
    modelValue: Boolean,
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new AccountEffectivePermissionsDialog(props, context));
    return {
      t,
      ...toRefs(dialog),
      ...toRefs(dialog.state),
      // Class methods aren't auto-exposed by toRefs.
      formatResourceType: (code: unknown) => {
        const raw = (dialog as unknown as { formatResourceType: (c: unknown) => string }).formatResourceType(code);
        // Backend dict items come as i18n keys (e.g. 'resource_type.1'); translate if so.
        return raw && raw.includes('.') ? t(raw) : raw;
      },
    };
  },
});
</script>

<style lang='css' scoped>
.ep-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
}
.ep-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.ep-count {
  margin-left: 6px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}
.ep-empty {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}
</style>
