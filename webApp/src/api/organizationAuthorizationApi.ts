import { HttpResponseError, requestJson } from './httpClient';
import { StaleContextError } from './requestContext';
import { resolveApiPayload } from '../utils/backendRequest';
import {
  parseOrganizationError,
  type DefaultRolesPreview, type ManagementRoleRequest, type ManagementRoleRow, type MemberAuthorizationView,
  type OrganizationAdminRow, type OrganizationErrorInfo, type OrganizationOverview, type OverrideRequest,
  type RoleCatalogItem, type SaveDefaultsRequest, type SetOpenRequest, type TenantOpeningPreview,
} from './authorizationModel';

/** A failed organization request with its classified cause (409 revision conflict, 403 policy refusal, …). */
export class OrganizationRequestError extends Error {
  readonly info: OrganizationErrorInfo;
  constructor(info: OrganizationErrorInfo, message: string) {
    super(message);
    this.name = 'OrganizationRequestError';
    this.info = info;
  }
}

/*
 * Same relative-path convention as backendRequest (`auth/organization/...` under /api/admin), but through
 * requestJson so the HTTP status survives: backendRequest folds non-2xx bodies into a normal result, and a
 * 409 {code:'AUTHZ_REVISION_CONFLICT'} must never be mistaken for a payload.
 */
async function call<T>(route: string, options: { method?: 'GET' | 'POST'; query?: Record<string, unknown>; body?: unknown }): Promise<T> {
  let raw: unknown;
  try {
    raw = await requestJson<unknown>(`/api/admin/auth/organization/${route}`, { method: options.method ?? 'POST', query: options.query, body: options.body });
  } catch (error) {
    if (error instanceof StaleContextError) throw error;
    if (error instanceof HttpResponseError) {
      const info = parseOrganizationError(error.status, error.data);
      throw new OrganizationRequestError(info, info.kind === 'OTHER' ? info.message : info.code);
    }
    throw error;
  }
  try {
    return await resolveApiPayload<T>(raw, 'Organization request failed') as T;
  } catch (error) {
    // HTTP 200 with success:false — classify the message too (e.g. AUTHZ_SOD_CONFLICT:<tenant>:<a>:<b>).
    const message = error instanceof Error ? error.message : String(error);
    const info = parseOrganizationError(200, { message });
    throw new OrganizationRequestError(info, message);
  }
}
const post = <T>(route: string, body: unknown) => call<T>(route, { body });

export const organizationAuthorizationApi = {
  overview: (organizationId: string) => call<OrganizationOverview>('overview', { method: 'GET', query: { organizationId } }),
  roleCatalog: (organizationId: string) => call<RoleCatalogItem[]>('roleCatalog', { method: 'GET', query: { organizationId } }),

  associateTenant: (tenantId: string, organizationId: string, reason?: string) => post<number>('tenant/associate', { tenantId, organizationId, reason }),
  dissociateTenant: (tenantId: string, reason?: string) => post<number>('tenant/dissociate', { tenantId, reason }),
  previewOpening: (tenantId: string, open: boolean) => post<TenantOpeningPreview>('tenant/preview', { tenantId, open }),
  setOpen: (request: SetOpenRequest) => post<number>('tenant/setOpen', request),

  readMember: (organizationId: string, userId: string) => post<MemberAuthorizationView>('member/read', { organizationId, userId }),
  previewDefaults: (organizationId: string, userId: string, roleIds: string[]) => post<DefaultRolesPreview>('member/previewDefaults', { organizationId, userId, roleIds }),
  saveDefaults: (request: SaveDefaultsRequest) => post<number>('member/saveDefaults', request),
  saveOverride: (request: OverrideRequest) => post<number>('member/saveOverride', request),
  removeOverride: (request: OverrideRequest) => post<number>('member/removeOverride', request),

  listAdmins: (organizationId: string) => post<OrganizationAdminRow[]>('admin/list', { organizationId }),
  assignAdmin: (organizationId: string, userId: string, reason?: string) => post<number>('admin/assign', { organizationId, userId, reason }),
  revokeAdmin: (organizationId: string, userId: string, reason?: string) => post<number>('admin/revoke', { organizationId, userId, reason }),

  listManagementRoles: (organizationId: string) => post<ManagementRoleRow[]>('managementRole/list', { organizationId }),
  grantManagementRole: (request: ManagementRoleRequest) => post<number>('managementRole/grant', request),
  revokeManagementRole: (request: ManagementRoleRequest) => post<number>('managementRole/revoke', request),
};
