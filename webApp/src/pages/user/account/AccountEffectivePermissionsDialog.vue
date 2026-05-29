<!--
 * Effective permissions viewer for a single user.
 *
 * Single GET to the kudos-ms-auth aggregator:
 *   GET /api/admin/auth/role/getEffectivePermissions?userId=...
 *   → EffectivePermissionsVo {
 *       directRoles: AuthRoleCacheEntry[],
 *       groups:      AuthGroupCacheEntry[],
 *       rolesByGroup: { [groupId]: AuthRoleCacheEntry[] },
 *       resourcesByRole: { [roleId]: SysResourceCacheEntry[] },
 *     }
 *
 * Three sections in one dialog:
 *   1. Roles (direct vs inherited; inherited rows show the source group)
 *   2. Groups (the user's group memberships)
 *   3. Resources (grouped by resource type; each row shows which role(s) granted it)
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
import { type TransferItem } from '../../auth/_shared/assignmentTransferUtils';

/** Shape of the backend EffectivePermissionsVo. Field-typed loosely because the cache entries
 *  carry many fields the UI doesn't render — we only access id/code/name/url/resourceTypeDictCode. */
interface BackendCacheEntry {
  id?: string;
  code?: string;
  name?: string;
  url?: string;
  resourceTypeDictCode?: string;
  // ... other AuthRoleCacheEntry / AuthGroupCacheEntry / SysResourceCacheEntry fields
}

interface EffectivePermissionsPayload {
  directRoles?: BackendCacheEntry[];
  groups?: BackendCacheEntry[];
  rolesByGroup?: Record<string, BackendCacheEntry[]>;
  resourcesByRole?: Record<string, BackendCacheEntry[]>;
}

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

  /** Skip the standard single-endpoint loadData; we use the aggregator below instead. */
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
      const result = await backendRequest({
        url: 'auth/role/getEffectivePermissions',
        method: 'get',
        params: { userId },
      });
      if (!isApiSuccessResponse(result)) return;
      const payload = getApiResponseData<EffectivePermissionsPayload>(result);
      if (payload) this.materialize(payload);
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  /** Map the backend's EffectivePermissionsVo into the dialog's view-model shape. The backend
   *  pre-deduplicates: a role inherited from multiple groups appears once in rolesByGroup's
   *  values but each occurrence pins a different groupId source. */
  private materialize(payload: EffectivePermissionsPayload): void {
    const directRoles = payload.directRoles ?? [];
    const groups = payload.groups ?? [];
    const rolesByGroup = payload.rolesByGroup ?? {};
    const resourcesByRole = payload.resourcesByRole ?? {};

    // groupId -> {key, label} for tag rendering in the source column.
    const groupItems: TransferItem[] = groups
      .map(g => ({ key: String(g.id ?? ''), label: groupLabel(g) }))
      .filter(g => g.key !== '');
    this.state.groupItems = groupItems;
    const groupItemById = new Map<string, TransferItem>(groupItems.map(g => [g.key, g]));

    // Invert rolesByGroup → for each role, which groups contribute it.
    const groupsByRoleId = new Map<string, Set<string>>();
    for (const [gid, roles] of Object.entries(rolesByGroup)) {
      for (const r of roles) {
        const rid = String(r.id ?? '');
        if (!rid) continue;
        let s = groupsByRoleId.get(rid);
        if (!s) { s = new Set(); groupsByRoleId.set(rid, s); }
        s.add(gid);
      }
    }

    // Dedupe roles across direct + inherited (a direct role might also live in a group).
    const directRoleIds = new Set(directRoles.map(r => String(r.id ?? '')).filter(Boolean));
    const allRolesById = new Map<string, BackendCacheEntry>();
    for (const r of directRoles) {
      const rid = String(r.id ?? '');
      if (rid) allRolesById.set(rid, r);
    }
    for (const roles of Object.values(rolesByGroup)) {
      for (const r of roles) {
        const rid = String(r.id ?? '');
        if (rid && !allRolesById.has(rid)) allRolesById.set(rid, r);
      }
    }

    const roleRows: RoleRow[] = [];
    for (const [rid, role] of allRolesById) {
      const sourceGroups = groupsByRoleId.get(rid);
      roleRows.push({
        key: rid,
        label: roleLabel(role),
        direct: directRoleIds.has(rid),
        viaGroups: sourceGroups
          ? [...sourceGroups].map(gid => groupItemById.get(gid)).filter((g): g is TransferItem => !!g)
          : [],
      });
    }
    // Direct first, then alphabetical (same ordering as before).
    roleRows.sort((a, b) => (Number(b.direct) - Number(a.direct)) || a.label.localeCompare(b.label));
    this.state.roleRows = roleRows;

    // {key,label} for the role-source tags in the resource table.
    const roleItemByKey = new Map<string, TransferItem>(
      [...allRolesById].map(([rid, role]) => [rid, { key: rid, label: roleLabel(role) }]),
    );

    // Invert resourcesByRole → for each resource, which roles grant it.
    const resourceById = new Map<string, BackendCacheEntry>();
    const rolesByResourceId = new Map<string, Set<string>>();
    for (const [rid, resources] of Object.entries(resourcesByRole)) {
      for (const r of resources) {
        const resId = String(r.id ?? '');
        if (!resId) continue;
        if (!resourceById.has(resId)) resourceById.set(resId, r);
        let s = rolesByResourceId.get(resId);
        if (!s) { s = new Set(); rolesByResourceId.set(resId, s); }
        s.add(rid);
      }
    }

    const resourceRows: ResourceRow[] = [];
    for (const [resId, res] of resourceById) {
      resourceRows.push({
        key: resId,
        label: resourceLabel(res),
        url: res.url != null ? String(res.url) : null,
        resourceTypeDictCode: res.resourceTypeDictCode != null ? String(res.resourceTypeDictCode) : null,
        viaRoles: [...(rolesByResourceId.get(resId) ?? [])]
          .map(rid => roleItemByKey.get(rid))
          .filter((it): it is TransferItem => !!it),
      });
    }
    resourceRows.sort((a, b) => {
      const t = String(a.resourceTypeDictCode ?? '').localeCompare(String(b.resourceTypeDictCode ?? ''));
      return t !== 0 ? t : a.label.localeCompare(b.label);
    });
    this.state.resourceRows = resourceRows;
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
