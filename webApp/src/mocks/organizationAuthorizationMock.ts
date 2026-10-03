import type { MockRequest, MockResponse } from './mockDatabase';
import {
  effectiveRoleIds, isIneffectiveOverride,
  type CallerRank, type ManagementRoleKind, type MemberAuthorizationView, type MemberTenantView, type OverrideAction, type RoleCatalogItem,
} from '../api/authorizationModel.ts';

/*
 * Stateful mock of the organization-mode backend (kudos auth/organization/* and /api/auth/contexts).
 *
 * Seed (backend acceptance K-1): organization org-1 owns tenants A/B/C (open) and D (closed). Roles
 * user-admin / report-view (console) and notify-send (portal). wang's defaults are user-admin + report-view
 * with REMOVE user-admin in B; lin has report-view direct and notify-send through a group; zhang is the
 * organization admin and the mock session's user; li is organization permission admin; chen is tenant
 * permission admin of B. tenant-1 / tenant-2 are unassociated platform-side tenants for associate demos.
 */

interface TenantState { tenantId: string; name: string; organizationId: string | null; open: boolean; active: boolean; subSystemCodes: string[] }
interface MemberState { userId: string; username: string; organizationId: string; active: boolean; directRoleIds: string[]; groupRoleIds: string[] }
interface ManagementGrant { userId: string; roleKind: ManagementRoleKind; tenantId: string | null; grantedBy: string }
interface AdminState { userId: string; assignedBy: string; assignedTime: string }
interface Target { organizationId: string; scope: 'TENANT' | 'ORGANIZATION'; tenantId: string | null; subSystemCode: string | null; contextVersion: string }
type Body = Record<string, unknown>;

const ORG = 'org-1';
/** callerId of a platform administrator (no organization membership). */
const PLATFORM_CALLER = 'platform';
const NOW = '2026-10-03 09:00:00';
/** Separation of duties: these two roles may not be effective together in one tenant. */
const SOD_PAIRS: Array<[string, string]> = [['user-admin', 'notify-send']];

const ok = (data: unknown): MockResponse => ({ status: 200, body: { success: true, code: 200, data } });
/** Policy refusals and conflicts use the controller's bare bodies ({code, …}) with a non-2xx status. */
const refuse = (status: number, code: string, extra: Body = {}): MockResponse => ({ status, body: { code, message: code, ...extra } });
const failure = (status: number, message: string): MockResponse => ({ status, body: { success: false, code: status, message } });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const str = (value: unknown): string => (value == null ? '' : String(value));
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

class Refusal extends Error {
  readonly response: MockResponse;
  constructor(response: MockResponse) { super('refused'); this.response = response; }
}
function deny(code: string): never { throw new Refusal(refuse(403, code)); }

export class OrganizationAuthorizationMock {
  revision = 1;
  /** The signed-in account of the mock session. */
  callerId = 'user-zhang';
  /** Whether the caller also acts as platform operator (tenant association on the platform tenant page). */
  platformOperator = true;
  private contextSequence = 1;
  current: Target = { organizationId: ORG, scope: 'TENANT', tenantId: 'tenant-a', subSystemCode: 'console', contextVersion: 'mock-context-1' };

  readonly tenants: TenantState[] = [
    { tenantId: 'tenant-a', name: '组织甲 · A 站', organizationId: ORG, open: true, active: true, subSystemCodes: ['console', 'portal'] },
    { tenantId: 'tenant-b', name: '组织甲 · B 站', organizationId: ORG, open: true, active: true, subSystemCodes: ['console', 'portal'] },
    { tenantId: 'tenant-c', name: '组织甲 · C 站', organizationId: ORG, open: true, active: true, subSystemCodes: ['console'] },
    { tenantId: 'tenant-d', name: '组织甲 · D 站', organizationId: ORG, open: false, active: true, subSystemCodes: ['console'] },
    { tenantId: 'tenant-1', name: '示例租户', organizationId: null, open: false, active: true, subSystemCodes: ['console'] },
    { tenantId: 'tenant-2', name: '华东租户', organizationId: null, open: false, active: true, subSystemCodes: ['portal'] },
  ];
  readonly roles: RoleCatalogItem[] = [
    { id: 'user-admin', code: 'USER_ADMIN', name: '使用者管理员', subSystemCode: 'console', active: true },
    { id: 'report-view', code: 'REPORT_VIEW', name: '报表查看', subSystemCode: 'console', active: true },
    { id: 'notify-send', code: 'NOTIFY_SEND', name: '通知发送', subSystemCode: 'portal', active: true },
  ];
  readonly members: MemberState[] = [
    { userId: 'user-wang', username: 'wang', organizationId: ORG, active: true, directRoleIds: ['user-admin', 'report-view'], groupRoleIds: [] },
    { userId: 'user-lin', username: 'lin', organizationId: ORG, active: true, directRoleIds: ['report-view'], groupRoleIds: ['notify-send'] },
    { userId: 'user-zhang', username: 'zhang', organizationId: ORG, active: true, directRoleIds: [], groupRoleIds: [] },
    { userId: 'user-li', username: 'li', organizationId: ORG, active: true, directRoleIds: [], groupRoleIds: [] },
    { userId: 'user-chen', username: 'chen', organizationId: ORG, active: true, directRoleIds: [], groupRoleIds: [] },
  ];
  /** key `${tenantId}|${userId}|${roleId}` → action */
  readonly overrides = new Map<string, OverrideAction>([['tenant-b|user-wang|user-admin', 'REMOVE']]);
  readonly admins: AdminState[] = [{ userId: 'user-zhang', assignedBy: 'platform', assignedTime: NOW }];
  readonly grants: ManagementGrant[] = [
    { userId: 'user-li', roleKind: 'ORGANIZATION_PERMISSION_ADMIN', tenantId: null, grantedBy: 'zhang' },
    { userId: 'user-chen', roleKind: 'TENANT_PERMISSION_ADMIN', tenantId: 'tenant-b', grantedBy: 'zhang' },
  ];

  // region model

  member(userId: string): MemberState | undefined { return this.members.find(item => item.userId === userId && item.active); }
  tenant(tenantId: string): TenantState | undefined { return this.tenants.find(item => item.tenantId === tenantId); }
  organizationTenants(): TenantState[] { return this.tenants.filter(item => item.organizationId === ORG); }
  isAdmin(userId: string): boolean { return this.admins.some(item => item.userId === userId); }
  defaults(member: MemberState): string[] { return [...new Set([...member.directRoleIds, ...member.groupRoleIds])]; }
  overridesOf(tenantId: string, userId: string): Array<{ roleId: string; action: OverrideAction }> {
    const prefix = `${tenantId}|${userId}|`;
    return [...this.overrides].filter(([key]) => key.startsWith(prefix)).map(([key, action]) => ({ roleId: key.slice(prefix.length), action }));
  }
  private roleEnabled(roleId: string, tenant: TenantState): boolean {
    const role = this.roles.find(item => item.id === roleId);
    return !!role && role.active && tenant.subSystemCodes.includes(role.subSystemCode);
  }
  /** effective(m, t) = (defaults − REMOVE) ∪ ADD, limited to active roles of systems the tenant enables. */
  effective(userId: string, tenantId: string, defaultsOverride?: string[]): string[] {
    const member = this.member(userId), tenant = this.tenant(tenantId);
    if (!member || !tenant) return [];
    const overrides = this.overridesOf(tenantId, userId);
    return effectiveRoleIds(defaultsOverride ?? this.defaults(member),
      overrides.filter(item => item.action === 'REMOVE').map(item => item.roleId),
      overrides.filter(item => item.action === 'ADD').map(item => item.roleId)).filter(id => this.roleEnabled(id, tenant));
  }
  /** Entry: open tenant and (organization admin or a non-empty effective role set). */
  canEnter(userId: string, tenantId: string, defaultsOverride?: string[]): boolean {
    const tenant = this.tenant(tenantId);
    if (!tenant || tenant.organizationId !== ORG || !tenant.open || !tenant.active) return false;
    return this.isAdmin(userId) || this.effective(userId, tenantId, defaultsOverride).length > 0;
  }
  private entryDenial(userId: string, tenantId: string): string | null {
    const tenant = this.tenant(tenantId);
    if (!tenant?.open) return 'TENANT_NOT_OPEN';
    return this.canEnter(userId, tenantId) ? null : 'NO_EFFECTIVE_ROLE';
  }
  private enteredSystems(userId: string, tenant: TenantState): string[] {
    if (this.isAdmin(userId)) return [...tenant.subSystemCodes];
    const roles = this.effective(userId, tenant.tenantId).map(id => this.roles.find(role => role.id === id)?.subSystemCode);
    return tenant.subSystemCodes.filter(code => roles.includes(code));
  }
  rank(userId: string): CallerRank {
    if (userId === PLATFORM_CALLER) return 'PLATFORM';
    if (this.isAdmin(userId)) return 'ORGANIZATION_ADMIN';
    if (this.grants.some(item => item.userId === userId && item.roleKind === 'ORGANIZATION_PERMISSION_ADMIN')) return 'ORGANIZATION_PERMISSION_ADMIN';
    if (this.grants.some(item => item.userId === userId && item.roleKind === 'TENANT_PERMISSION_ADMIN')) return 'TENANT_PERMISSION_ADMIN';
    return this.member(userId) ? 'MEMBER' : 'NONE';
  }
  private level(rank: CallerRank): number { return ['NONE', 'MEMBER', 'TENANT_PERMISSION_ADMIN', 'ORGANIZATION_PERMISSION_ADMIN', 'ORGANIZATION_ADMIN', 'PLATFORM'].indexOf(rank); }
  private managementRoles(userId: string): string[] {
    return this.grants.filter(item => item.userId === userId).map(item => item.tenantId ? `${item.roleKind}:${item.tenantId}` : item.roleKind);
  }
  private hasOrganizationScope(userId: string): boolean { return this.isAdmin(userId) || this.grants.some(item => item.userId === userId); }
  private governs(userId: string, tenantId: string): boolean {
    const rank = this.rank(userId);
    if (rank === 'ORGANIZATION_ADMIN' || rank === 'ORGANIZATION_PERMISSION_ADMIN') return true;
    return this.grants.some(item => item.userId === userId && item.roleKind === 'TENANT_PERMISSION_ADMIN' && item.tenantId === tenantId);
  }
  /** Common write guards: not on oneself, not on a higher-ranked member. */
  private guardTarget(targetId: string): MemberState {
    const target = this.member(targetId);
    if (!target) throw new Refusal(refuse(404, 'ORGANIZATION_MEMBER_NOT_FOUND'));
    if (targetId === this.callerId) deny('ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION');
    if (this.level(this.rank(targetId)) > this.level(this.rank(this.callerId))) deny('ORGANIZATION_TARGET_OUTRANKS_ACTOR');
    return target;
  }
  private checkRevision(expected: unknown): void {
    if (expected != null && Number(expected) !== this.revision) throw new Refusal(refuse(409, 'AUTHZ_REVISION_CONFLICT', { currentRevision: this.revision }));
  }
  private checkOrganization(organizationId: unknown): void {
    if (str(organizationId) !== ORG) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
    if (!this.platformOperator && this.rank(this.callerId) === 'NONE') deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
  }
  private sodConflicts(userId: string, defaultsOverride?: string[], extra?: { tenantId: string; roleId: string; action: OverrideAction | null }): string[] {
    const conflicts: string[] = [];
    for (const tenant of this.organizationTenants()) {
      let roles = this.effective(userId, tenant.tenantId, defaultsOverride);
      if (extra && extra.tenantId === tenant.tenantId) {
        const member = this.member(userId)!;
        const overrides = this.overridesOf(tenant.tenantId, userId).filter(item => item.roleId !== extra.roleId);
        if (extra.action) overrides.push({ roleId: extra.roleId, action: extra.action });
        roles = effectiveRoleIds(defaultsOverride ?? this.defaults(member), overrides.filter(item => item.action === 'REMOVE').map(item => item.roleId),
          overrides.filter(item => item.action === 'ADD').map(item => item.roleId)).filter(id => this.roleEnabled(id, tenant));
      }
      for (const [a, b] of SOD_PAIRS) if (roles.includes(a) && roles.includes(b)) conflicts.push(`AUTHZ_SOD_CONFLICT:${tenant.tenantId}:${a}:${b}`);
    }
    return conflicts;
  }
  private bump(): number { return ++this.revision; }

  // endregion

  // region views

  overview(): Body {
    const rank = this.rank(this.callerId);
    const manageable = rank === 'TENANT_PERMISSION_ADMIN'
      ? this.grants.filter(item => item.userId === this.callerId && item.tenantId).map(item => item.tenantId as string)
      : null;
    return {
      organizationId: ORG, revision: this.revision, callerRank: rank, manageableTenantIds: manageable,
      tenants: this.organizationTenants().map(({ tenantId, name, active, open, subSystemCodes }) => ({ tenantId, name, active, open, subSystemCodes: [...subSystemCodes] })),
    };
  }

  readMember(userId: string): MemberAuthorizationView {
    const member = this.member(userId);
    if (!member) throw new Refusal(refuse(404, 'ORGANIZATION_MEMBER_NOT_FOUND'));
    const callerRank = this.rank(this.callerId);
    const notSelf = userId !== this.callerId;
    const notOutranked = this.level(this.rank(userId)) <= this.level(callerRank);
    const defaults = this.defaults(member);
    const tenants: MemberTenantView[] = this.organizationTenants().map(tenant => {
      const overrides = this.overridesOf(tenant.tenantId, userId);
      const effective = this.effective(userId, tenant.tenantId);
      const roleIds = [...new Set([...defaults, ...overrides.map(item => item.roleId)])];
      return {
        tenantId: tenant.tenantId, tenantName: tenant.name, open: tenant.open,
        canEnter: this.canEnter(userId, tenant.tenantId), entryDenial: this.entryDenial(userId, tenant.tenantId),
        editable: notSelf && notOutranked && this.governs(this.callerId, tenant.tenantId),
        roles: roleIds.map(roleId => {
          const isDefault = defaults.includes(roleId);
          const override = overrides.find(item => item.roleId === roleId)?.action ?? null;
          return { roleId, default: isDefault, override, applies: effective.includes(roleId), ineffective: isIneffectiveOverride(isDefault, override) };
        }),
      };
    });
    return {
      organizationId: ORG, userId, username: member.username, revision: this.revision,
      organizationAdmin: this.isAdmin(userId), managementRoles: this.managementRoles(userId),
      directDefaultRoleIds: [...member.directRoleIds], defaultRoleIds: defaults,
      defaultsEditable: notSelf && notOutranked && (callerRank === 'ORGANIZATION_ADMIN' || callerRank === 'ORGANIZATION_PERMISSION_ADMIN'),
      tenants, roleCatalog: copy(this.roles),
    };
  }

  previewDefaults(userId: string, roleIds: string[]): Body {
    const member = this.member(userId);
    if (!member) throw new Refusal(refuse(404, 'ORGANIZATION_MEMBER_NOT_FOUND'));
    const before = this.defaults(member);
    const after = [...new Set([...roleIds, ...member.groupRoleIds])];
    const entryChanges: Body[] = [];
    const tenantRoleChanges: Record<string, string[]> = {};
    for (const tenant of this.organizationTenants()) {
      const was = this.effective(userId, tenant.tenantId), will = this.effective(userId, tenant.tenantId, after);
      const changes = [...will.filter(id => !was.includes(id)).map(id => `+${id}`), ...was.filter(id => !will.includes(id)).map(id => `-${id}`)];
      if (changes.length) tenantRoleChanges[tenant.tenantId] = changes;
      if (!tenant.open || this.isAdmin(userId)) continue;
      const entered = this.canEnter(userId, tenant.tenantId), enters = this.canEnter(userId, tenant.tenantId, after);
      if (entered !== enters) entryChanges.push({ tenantId: tenant.tenantId, tenantName: tenant.name, regains: enters });
    }
    return {
      revision: this.revision,
      addedRoleIds: after.filter(id => !before.includes(id)), removedRoleIds: before.filter(id => !after.includes(id)),
      entryChanges, tenantRoleChanges, sodConflicts: this.sodConflicts(userId, after),
    };
  }

  previewOpening(tenantId: string, open: boolean): Body {
    const tenant = this.tenant(tenantId);
    if (!tenant || tenant.organizationId !== ORG) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
    const affected: Body[] = [], excluded: Body[] = [];
    const membersPerRole: Record<string, number> = {};
    for (const member of this.members.filter(item => item.active && item.organizationId === ORG)) {
      const roleIds = this.effective(member.userId, tenantId);
      const admin = this.isAdmin(member.userId);
      const row = { userId: member.userId, username: member.username, organizationAdmin: admin, roleIds };
      if (admin || roleIds.length) {
        affected.push(row);
        for (const id of roleIds) membersPerRole[id] = (membersPerRole[id] ?? 0) + 1;
      } else excluded.push(row);
    }
    return { tenantId, organizationId: ORG, open, revision: this.revision, affectedMembers: affected, excludedMembers: excluded, membersPerRole };
  }

  contexts(): Body {
    const tenants = this.organizationTenants()
      .filter(tenant => this.canEnter(this.callerId, tenant.tenantId))
      .map(tenant => ({ tenantId: tenant.tenantId, name: tenant.name, organizationId: ORG, subSystemCodes: this.enteredSystems(this.callerId, tenant) }))
      .filter(tenant => tenant.subSystemCodes.length > 0);
    return { organizationId: ORG, current: copy(this.current), organizationScope: this.hasOrganizationScope(this.callerId), tenants };
  }

  /** Platform tenant list rows carry organizationId / organizationOpen like sys_tenant does. */
  decorateTenantRow(row: Record<string, unknown>): Record<string, unknown> {
    const tenant = this.tenant(str(row.id));
    if (!tenant) return row;
    return { ...row, organizationId: tenant.organizationId, organizationOpen: tenant.organizationId ? tenant.open : false };
  }

  // endregion

  dispatch(url: URL, request: MockRequest): MockResponse | null {
    const route = url.pathname.replace(/^\/api\/admin\//, '').replace(/^\/api\//, '');
    const body = (request.body ?? {}) as Body;
    try {
      if (route === 'auth/contexts') return ok(this.contexts());
      if (route === 'auth/context/switch') return this.switchContext(body);
      if (!route.startsWith('auth/organization/')) return null;
      return this.dispatchOrganization(route.slice('auth/organization/'.length), url, body);
    } catch (error) {
      if (error instanceof Refusal) return error.response;
      throw error;
    }
  }

  private switchContext(body: Body): MockResponse {
    if (str(body.contextVersion) !== this.current.contextVersion) return refuse(409, 'AUTHENTICATION_CONTEXT_CHANGED');
    const tenantId = str(body.tenantId) || null;
    const subSystemCode = str(body.subSystemCode) || null;
    if (tenantId == null) {
      if (!this.hasOrganizationScope(this.callerId)) return refuse(409, 'AUTHENTICATION_ORGANIZATION_SCOPE_UNAVAILABLE');
      this.current = { organizationId: ORG, scope: 'ORGANIZATION', tenantId: null, subSystemCode, contextVersion: `mock-context-${++this.contextSequence}` };
    } else {
      const tenant = this.tenant(tenantId);
      if (!tenant || !this.canEnter(this.callerId, tenantId)) return refuse(409, `AUTHENTICATION_TENANT_UNAVAILABLE:${tenant ? this.entryDenial(this.callerId, tenantId) : 'TENANT_NOT_FOUND'}`);
      if (subSystemCode && !this.enteredSystems(this.callerId, tenant).includes(subSystemCode)) return refuse(409, 'AUTHENTICATION_TENANT_UNAVAILABLE:SUB_SYSTEM_NOT_AVAILABLE');
      this.current = { organizationId: ORG, scope: 'TENANT', tenantId, subSystemCode, contextVersion: `mock-context-${++this.contextSequence}` };
    }
    const caller = this.member(this.callerId)!;
    return ok({ status: 'SWITCHED', current: copy(this.current), user: { id: caller.userId, username: caller.username, organizationId: ORG, tenantId: tenantId ?? '' } });
  }

  private dispatchOrganization(route: string, url: URL, body: Body): MockResponse {
    const callerRank = this.rank(this.callerId);
    const atLeast = (minimum: CallerRank) => { if (this.level(callerRank) < this.level(minimum)) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN'); };
    switch (route) {
      case 'overview': this.checkOrganization(url.searchParams.get('organizationId')); return ok(this.overview());
      case 'roleCatalog': this.checkOrganization(url.searchParams.get('organizationId')); return ok(copy(this.roles));

      case 'tenant/associate': {
        if (!this.platformOperator && callerRank !== 'PLATFORM') deny('ORGANIZATION_PLATFORM_ONLY');
        const tenant = this.tenant(str(body.tenantId));
        if (!tenant) return refuse(404, 'ORGANIZATION_TENANT_NOT_FOUND');
        if (str(body.organizationId) !== ORG) deny('ORGANIZATION_NOT_FOUND');
        if (tenant.organizationId) deny('ORGANIZATION_TENANT_ALREADY_ASSOCIATED');
        tenant.organizationId = ORG; tenant.open = false;
        return ok(this.bump());
      }
      case 'tenant/dissociate': {
        if (!this.platformOperator && callerRank !== 'PLATFORM') deny('ORGANIZATION_PLATFORM_ONLY');
        const tenant = this.tenant(str(body.tenantId));
        if (!tenant?.organizationId) return refuse(404, 'ORGANIZATION_TENANT_NOT_ASSOCIATED');
        for (const key of [...this.overrides.keys()]) if (key.startsWith(`${tenant.tenantId}|`)) this.overrides.delete(key);
        for (let index = this.grants.length - 1; index >= 0; index--) if (this.grants[index].tenantId === tenant.tenantId) this.grants.splice(index, 1);
        tenant.organizationId = null; tenant.open = false;
        return ok(this.bump());
      }
      case 'tenant/preview': atLeast('ORGANIZATION_PERMISSION_ADMIN'); return ok(this.previewOpening(str(body.tenantId), body.open === true));
      case 'tenant/setOpen': {
        atLeast('ORGANIZATION_PERMISSION_ADMIN');
        const tenant = this.tenant(str(body.tenantId));
        if (!tenant || tenant.organizationId !== ORG) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
        this.checkRevision(body.expectedRevision);
        tenant.open = body.open === true;
        return ok(this.bump());
      }

      case 'member/read': this.checkOrganization(body.organizationId); return ok(this.readMember(str(body.userId)));
      case 'member/previewDefaults': this.checkOrganization(body.organizationId); return ok(this.previewDefaults(str(body.userId), list(body.roleIds)));
      case 'member/saveDefaults': {
        this.checkOrganization(body.organizationId);
        atLeast('ORGANIZATION_PERMISSION_ADMIN');
        const target = this.guardTarget(str(body.userId));
        this.checkRevision(body.expectedRevision);
        if (!str(body.reason).trim()) return failure(400, 'ORGANIZATION_REASON_REQUIRED');
        const roleIds = list(body.roleIds);
        if (roleIds.some(id => !this.roles.some(role => role.id === id))) return failure(400, 'ORGANIZATION_ROLE_NOT_FOUND');
        const conflicts = this.sodConflicts(target.userId, [...new Set([...roleIds, ...target.groupRoleIds])]);
        if (conflicts.length) return failure(400, conflicts[0]);
        target.directRoleIds = [...new Set(roleIds)];
        return ok(this.bump());
      }
      case 'member/saveOverride':
      case 'member/removeOverride': {
        this.checkOrganization(body.organizationId);
        const tenantId = str(body.tenantId), roleId = str(body.roleId);
        const tenant = this.tenant(tenantId);
        if (!tenant || tenant.organizationId !== ORG) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
        if (!this.governs(this.callerId, tenantId)) deny('ORGANIZATION_MANAGEMENT_FORBIDDEN');
        const target = this.guardTarget(str(body.userId));
        this.checkRevision(body.expectedRevision);
        if (!str(body.reason).trim()) return failure(400, 'ORGANIZATION_REASON_REQUIRED');
        if (!this.roles.some(role => role.id === roleId)) return failure(400, 'ORGANIZATION_ROLE_NOT_FOUND');
        const key = `${tenantId}|${target.userId}|${roleId}`;
        if (route === 'member/removeOverride') {
          if (!this.overrides.has(key)) return failure(400, 'ORGANIZATION_OVERRIDE_NOT_FOUND');
          const conflicts = this.sodConflicts(target.userId, undefined, { tenantId, roleId, action: null });
          if (conflicts.length) return failure(400, conflicts[0]);
          this.overrides.delete(key);
        } else {
          const action = str(body.action);
          if (action !== 'ADD' && action !== 'REMOVE') return failure(400, 'action is required');
          const conflicts = this.sodConflicts(target.userId, undefined, { tenantId, roleId, action });
          if (conflicts.length) return failure(400, conflicts[0]);
          this.overrides.set(key, action);
        }
        return ok(this.bump());
      }

      case 'admin/list':
        this.checkOrganization(body.organizationId);
        return ok(this.admins.map(item => ({ userId: item.userId, username: this.member(item.userId)?.username ?? item.userId, active: !!this.member(item.userId), assignedBy: item.assignedBy, assignedTime: item.assignedTime })));
      case 'admin/assign':
      case 'admin/revoke': {
        this.checkOrganization(body.organizationId);
        atLeast('ORGANIZATION_ADMIN');
        const userId = str(body.userId);
        if (userId === this.callerId) deny('ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION');
        if (!this.member(userId)) return refuse(404, 'ORGANIZATION_MEMBER_NOT_FOUND');
        if (route === 'admin/assign') {
          if (this.isAdmin(userId)) return failure(400, 'ORGANIZATION_ALREADY_ADMIN');
          this.admins.push({ userId, assignedBy: this.member(this.callerId)?.username ?? 'platform', assignedTime: NOW });
        } else {
          const index = this.admins.findIndex(item => item.userId === userId);
          if (index < 0) return failure(400, 'ORGANIZATION_NOT_ADMIN');
          if (this.admins.length === 1) deny('ORGANIZATION_LAST_ADMIN');
          this.admins.splice(index, 1);
        }
        return ok(this.bump());
      }

      case 'managementRole/list':
        this.checkOrganization(body.organizationId);
        return ok(this.grants.map(item => ({ userId: item.userId, username: this.member(item.userId)?.username ?? item.userId, roleKind: item.roleKind, tenantId: item.tenantId, grantedBy: item.grantedBy })));
      case 'managementRole/grant':
      case 'managementRole/revoke': {
        this.checkOrganization(body.organizationId);
        const kind = str(body.roleKind) as ManagementRoleKind;
        if (kind !== 'ORGANIZATION_PERMISSION_ADMIN' && kind !== 'TENANT_PERMISSION_ADMIN') return failure(400, 'ORGANIZATION_UNKNOWN_ROLE_KIND');
        atLeast(kind === 'ORGANIZATION_PERMISSION_ADMIN' ? 'ORGANIZATION_ADMIN' : 'ORGANIZATION_PERMISSION_ADMIN');
        const target = this.guardTarget(str(body.userId));
        const tenantIds = kind === 'TENANT_PERMISSION_ADMIN' ? list(body.tenantIds) : [];
        if (kind === 'TENANT_PERMISSION_ADMIN' && (!tenantIds.length || tenantIds.some(id => this.tenant(id)?.organizationId !== ORG))) return failure(400, 'ORGANIZATION_TENANT_REQUIRED');
        const scopes = kind === 'TENANT_PERMISSION_ADMIN' ? tenantIds : [null];
        for (const tenantId of scopes) {
          const index = this.grants.findIndex(item => item.userId === target.userId && item.roleKind === kind && item.tenantId === tenantId);
          if (route === 'managementRole/grant' && index < 0) this.grants.push({ userId: target.userId, roleKind: kind, tenantId, grantedBy: this.member(this.callerId)?.username ?? 'platform' });
          if (route === 'managementRole/revoke' && index >= 0) this.grants.splice(index, 1);
        }
        return ok(this.bump());
      }
      default:
        return refuse(404, 'ORGANIZATION_ENDPOINT_NOT_FOUND');
    }
  }
}
