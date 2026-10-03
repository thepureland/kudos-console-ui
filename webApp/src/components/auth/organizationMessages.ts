import { errorMessageKey, parseOrganizationError, type OrganizationErrorInfo } from '../../api/authorizationModel';
import { OrganizationRequestError } from '../../api/organizationAuthorizationApi';
import { HttpResponseError } from '../../api/httpClient';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Classifies any thrown value from an organization request or a context switch. */
export function organizationErrorInfo(error: unknown): OrganizationErrorInfo {
  if (error instanceof OrganizationRequestError) return error.info;
  if (error instanceof HttpResponseError) return parseOrganizationError(error.status, error.data);
  const message = error instanceof Error ? error.message : String(error);
  return parseOrganizationError(0, { message });
}

/**
 * User-facing text for an organization failure: known codes are translated (409 shows the current
 * revision, SoD names the tenant and roles), anything else falls back to the server's message.
 */
export function organizationErrorText(t: Translate, error: unknown, names: { role?: (id: string) => string; tenant?: (id: string) => string } = {}): string {
  const info = organizationErrorInfo(error);
  const key = errorMessageKey(info);
  if (!key) return info.kind === 'OTHER' ? info.message : info.code;
  const params: Record<string, unknown> = {};
  if (info.kind === 'REVISION_CONFLICT') params.revision = info.currentRevision ?? '?';
  if (info.kind === 'SOD_CONFLICT') {
    params.tenant = names.tenant?.(info.tenantId) ?? info.tenantId;
    params.roleA = names.role?.(info.roleA) ?? info.roleA;
    params.roleB = names.role?.(info.roleB) ?? info.roleB;
  }
  return t(`organizationConsole.errors.${key}`, params);
}

export function isRevisionConflict(error: unknown): boolean {
  return organizationErrorInfo(error).kind === 'REVISION_CONFLICT';
}
