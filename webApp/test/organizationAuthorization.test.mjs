import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addableRoles, buildRemoveOverride, expectedEntryChange, buildSaveDefaults, buildSaveOverride, buildSetOpen, contextOptions, effectiveRoleIds,
  errorMessageKey, grantableManagementKinds, initialSubSystem, parseOrganizationError, ReasonRequiredError, roleRowActions, roleStatusTags,
} from '../src/api/authorizationModel.ts';
import { acceptRequestContext, getRequestGeneration, assertRequestGeneration, StaleContextError } from '../src/api/requestContext.ts';
import { organizationRequest } from '../src/api/organizationRequests.ts';
import { OrganizationAuthorizationMock } from '../src/mocks/organizationAuthorizationMock.ts';

function call(mock, route, body, method = 'POST') {
  const url = new URL(`https://example.test/api/admin/auth/organization/${route}`);
  if (method === 'GET') for (const [key, value] of Object.entries(body ?? {})) url.searchParams.set(key, value);
  return mock.dispatch(url, { method, headers: {}, body: method === 'GET' ? undefined : body });
}
function data(response) { assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body.data; }
const read = (mock, userId) => data(call(mock, 'member/read', { organizationId: 'org-1', userId }));
const tenantOf = (view, tenantId) => view.tenants.find(item => item.tenantId === tenantId);
const applying = (view, tenantId) => tenantOf(view, tenantId).roles.filter(role => role.applies).map(role => role.roleId).sort();
function context(mock, route, body, method = 'POST') {
  return mock.dispatch(new URL(`https://example.test/api/auth/${route}`), { method, headers: {}, body });
}

// region pure model

test('status tags: inherited, removed / added here, and ineffective overrides', () => {
  assert.deepEqual(roleStatusTags({ default: true, override: null, ineffective: false }), ['INHERITED']);
  assert.deepEqual(roleStatusTags({ default: true, override: 'REMOVE', ineffective: false }), ['REMOVED_HERE']);
  assert.deepEqual(roleStatusTags({ default: false, override: 'ADD', ineffective: false }), ['ADDED_HERE']);
  // REMOVE of a non-default role and ADD of a default role change nothing today.
  assert.deepEqual(roleStatusTags({ default: false, override: 'REMOVE', ineffective: true }), ['REMOVED_HERE', 'INEFFECTIVE']);
  assert.deepEqual(roleStatusTags({ default: true, override: 'ADD', ineffective: false }), ['ADDED_HERE', 'INEFFECTIVE']);
  assert.deepEqual(roleStatusTags({ default: false, override: null, ineffective: false }), []);
});

test('row actions and addable roles follow the override and the editable flag', () => {
  assert.deepEqual(roleRowActions({ default: true, override: null }, true), { removeHere: true, restore: false });
  assert.deepEqual(roleRowActions({ default: true, override: 'REMOVE' }, true), { removeHere: false, restore: true });
  assert.deepEqual(roleRowActions({ default: false, override: 'ADD' }, true), { removeHere: false, restore: true });
  assert.deepEqual(roleRowActions({ default: true, override: null }, false), { removeHere: false, restore: false });
  const catalog = [
    { id: 'a', code: 'A', name: 'A', subSystemCode: 'console', active: true },
    { id: 'b', code: 'B', name: 'B', subSystemCode: 'console', active: true },
    { id: 'c', code: 'C', name: 'C', subSystemCode: 'portal', active: true },
    { id: 'd', code: 'D', name: 'D', subSystemCode: 'console', active: false },
  ];
  const tenant = { roles: [{ roleId: 'a', applies: true }, { roleId: 'b', applies: false }] };
  assert.deepEqual(addableRoles(catalog, tenant).map(role => role.id), ['b', 'c']);
  assert.deepEqual(addableRoles(catalog, tenant, ['console']).map(role => role.id), ['b']);
});

test('entry estimate for a single override change', () => {
  const tenant = { open: true, canEnter: true, roles: [{ roleId: 'a', default: true, applies: true }, { roleId: 'b', default: false, applies: false }] };
  assert.equal(expectedEntryChange(tenant, false, 'a', 'REMOVE'), false);
  assert.equal(expectedEntryChange(tenant, true, 'a', 'REMOVE'), null);
  assert.equal(expectedEntryChange({ ...tenant, open: false }, false, 'a', 'REMOVE'), null);
  const locked = { open: true, canEnter: false, roles: [{ roleId: 'a', default: true, applies: false }] };
  assert.equal(expectedEntryChange(locked, false, 'a', 'RESTORE'), true);
  assert.equal(expectedEntryChange(locked, false, 'b', 'ADD'), true);
});

test('requests carry the read revision and require a reason', () => {
  const view = { organizationId: 'org-1', userId: 'u', revision: 7 };
  assert.deepEqual(buildSaveDefaults(view, ['a', 'a', 'b'], ' why '), { organizationId: 'org-1', userId: 'u', roleIds: ['a', 'b'], expectedRevision: 7, reason: 'why' });
  assert.equal(buildSaveOverride(view, 't', 'r', 'REMOVE', 'x').action, 'REMOVE');
  assert.equal('action' in buildRemoveOverride(view, 't', 'r', 'x'), false);
  assert.equal(buildSetOpen('t', true, 3, 'go').expectedRevision, 3);
  assert.throws(() => buildSaveOverride(view, 't', 'r', 'ADD', '  '), ReasonRequiredError);
});

test('effective role formula and caller capabilities', () => {
  assert.deepEqual(effectiveRoleIds(['x', 'y'], ['x', 'z'], ['w', 'y']), ['y', 'w']);
  assert.deepEqual(grantableManagementKinds('ORGANIZATION_ADMIN'), ['ORGANIZATION_PERMISSION_ADMIN', 'TENANT_PERMISSION_ADMIN']);
  assert.deepEqual(grantableManagementKinds('ORGANIZATION_PERMISSION_ADMIN'), ['TENANT_PERMISSION_ADMIN']);
  assert.deepEqual(grantableManagementKinds('TENANT_PERMISSION_ADMIN'), []);
});

test('errors are classified from bare bodies, wrapped bodies and messages', () => {
  const conflict = parseOrganizationError(409, { code: 'AUTHZ_REVISION_CONFLICT', currentRevision: 9 });
  assert.equal(conflict.kind, 'REVISION_CONFLICT'); assert.equal(conflict.currentRevision, 9);
  const wrapped = parseOrganizationError(409, { success: true, code: 200, data: { code: 'AUTHZ_REVISION_CONFLICT', currentRevision: 4 } });
  assert.equal(wrapped.currentRevision, 4);
  const forbidden = parseOrganizationError(403, { code: 'ORGANIZATION_LAST_ADMIN', message: 'ORGANIZATION_LAST_ADMIN' });
  assert.equal(forbidden.kind, 'FORBIDDEN'); assert.equal(errorMessageKey(forbidden), 'ORGANIZATION_LAST_ADMIN');
  const sod = parseOrganizationError(400, { success: false, code: 400, message: 'AUTHZ_SOD_CONFLICT:tenant-a:user-admin:notify-send' });
  assert.deepEqual([sod.kind, sod.tenantId, sod.roleA, sod.roleB], ['SOD_CONFLICT', 'tenant-a', 'user-admin', 'notify-send']);
  assert.equal(parseOrganizationError(500, 'boom').kind, 'OTHER');
});

test('context options list tenant × system plus the organization scope', () => {
  const tenants = [{ tenantId: 'a', name: 'A', organizationId: 'o', subSystemCodes: ['console', 'portal'] }];
  assert.deepEqual(contextOptions(tenants, true).map(item => item.key), ['ORGANIZATION', 'a/console', 'a/portal']);
  assert.deepEqual(contextOptions(tenants, false).map(item => item.key), ['a/console', 'a/portal']);
  assert.equal(initialSubSystem(['portal', 'console']), 'console');
  assert.equal(initialSubSystem(['portal']), 'portal');
  assert.equal(initialSubSystem(['portal', 'x']), null);
});

// endregion

// region generic transport

test('late responses from a previous session target are rejected', () => {
  acceptRequestContext({ organizationId: 'org-1', scope: 'TENANT', tenantId: 'tenant-a', subSystemCode: 'console', contextVersion: 'first' });
  const generation = getRequestGeneration();
  acceptRequestContext({ organizationId: 'org-1', scope: 'ORGANIZATION', tenantId: null, subSystemCode: null, contextVersion: 'second' });
  assert.throws(() => assertRequestGeneration(generation), StaleContextError);
  assert.doesNotThrow(() => assertRequestGeneration(getRequestGeneration()));
  acceptRequestContext(null);
});

test('legacy tree requests use the actual organization API and preserve department identity', () => {
  assert.deepEqual(organizationRequest('user/organization/loadTree', { tenantId: 'tenant-1', subSystemCode: 'console' }, 'org-1'), { url: 'user/org/getOrgTree', params: { organizationId: 'org-1' } });
  const request = organizationRequest('user/account/pagingSearch', { orgId: 'department-2' }, 'org-1');
  assert.deepEqual(request.params, { organizationId: 'org-1', orgId: 'department-2' });
  assert.equal(organizationRequest('user/org/save', { nodeKind: 'ORGANIZATION', organizationId: null }, 'org-1').params.organizationId, null);
  assert.equal(organizationRequest('auth/role/getEffectivePermissions', { tenantId: 'tenant-2' }, 'org-1').params.tenantId, 'tenant-2');
});

// endregion

// region stateful mock

test('K-1: wang has both roles in A and C, only report-view in B', () => {
  const mock = new OrganizationAuthorizationMock();
  const wang = read(mock, 'user-wang');
  assert.deepEqual(applying(wang, 'tenant-a'), ['report-view', 'user-admin']);
  assert.deepEqual(applying(wang, 'tenant-c'), ['report-view', 'user-admin']);
  assert.deepEqual(applying(wang, 'tenant-b'), ['report-view']);
  const removed = tenantOf(wang, 'tenant-b').roles.find(role => role.roleId === 'user-admin');
  assert.deepEqual(roleStatusTags(removed), ['REMOVED_HERE']);
  assert.equal(tenantOf(wang, 'tenant-d').canEnter, false);
  assert.equal(tenantOf(wang, 'tenant-d').entryDenial, 'TENANT_NOT_OPEN');
  // lin's group-relayed default is a default too.
  const lin = read(mock, 'user-lin');
  assert.deepEqual(lin.directDefaultRoleIds, ['report-view']);
  assert.deepEqual(lin.defaultRoleIds.sort(), ['notify-send', 'report-view']);
});

test('K-3: a new default follows into B, and the REMOVE in B survives removing and re-adding the default', () => {
  const mock = new OrganizationAuthorizationMock();
  let wang = read(mock, 'user-wang');
  data(call(mock, 'member/saveDefaults', buildSaveDefaults(wang, ['user-admin', 'report-view', 'notify-send'].filter(id => id !== 'user-admin'), 'drop user-admin')));
  wang = read(mock, 'user-wang');
  // The REMOVE no longer changes anything: shown as ineffective, not deleted.
  const ineffective = tenantOf(wang, 'tenant-b').roles.find(role => role.roleId === 'user-admin');
  assert.deepEqual(roleStatusTags(ineffective), ['REMOVED_HERE', 'INEFFECTIVE']);
  assert.deepEqual(applying(wang, 'tenant-b'), ['notify-send', 'report-view']);
  data(call(mock, 'member/saveDefaults', buildSaveDefaults(wang, ['user-admin', 'report-view'], 'restore user-admin')));
  wang = read(mock, 'user-wang');
  assert.deepEqual(applying(wang, 'tenant-a'), ['report-view', 'user-admin']);
  assert.deepEqual(applying(wang, 'tenant-b'), ['report-view']);
  assert.equal(tenantOf(wang, 'tenant-b').roles.find(role => role.roleId === 'user-admin').ineffective, false);
});

test('ADD and restore inheritance in one tenant; SoD conflicts are refused', () => {
  const mock = new OrganizationAuthorizationMock();
  let wang = read(mock, 'user-wang');
  // notify-send + user-admin conflict in A (both effective there).
  const sod = call(mock, 'member/saveOverride', buildSaveOverride(wang, 'tenant-a', 'notify-send', 'ADD', 'try'));
  assert.equal(sod.status, 400);
  assert.equal(parseOrganizationError(sod.status, sod.body).kind, 'SOD_CONFLICT');
  // B has user-admin removed, so the same ADD is allowed there.
  data(call(mock, 'member/saveOverride', buildSaveOverride(wang, 'tenant-b', 'notify-send', 'ADD', 'campaign')));
  wang = read(mock, 'user-wang');
  assert.deepEqual(applying(wang, 'tenant-b'), ['notify-send', 'report-view']);
  assert.deepEqual(roleStatusTags(tenantOf(wang, 'tenant-b').roles.find(role => role.roleId === 'notify-send')), ['ADDED_HERE']);
  // Restoring user-admin in B would now put both roles of the SoD pair into B.
  assert.equal(parseOrganizationError(400, call(mock, 'member/removeOverride', buildRemoveOverride(wang, 'tenant-b', 'user-admin', 'restore')).body).kind, 'SOD_CONFLICT');
  data(call(mock, 'member/removeOverride', buildRemoveOverride(wang, 'tenant-b', 'notify-send', 'campaign over')));
  data(call(mock, 'member/removeOverride', buildRemoveOverride(read(mock, 'user-wang'), 'tenant-b', 'user-admin', 'restore')));
  wang = read(mock, 'user-wang');
  assert.deepEqual(applying(wang, 'tenant-b'), ['report-view', 'user-admin']);
  assert.deepEqual(tenantOf(wang, 'tenant-b').roles.map(role => role.override), [null, null]);
  const preview = data(call(mock, 'member/previewDefaults', { organizationId: 'org-1', userId: 'user-wang', roleIds: ['user-admin', 'report-view', 'notify-send'] }));
  assert.ok(preview.sodConflicts.some(item => item.startsWith('AUTHZ_SOD_CONFLICT:tenant-a:')));
});

test('a stale revision is refused with 409 and leaves the state unchanged', () => {
  const mock = new OrganizationAuthorizationMock();
  const stale = read(mock, 'user-wang');
  data(call(mock, 'member/saveOverride', buildSaveOverride(read(mock, 'user-lin'), 'tenant-c', 'user-admin', 'ADD', 'first')));
  const before = JSON.stringify(read(mock, 'user-wang').tenants);
  const response = call(mock, 'member/saveDefaults', buildSaveDefaults(stale, ['report-view'], 'late'));
  assert.equal(response.status, 409);
  const info = parseOrganizationError(response.status, response.body);
  assert.equal(info.kind, 'REVISION_CONFLICT');
  assert.equal(info.currentRevision, stale.revision + 1);
  assert.equal(JSON.stringify(read(mock, 'user-wang').tenants), before);
});

test('managers cannot change their own authorization, nor outrank checks', () => {
  const mock = new OrganizationAuthorizationMock();
  const zhang = read(mock, 'user-zhang');
  assert.equal(zhang.defaultsEditable, false);
  assert.ok(zhang.tenants.every(tenant => !tenant.editable));
  const self = call(mock, 'member/saveDefaults', buildSaveDefaults(zhang, ['report-view'], 'me'));
  assert.equal(self.status, 403);
  assert.equal(self.body.code, 'ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION');
  assert.equal(call(mock, 'admin/revoke', { organizationId: 'org-1', userId: 'user-zhang' }).body.code, 'ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION');
  // Tenant permission admin of B: only B is editable, defaults are not, the org admin outranks.
  mock.callerId = 'user-chen';
  const wang = read(mock, 'user-wang');
  assert.equal(wang.defaultsEditable, false);
  assert.deepEqual(wang.tenants.filter(tenant => tenant.editable).map(tenant => tenant.tenantId), ['tenant-b']);
  assert.equal(call(mock, 'member/saveOverride', buildSaveOverride(wang, 'tenant-a', 'report-view', 'REMOVE', 'x')).body.code, 'ORGANIZATION_MANAGEMENT_FORBIDDEN');
  assert.equal(call(mock, 'member/saveOverride', buildSaveOverride(read(mock, 'user-zhang'), 'tenant-b', 'report-view', 'ADD', 'x')).body.code, 'ORGANIZATION_TARGET_OUTRANKS_ACTOR');
});

test('K-4: D starts closed; preview then open grants entry by defaults; closing keeps overrides', () => {
  const mock = new OrganizationAuthorizationMock();
  const overview = data(call(mock, 'overview', { organizationId: 'org-1' }, 'GET'));
  assert.equal(overview.callerRank, 'ORGANIZATION_ADMIN');
  assert.equal(overview.tenants.find(item => item.tenantId === 'tenant-d').open, false);
  // A preset override on the closed tenant.
  data(call(mock, 'member/saveOverride', buildSaveOverride(read(mock, 'user-wang'), 'tenant-d', 'user-admin', 'REMOVE', 'preset')));
  const preview = data(call(mock, 'tenant/preview', { tenantId: 'tenant-d', open: true }));
  assert.deepEqual(preview.affectedMembers.map(item => item.username).sort(), ['lin', 'wang', 'zhang']);
  assert.deepEqual(preview.affectedMembers.find(item => item.username === 'wang').roleIds, ['report-view']);
  assert.deepEqual(preview.excludedMembers.map(item => item.username).sort(), ['chen', 'li']);
  assert.equal(preview.membersPerRole['report-view'], 2);
  assert.equal(tenantOf(read(mock, 'user-wang'), 'tenant-d').canEnter, false);
  data(call(mock, 'tenant/setOpen', buildSetOpen('tenant-d', true, preview.revision, 'go live')));
  assert.equal(tenantOf(read(mock, 'user-wang'), 'tenant-d').canEnter, true);
  assert.equal(call(mock, 'tenant/setOpen', buildSetOpen('tenant-d', false, preview.revision, 'stale')).status, 409);
  data(call(mock, 'tenant/setOpen', buildSetOpen('tenant-d', false, mock.revision, 'pause')));
  const wang = read(mock, 'user-wang');
  assert.equal(tenantOf(wang, 'tenant-d').canEnter, false);
  assert.equal(tenantOf(wang, 'tenant-d').roles.find(role => role.roleId === 'user-admin').override, 'REMOVE');
  // Dissociation (platform) clears the tenant's overrides and governance.
  data(call(mock, 'tenant/dissociate', { tenantId: 'tenant-d' }));
  assert.equal(tenantOf(read(mock, 'user-wang'), 'tenant-d'), undefined);
  assert.equal(mock.overrides.has('tenant-d|user-wang|user-admin'), false);
});

test('K-5: removing every role in C loses entry; the defaults preview announces regaining it', () => {
  const mock = new OrganizationAuthorizationMock();
  for (const roleId of ['user-admin', 'report-view']) data(call(mock, 'member/saveOverride', buildSaveOverride(read(mock, 'user-wang'), 'tenant-c', roleId, 'REMOVE', 'off')));
  assert.equal(tenantOf(read(mock, 'user-wang'), 'tenant-c').canEnter, false);
  assert.equal(tenantOf(read(mock, 'user-wang'), 'tenant-c').entryDenial, 'NO_EFFECTIVE_ROLE');
  const unchanged = data(call(mock, 'member/previewDefaults', { organizationId: 'org-1', userId: 'user-wang', roleIds: ['user-admin', 'report-view'] }));
  assert.deepEqual([unchanged.entryChanges, unchanged.addedRoleIds, unchanged.removedRoleIds], [[], [], []]);
  // Removing report-view from defaults makes wang lose B (only report-view there).
  const losing = data(call(mock, 'member/previewDefaults', { organizationId: 'org-1', userId: 'user-wang', roleIds: ['user-admin'] }));
  assert.deepEqual(losing.entryChanges, [{ tenantId: 'tenant-b', tenantName: '组织甲 · B 站', regains: false }]);
  assert.deepEqual(losing.removedRoleIds, ['report-view']);
  assert.deepEqual(losing.tenantRoleChanges['tenant-b'], ['-report-view']);
  // A new console default re-admits wang to C.
  mock.roles.push({ id: 'audit-view', code: 'AUDIT_VIEW', name: '审计查看', subSystemCode: 'console', active: true });
  const regaining = data(call(mock, 'member/previewDefaults', { organizationId: 'org-1', userId: 'user-wang', roleIds: ['user-admin', 'report-view', 'audit-view'] }));
  assert.deepEqual(regaining.entryChanges, [{ tenantId: 'tenant-c', tenantName: '组织甲 · C 站', regains: true }]);
  assert.deepEqual(regaining.addedRoleIds, ['audit-view']);
});

test('K-7: management-only members enter no tenant and switch to the organization scope', () => {
  const mock = new OrganizationAuthorizationMock();
  mock.callerId = 'user-li';
  mock.current = { ...mock.current, contextVersion: 'v-li' };
  const contexts = data(context(mock, 'contexts', undefined, 'GET'));
  assert.deepEqual(contexts.tenants, []);
  assert.equal(contexts.organizationScope, true);
  const switched = data(context(mock, 'context/switch', { tenantId: null, subSystemCode: null, contextVersion: 'v-li' }));
  assert.equal(switched.status, 'SWITCHED');
  assert.deepEqual([switched.current.scope, switched.current.tenantId], ['ORGANIZATION', null]);
  assert.notEqual(switched.current.contextVersion, 'v-li');
  // The old version is rejected afterwards; tenants without entry are refused.
  assert.equal(context(mock, 'context/switch', { tenantId: null, contextVersion: 'v-li' }).body.code, 'AUTHENTICATION_CONTEXT_CHANGED');
  const denied = context(mock, 'context/switch', { tenantId: 'tenant-a', subSystemCode: 'console', contextVersion: switched.current.contextVersion });
  assert.equal(denied.status, 409);
  assert.match(denied.body.code, /^AUTHENTICATION_TENANT_UNAVAILABLE/);
  // A plain member has no organization scope.
  mock.callerId = 'user-wang';
  const member = data(context(mock, 'contexts', undefined, 'GET'));
  assert.equal(member.organizationScope, false);
  assert.deepEqual(member.tenants.map(item => `${item.tenantId}:${item.subSystemCodes.join(',')}`), ['tenant-a:console', 'tenant-b:console', 'tenant-c:console']);
  assert.equal(context(mock, 'context/switch', { tenantId: null, contextVersion: mock.current.contextVersion }).body.code, 'AUTHENTICATION_ORGANIZATION_SCOPE_UNAVAILABLE');
});

test('organization admins and management roles: grant by rank, last admin protected', () => {
  const mock = new OrganizationAuthorizationMock();
  data(call(mock, 'managementRole/grant', { organizationId: 'org-1', userId: 'user-lin', roleKind: 'TENANT_PERMISSION_ADMIN', tenantIds: ['tenant-a', 'tenant-c'] }));
  const rows = data(call(mock, 'managementRole/list', { organizationId: 'org-1' }));
  assert.deepEqual(rows.filter(item => item.userId === 'user-lin').map(item => item.tenantId), ['tenant-a', 'tenant-c']);
  assert.deepEqual(read(mock, 'user-lin').managementRoles, ['TENANT_PERMISSION_ADMIN:tenant-a', 'TENANT_PERMISSION_ADMIN:tenant-c']);
  // The organization permission admin grants only tenant permission admins and designates no admins.
  mock.callerId = 'user-li';
  assert.equal(call(mock, 'managementRole/grant', { organizationId: 'org-1', userId: 'user-wang', roleKind: 'ORGANIZATION_PERMISSION_ADMIN', tenantIds: [] }).body.code, 'ORGANIZATION_MANAGEMENT_FORBIDDEN');
  data(call(mock, 'managementRole/grant', { organizationId: 'org-1', userId: 'user-wang', roleKind: 'TENANT_PERMISSION_ADMIN', tenantIds: ['tenant-b'] }));
  assert.equal(call(mock, 'admin/assign', { organizationId: 'org-1', userId: 'user-wang' }).body.code, 'ORGANIZATION_MANAGEMENT_FORBIDDEN');
  // Admins designate each other, never themselves.
  mock.callerId = 'user-zhang';
  data(call(mock, 'admin/assign', { organizationId: 'org-1', userId: 'user-wang' }));
  mock.callerId = 'user-wang';
  assert.equal(call(mock, 'admin/revoke', { organizationId: 'org-1', userId: 'user-wang' }).body.code, 'ORGANIZATION_CANNOT_CHANGE_OWN_AUTHORIZATION');
  data(call(mock, 'admin/revoke', { organizationId: 'org-1', userId: 'user-zhang' }));
  assert.deepEqual(data(call(mock, 'admin/list', { organizationId: 'org-1' })).map(item => item.username), ['wang']);
  // The platform cannot revoke the last one either.
  mock.callerId = 'platform';
  assert.equal(call(mock, 'admin/revoke', { organizationId: 'org-1', userId: 'user-wang' }).body.code, 'ORGANIZATION_LAST_ADMIN');
});

test('platform association starts closed and other organizations are refused', () => {
  const mock = new OrganizationAuthorizationMock();
  data(call(mock, 'tenant/associate', { tenantId: 'tenant-1', organizationId: 'org-1', reason: 'onboard' }));
  assert.equal(mock.decorateTenantRow({ id: 'tenant-1' }).organizationOpen, false);
  assert.equal(mock.decorateTenantRow({ id: 'tenant-1' }).organizationId, 'org-1');
  assert.equal(call(mock, 'tenant/associate', { tenantId: 'tenant-1', organizationId: 'org-1' }).status, 403);
  assert.equal(call(mock, 'member/read', { organizationId: 'org-other', userId: 'user-wang' }).status, 403);
  mock.platformOperator = false;
  assert.equal(call(mock, 'tenant/dissociate', { tenantId: 'tenant-1' }).status, 403);
});

// endregion
