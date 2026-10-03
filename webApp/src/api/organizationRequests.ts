/** Explicit adapter for legacy console routes while their forms move to organization ownership. */
export function organizationRequest(url: string, params: unknown, organizationId?: string): { url: string; params: unknown } {
  let route = url.replace(/^user\/organization(?=\/|$)/, 'user/org');
  route = route.replace(/^user\/org\/(loadTree|searchTree|lazyLoadTree)$/, 'user/org/getOrgTree');
  const owned = /^(user\/(org|account)|auth\/(role|group))\//.test(route);
  if (!owned || Array.isArray(params)) return { url: route, params };
  const result = params && typeof params === 'object' ? { ...params } as Record<string,unknown> : {};
  if (organizationId && !result.organizationId && result.nodeKind !== 'ORGANIZATION') result.organizationId = organizationId;
  // Runtime/effective APIs retain an explicit target; definitions are organization-owned.
  if (!/(getEffectivePermissions|explain|Temporal|Delegation)/.test(route)) delete result.tenantId;
  if (/^user\/(org|account)\//.test(route)) { delete result.subSystemCode; delete result.subsysCode; delete result.subSysOrTenant; }
  return { url: route, params: result };
}
