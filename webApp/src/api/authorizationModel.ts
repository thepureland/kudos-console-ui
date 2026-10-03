/*
 * Organization-mode authorization model shared by the console, the stateful mock and node tests.
 * Framework-free on purpose: nothing here may import Vue, Element Plus or the HTTP layer.
 *
 * Rules (backend decisions G-1..G-19): per-tenant overrides are role-level per member only (ADD a role
 * or REMOVE a default role); effective(m,t) = (defaults(m) − REMOVE(m,t)) ∪ ADD(m,t); an override that
 * changes nothing today is "ineffective" and is shown, never auto-deleted.
 */

export type CallerRank = 'PLATFORM' | 'ORGANIZATION_ADMIN' | 'ORGANIZATION_PERMISSION_ADMIN' | 'TENANT_PERMISSION_ADMIN' | 'MEMBER' | 'NONE';
export type OverrideAction = 'ADD' | 'REMOVE';
export type ManagementRoleKind = 'ORGANIZATION_PERMISSION_ADMIN' | 'TENANT_PERMISSION_ADMIN';

export interface OrganizationTenant { tenantId: string; name: string; active: boolean; open: boolean; subSystemCodes: string[] }
export interface OrganizationOverview {
  organizationId: string;
  revision: number;
  callerRank: CallerRank;
  /** null = every tenant of the organization. */
  manageableTenantIds: string[] | null;
  tenants: OrganizationTenant[];
}
export interface RoleCatalogItem { id: string; code: string; name: string; subSystemCode: string; active: boolean }

export interface MemberRoleView { roleId: string; default: boolean; override: OverrideAction | null; applies: boolean; ineffective: boolean }
export interface MemberTenantView {
  tenantId: string;
  tenantName: string;
  open: boolean;
  canEnter: boolean;
  entryDenial: string | null;
  editable: boolean;
  roles: MemberRoleView[];
}
export interface MemberAuthorizationView {
  organizationId: string;
  userId: string;
  username: string;
  revision: number;
  organizationAdmin: boolean;
  /** 'ORGANIZATION_PERMISSION_ADMIN' or 'TENANT_PERMISSION_ADMIN:<tenantId>'. */
  managementRoles: string[];
  directDefaultRoleIds: string[];
  /** Includes roles relayed by groups. */
  defaultRoleIds: string[];
  defaultsEditable: boolean;
  tenants: MemberTenantView[];
  roleCatalog: RoleCatalogItem[];
}
export interface EntryChange { tenantId: string; tenantName: string; regains: boolean }
export interface DefaultRolesPreview {
  revision: number;
  addedRoleIds: string[];
  removedRoleIds: string[];
  entryChanges: EntryChange[];
  /** tenantId → ['+roleId', '-roleId', …] */
  tenantRoleChanges: Record<string, string[]>;
  sodConflicts: string[];
}
export interface OpeningMember { userId: string; username: string; organizationAdmin: boolean; roleIds: string[] }
export interface TenantOpeningPreview {
  tenantId: string;
  organizationId: string;
  open: boolean;
  revision: number;
  affectedMembers: OpeningMember[];
  excludedMembers: OpeningMember[];
  membersPerRole: Record<string, number>;
}
export interface OrganizationAdminRow { userId: string; username: string; active: boolean; assignedBy: string | null; assignedTime: string | null }
export interface ManagementRoleRow { userId: string; username: string; roleKind: ManagementRoleKind; tenantId: string | null; grantedBy: string | null }

// region effective roles and status tags

/** effective = (defaults − REMOVE) ∪ ADD, in a stable order (defaults first, then additions). */
export function effectiveRoleIds(defaults: readonly string[], removed: readonly string[], added: readonly string[]): string[] {
  const removedSet = new Set(removed);
  const result: string[] = [];
  for (const id of [...defaults.filter(id => !removedSet.has(id)), ...added]) if (!result.includes(id)) result.push(id);
  return result;
}

/** An override that does not change today's result: REMOVE of a non-default role, ADD of a default role. */
export function isIneffectiveOverride(isDefault: boolean, override: OverrideAction | null): boolean {
  return (override === 'REMOVE' && !isDefault) || (override === 'ADD' && isDefault);
}

export type RoleStatusTag = 'INHERITED' | 'REMOVED_HERE' | 'ADDED_HERE' | 'INEFFECTIVE';

/** Status tags of one role row in one tenant; 'INEFFECTIVE' is appended to the override tag. */
export function roleStatusTags(role: Pick<MemberRoleView, 'default' | 'override' | 'ineffective'>): RoleStatusTag[] {
  const tags: RoleStatusTag[] = [];
  if (role.override === 'REMOVE') tags.push('REMOVED_HERE');
  else if (role.override === 'ADD') tags.push('ADDED_HERE');
  else if (role.default) tags.push('INHERITED');
  if (role.override != null && (role.ineffective || isIneffectiveOverride(role.default, role.override))) tags.push('INEFFECTIVE');
  return tags;
}

export interface RoleRowActions { removeHere: boolean; restore: boolean }
/**
 * Per-row actions: REMOVE applies to a default role not already removed here (it also replaces an
 * ineffective ADD); "restore inheritance" deletes whichever override exists.
 */
export function roleRowActions(role: Pick<MemberRoleView, 'default' | 'override'>, editable: boolean): RoleRowActions {
  return {
    removeHere: editable && role.default && role.override !== 'REMOVE',
    restore: editable && role.override != null,
  };
}

/** Roles the "add role" picker offers in one tenant: active catalog roles not already applying there. */
export function addableRoles(catalog: readonly RoleCatalogItem[], tenant: Pick<MemberTenantView, 'roles'>, enabledSubSystemCodes?: readonly string[] | null): RoleCatalogItem[] {
  const applying = new Set(tenant.roles.filter(role => role.applies).map(role => role.roleId));
  return catalog.filter(role => role.active && !applying.has(role.id)
    && (enabledSubSystemCodes == null || enabledSubSystemCodes.includes(role.subSystemCode)));
}

export type RoleChange = 'REMOVE' | 'ADD' | 'RESTORE';
/**
 * Expected change of entry to an open tenant after one override change: true = regains, false = loses,
 * null = unchanged (organization admins enter every open tenant). An estimate for the confirmation
 * prompt only; the dialog re-reads the server's result after every write.
 */
export function expectedEntryChange(tenant: Pick<MemberTenantView, 'open' | 'canEnter' | 'roles'>, organizationAdmin: boolean, roleId: string, change: RoleChange): boolean | null {
  if (!tenant.open || organizationAdmin) return null;
  const applying = new Set(tenant.roles.filter(role => role.applies).map(role => role.roleId));
  const isDefault = tenant.roles.find(role => role.roleId === roleId)?.default === true;
  if (change === 'ADD' || (change === 'RESTORE' && isDefault)) applying.add(roleId);
  else applying.delete(roleId);
  const after = applying.size > 0;
  return after === tenant.canEnter ? null : after;
}

/** 'TENANT_PERMISSION_ADMIN:tenant-b' → kind + tenant. */
export function parseManagementRole(value: string): { kind: ManagementRoleKind; tenantId: string | null } | null {
  const [kind, ...rest] = value.split(':');
  if (kind !== 'ORGANIZATION_PERMISSION_ADMIN' && kind !== 'TENANT_PERMISSION_ADMIN') return null;
  return { kind, tenantId: rest.length ? rest.join(':') : null };
}

/** Parses '+roleId' / '-roleId' change entries. */
export function parseRoleChange(value: string): { added: boolean; roleId: string } {
  return { added: value.startsWith('+'), roleId: value.replace(/^[+-]/, '') };
}

// endregion

// region capabilities by caller rank (the server stays authoritative)

const RANK_ORDER: CallerRank[] = ['NONE', 'MEMBER', 'TENANT_PERMISSION_ADMIN', 'ORGANIZATION_PERMISSION_ADMIN', 'ORGANIZATION_ADMIN', 'PLATFORM'];
export function rankAtLeast(rank: CallerRank, minimum: CallerRank): boolean { return RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(minimum); }
export function canAssignAdmins(rank: CallerRank): boolean { return rankAtLeast(rank, 'ORGANIZATION_ADMIN'); }
export function canOpenTenants(rank: CallerRank): boolean { return rankAtLeast(rank, 'ORGANIZATION_PERMISSION_ADMIN'); }
export function grantableManagementKinds(rank: CallerRank): ManagementRoleKind[] {
  if (rankAtLeast(rank, 'ORGANIZATION_ADMIN')) return ['ORGANIZATION_PERMISSION_ADMIN', 'TENANT_PERMISSION_ADMIN'];
  if (rank === 'ORGANIZATION_PERMISSION_ADMIN') return ['TENANT_PERMISSION_ADMIN'];
  return [];
}

// endregion

// region requests

export interface SaveDefaultsRequest { organizationId: string; userId: string; roleIds: string[]; expectedRevision: number; reason: string }
export interface OverrideRequest { organizationId: string; tenantId: string; userId: string; roleId: string; action?: OverrideAction; expectedRevision: number; reason: string }
export interface SetOpenRequest { tenantId: string; open: boolean; expectedRevision?: number; reason?: string }
export interface ManagementRoleRequest { organizationId: string; userId: string; roleKind: ManagementRoleKind; tenantIds: string[]; reason?: string }

export class ReasonRequiredError extends Error {
  constructor() { super('A reason is required'); this.name = 'ReasonRequiredError'; }
}
function requireReason(reason: string): string {
  const value = reason.trim();
  if (!value) throw new ReasonRequiredError();
  return value;
}
type MemberRevision = Pick<MemberAuthorizationView, 'organizationId' | 'userId' | 'revision'>;

/** Every write carries the revision of the last read; the server answers 409 when it moved on. */
export function buildSaveDefaults(view: MemberRevision, roleIds: readonly string[], reason: string): SaveDefaultsRequest {
  return { organizationId: view.organizationId, userId: view.userId, roleIds: [...new Set(roleIds)], expectedRevision: view.revision, reason: requireReason(reason) };
}
export function buildSaveOverride(view: MemberRevision, tenantId: string, roleId: string, action: OverrideAction, reason: string): OverrideRequest {
  return { organizationId: view.organizationId, tenantId, userId: view.userId, roleId, action, expectedRevision: view.revision, reason: requireReason(reason) };
}
export function buildRemoveOverride(view: MemberRevision, tenantId: string, roleId: string, reason: string): OverrideRequest {
  return { organizationId: view.organizationId, tenantId, userId: view.userId, roleId, expectedRevision: view.revision, reason: requireReason(reason) };
}
export function buildSetOpen(tenantId: string, open: boolean, revision: number, reason: string): SetOpenRequest {
  return { tenantId, open, expectedRevision: revision, reason: requireReason(reason) };
}
export function buildManagementRole(organizationId: string, userId: string, roleKind: ManagementRoleKind, tenantIds: readonly string[], reason = ''): ManagementRoleRequest {
  if (roleKind === 'TENANT_PERMISSION_ADMIN' && tenantIds.length === 0) throw new Error('TENANT_PERMISSION_ADMIN requires at least one tenant');
  return { organizationId, userId, roleKind, tenantIds: roleKind === 'TENANT_PERMISSION_ADMIN' ? [...tenantIds] : [], reason: reason.trim() || undefined };
}

// endregion

// region errors

export type OrganizationErrorInfo =
  | { kind: 'REVISION_CONFLICT'; code: 'AUTHZ_REVISION_CONFLICT'; currentRevision: number | null; status: number }
  | { kind: 'FORBIDDEN'; code: string; status: number }
  | { kind: 'SOD_CONFLICT'; code: 'AUTHZ_SOD_CONFLICT'; tenantId: string; roleA: string; roleB: string; status: number }
  | { kind: 'CONTEXT'; code: string; status: number }
  | { kind: 'OTHER'; code: string | null; message: string; status: number };

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') { try { return record(JSON.parse(value)); } catch { return null; } }
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
const CODE_PATTERN = /^(AUTHZ|ORGANIZATION|AUTHENTICATION)_[A-Z0-9_]+(:.*)?$/;
/** Finds an error code in a bare body ({code}), an ApiResponse wrapping it in data, or a message. */
function findCode(body: unknown): { code: string | null; source: Record<string, unknown> | null; message: string } {
  const top = record(body);
  const candidates = [top, record(top?.data)];
  for (const item of candidates) {
    if (!item) continue;
    for (const key of ['code', 'message']) {
      const value = item[key];
      if (typeof value === 'string' && CODE_PATTERN.test(value)) return { code: value, source: item, message: value };
    }
  }
  const message = typeof body === 'string' ? body : String(top?.message ?? record(top?.data)?.message ?? '');
  return { code: null, source: top, message };
}

/** Classifies an organization API failure from its HTTP status and body. */
export function parseOrganizationError(status: number, body: unknown): OrganizationErrorInfo {
  const { code, source, message } = findCode(body);
  if (code === 'AUTHZ_REVISION_CONFLICT') {
    const current = Number(source?.currentRevision);
    return { kind: 'REVISION_CONFLICT', code, currentRevision: Number.isFinite(current) ? current : null, status };
  }
  if (code?.startsWith('AUTHZ_SOD_CONFLICT')) {
    const [, tenantId = '', roleA = '', roleB = ''] = code.split(':');
    return { kind: 'SOD_CONFLICT', code: 'AUTHZ_SOD_CONFLICT', tenantId, roleA, roleB, status };
  }
  if (code?.startsWith('AUTHENTICATION_')) return { kind: 'CONTEXT', code, status };
  if (code && (status === 403 || code.startsWith('ORGANIZATION_'))) return { kind: 'FORBIDDEN', code, status };
  return { kind: 'OTHER', code, message: message || `HTTP ${status}`, status };
}

/** Codes with a dedicated message under organizationConsole.errors.*. */
export const KNOWN_ERROR_CODES = [
  'AUTHZ_REVISION_CONFLICT', 'AUTHZ_SOD_CONFLICT',
  'ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION', 'ORGANIZATION_LAST_ADMIN', 'ORGANIZATION_TARGET_OUTRANKS_ACTOR',
  'ORGANIZATION_MANAGEMENT_FORBIDDEN', 'ORGANIZATION_CANNOT_EDIT_HELD_ROLE',
  'AUTHENTICATION_STEP_UP_REQUIRED', 'AUTHENTICATION_CONTEXT_CHANGED', 'AUTHENTICATION_ORGANIZATION_SCOPE_UNAVAILABLE', 'AUTHENTICATION_TENANT_UNAVAILABLE',
] as const;
/** i18n key suffix for an error, or null when only the raw message can be shown. */
export function errorMessageKey(info: OrganizationErrorInfo): string | null {
  const code = info.code?.split(':')[0] ?? null;
  return code && (KNOWN_ERROR_CODES as readonly string[]).includes(code) ? code : null;
}

// endregion

// region context options

export interface ContextTenant { tenantId: string; name: string; organizationId: string; subSystemCodes: string[] }
export interface ContextOption { key: string; scope: 'TENANT' | 'ORGANIZATION'; tenantId: string | null; subSystemCode: string | null; tenantName: string }
/** Selector options: every tenant × system the server lists, plus the organization scope when open to the account. */
export function contextOptions(tenants: readonly ContextTenant[], organizationScope: boolean): ContextOption[] {
  const options: ContextOption[] = [];
  if (organizationScope) options.push({ key: 'ORGANIZATION', scope: 'ORGANIZATION', tenantId: null, subSystemCode: null, tenantName: '' });
  for (const tenant of tenants) {
    for (const code of tenant.subSystemCodes) options.push({ key: `${tenant.tenantId}/${code}`, scope: 'TENANT', tenantId: tenant.tenantId, subSystemCode: code, tenantName: tenant.name });
  }
  return options;
}
/** The system to select automatically after entering a tenant without one: 'console', or the only one. */
export function initialSubSystem(codes: readonly string[]): string | null {
  return codes.includes('console') ? 'console' : codes.length === 1 ? codes[0] : null;
}

// endregion
