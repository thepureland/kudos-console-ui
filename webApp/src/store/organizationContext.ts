import { reactive } from 'vue';
import { HttpResponseError, requestJson } from '../api/httpClient';
import { acceptRequestContext, type SessionTarget } from '../api/requestContext';
import { initialSubSystem, parseOrganizationError, type ContextTenant } from '../api/authorizationModel';
import { resolveApiPayload } from '../utils/backendRequest';

export type TenantContextOption = ContextTenant;
export interface ConsoleContexts { organizationId: string; current: SessionTarget; organizationScope: boolean; tenants: TenantContextOption[] }
/**
 * pending: not loaded yet; organization: the session has an organization target; legacy: the backend runs
 * without organization mode (the console behaves as before); error: the contexts could not be loaded.
 */
export type ContextMode = 'pending' | 'organization' | 'legacy' | 'error';

export const organizationContext = reactive({
  mode: 'pending' as ContextMode,
  current: null as SessionTarget | null,
  tenants: [] as TenantContextOption[],
  organizationScope: false,
  loading: false,
  switching: false,
  generation: 0,
  memberDialogVisible: false,
  memberUserId: '',
  managementVisible: false,
});

/** Whether Home may render pages: legacy mode, ORGANIZATION scope, or a TENANT scope with a sub-system. */
export function isConsoleReady(): boolean {
  if (organizationContext.mode === 'legacy') return true;
  const current = organizationContext.current;
  if (organizationContext.mode !== 'organization' || !current) return false;
  return current.scope === 'ORGANIZATION' || !!current.subSystemCode;
}

function normalize(target: SessionTarget): SessionTarget {
  const tenantId = target.tenantId || null;
  return { ...target, tenantId, scope: target.scope ?? (tenantId ? 'TENANT' : 'ORGANIZATION'), subSystemCode: target.subSystemCode || null };
}
function isLegacy(error: unknown): boolean {
  if (!(error instanceof HttpResponseError)) return false;
  if (error.status === 404) return true;
  return parseOrganizationError(error.status, error.data).code === 'AUTHENTICATION_ORGANIZATION_REQUIRED';
}

let pendingLoad: Promise<void> | null = null;
export function loadOrganizationContexts(): Promise<void> {
  if (pendingLoad) return pendingLoad;
  organizationContext.loading = true;
  pendingLoad = (async () => {
    let data: ConsoleContexts | null;
    try {
      const raw = await requestJson<unknown>('/api/auth/contexts');
      data = await resolveApiPayload<ConsoleContexts>(raw, 'Unable to load organization contexts');
    } catch (error) {
      if (isLegacy(error)) { organizationContext.mode = 'legacy'; return; }
      organizationContext.mode = 'error';
      throw error;
    }
    if (!data?.current?.organizationId || !data.current.contextVersion) { organizationContext.mode = 'error'; throw new Error('Invalid authentication context'); }
    const current = normalize(data.current);
    organizationContext.current = current;
    organizationContext.tenants = data.tenants ?? [];
    organizationContext.organizationScope = data.organizationScope === true;
    organizationContext.mode = 'organization';
    organizationContext.generation = acceptRequestContext(current);
    if (current.scope === 'TENANT' && current.tenantId && !current.subSystemCode) {
      const systems = organizationContext.tenants.find(tenant => tenant.tenantId === current.tenantId)?.subSystemCodes ?? [];
      const initial = initialSubSystem(systems);
      if (initial) await switchOrganizationContext(current.tenantId, initial);
    }
  })().finally(() => { organizationContext.loading = false; pendingLoad = null; });
  return pendingLoad;
}

/**
 * Re-reads the tenants and scopes the selector offers, without touching the session target (no new
 * request generation, so open pages keep their state). Used after opening or closing a tenant.
 */
export async function refreshOrganizationTenants(): Promise<void> {
  if (organizationContext.mode !== 'organization') return;
  const raw = await requestJson<unknown>('/api/auth/contexts');
  const data = await resolveApiPayload<ConsoleContexts>(raw, 'Unable to load organization contexts');
  if (!data || data.current?.contextVersion !== organizationContext.current?.contextVersion) return;
  organizationContext.tenants = data.tenants ?? [];
  organizationContext.organizationScope = data.organizationScope === true;
}

/** Switches to a tenant × system, or to the organization scope when tenantId is null. */
export async function switchOrganizationContext(tenantId: string | null, subSystemCode: string | null): Promise<void> {
  const current = organizationContext.current;
  if (!current || organizationContext.switching) return;
  organizationContext.switching = true;
  try {
    const raw = await requestJson<unknown>('/api/auth/context/switch', {
      method: 'POST', body: { tenantId, subSystemCode: tenantId ? subSystemCode : null, contextVersion: current.contextVersion },
    });
    const data = await resolveApiPayload<{ status: string; current: SessionTarget }>(raw, 'Unable to switch context');
    if (data?.status !== 'SWITCHED' || !data.current?.contextVersion) throw new Error('Authentication is required to switch context');
    const next = normalize(data.current);
    organizationContext.current = next;
    organizationContext.generation = acceptRequestContext(next);
  } finally { organizationContext.switching = false; }
}

export function clearOrganizationContext(): void {
  organizationContext.mode = 'pending';
  organizationContext.current = null;
  organizationContext.tenants = [];
  organizationContext.organizationScope = false;
  organizationContext.memberDialogVisible = false;
  organizationContext.managementVisible = false;
  organizationContext.generation = acceptRequestContext(null);
}

/** Opens the member authorization dialog (default roles and per-tenant role overrides). */
export function openMemberAuthorization(userId: string): void {
  organizationContext.memberUserId = userId;
  organizationContext.memberDialogVisible = true;
}

/** Opens the organization management panel (tenants, organization admins, management roles). */
export function openOrganizationManagement(): void {
  organizationContext.managementVisible = true;
}
