export type MockRequest = {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
};

export type MockResponse = {
  status: number;
  body: unknown;
};

type Row = Record<string, unknown>;

const NOW = '2026-08-07 10:00:00';

function row(id: string, code: string, name: string, extra: Row = {}): Row {
  return {
    id,
    code,
    name,
    active: true,
    builtIn: false,
    remark: `${name}（离线演示数据）`,
    createTime: NOW,
    updateTime: NOW,
    createUser: 'admin',
    updateUser: 'admin',
    ...extra,
  };
}

const INITIAL_TABLES: Record<string, Row[]> = {
  'sys/cache': [
    row('cache-1', 'user-profile', '用户资料缓存', { atomicServiceCode: 'user', strategyDictCode: 'LOCAL', ttl: 1800, writeOnBoot: true, writeInTime: true }),
    row('cache-2', 'role-permission', '角色权限缓存', { atomicServiceCode: 'auth', strategyDictCode: 'REDIS', ttl: 600, writeOnBoot: true, writeInTime: false }),
  ],
  'sys/dict': [
    row('dict-1', 'account_status', '账号状态', { dictType: 'account_status', dictName: '账号状态', module: 'user', atomicServiceCode: 'user' }),
    row('dict-2', 'resource_type', '资源类型', { dictType: 'resource_type', dictName: '资源类型', module: 'sys', atomicServiceCode: 'sys' }),
  ],
  'sys/dictItem': [
    row('dict-item-1', 'ACTIVE', '启用', { dictId: 'dict-1', itemCode: 'ACTIVE', itemName: '启用', seqNo: 1 }),
    row('dict-item-2', 'DISABLED', '停用', { dictId: 'dict-1', itemCode: 'DISABLED', itemName: '停用', seqNo: 2 }),
  ],
  'sys/param': [
    row('param-1', 'password.maxAttempts', '登录失败上限', { paramName: 'password.maxAttempts', paramValue: '5', defaultValue: '5', module: 'auth', atomicServiceCode: 'auth', seqNo: 1 }),
    row('param-2', 'session.timeoutMinutes', '会话超时分钟', { paramName: 'session.timeoutMinutes', paramValue: '30', defaultValue: '30', module: 'auth', atomicServiceCode: 'auth', seqNo: 2 }),
  ],
  'sys/domain': [
    row('domain-1', 'admin.localhost', '管理端域名', { domain: 'admin.localhost', subSystemCode: 'console', tenantId: 'tenant-1', tenantName: '示例租户' }),
    row('domain-2', 'portal.localhost', '门户域名', { domain: 'portal.localhost', subSystemCode: 'portal', tenantId: 'tenant-2', tenantName: '华东租户' }),
  ],
  'sys/tenant': [
    row('tenant-1', 'demo', '示例租户', { subSystemCode: 'console', timezone: 'Asia/Taipei', defaultLocale: 'zh-CN' }),
    row('tenant-2', 'east', '华东租户', { subSystemCode: 'portal', timezone: 'Asia/Shanghai', defaultLocale: 'zh-CN' }),
  ],
  'sys/system': [
    row('system-1', 'console', '管理控制台', { subSystem: true, context: '/console' }),
    row('system-2', 'portal', '业务门户', { subSystem: true, context: '/portal' }),
  ],
  'sys/microService': [
    row('micro-1', 'sys', '系统服务', { atomicService: true, context: '/sys' }),
    row('micro-2', 'auth', '权限服务', { atomicService: true, context: '/auth' }),
    row('micro-3', 'msg', '消息服务', { atomicService: true, context: '/msg' }),
  ],
  'sys/dataSource': [
    row('ds-1', 'primary', '主数据源', { subSystemCode: 'console', tenantId: 'tenant-1', url: 'jdbc:h2:mem:kudos', username: 'kudos', driverClassName: 'org.h2.Driver' }),
    row('ds-2', 'reporting', '报表数据源', { subSystemCode: 'portal', tenantId: 'tenant-2', url: 'jdbc:h2:mem:report', username: 'report', driverClassName: 'org.h2.Driver' }),
  ],
  'sys/resource': [
    row('resource-1', 'sys:tenant:list', '租户查询', { title: '租户查询', resourceTypeDictCode: 'API', subSystemCode: 'console', microServiceCode: 'sys', path: '/sys/tenant', url: '/api/admin/sys/tenant/pagingSearch', seqNo: 1 }),
    row('resource-2', 'auth:role:edit', '角色维护', { title: '角色维护', resourceTypeDictCode: 'MENU', subSystemCode: 'console', microServiceCode: 'auth', path: '/auth/role', url: '/auth/role', seqNo: 2 }),
  ],
  'sys/i18n': [
    row('i18n-1', 'common.save', '保存', { key: 'common.save', value: '保存', locale: 'zh-CN', i18nTypeDictCode: 'UI', namespace: 'common', atomicServiceCode: 'console' }),
    row('i18n-2', 'common.cancel', '取消', { key: 'common.cancel', value: '取消', locale: 'zh-CN', i18nTypeDictCode: 'UI', namespace: 'common', atomicServiceCode: 'console' }),
  ],
  'user/account': [
    row('account-1', 'admin', '系统管理员', { username: 'admin', realName: '系统管理员', nickname: '管理员', email: 'admin@example.com', mobile: '13800000001', statusDictCode: 'ACTIVE', userTypeDictCode: 'INTERNAL', orgName: '平台研发部' }),
    row('account-2', 'auditor', '安全审计员', { username: 'auditor', realName: '安全审计员', nickname: '审计员', email: 'audit@example.com', mobile: '13800000002', statusDictCode: 'ACTIVE', userTypeDictCode: 'INTERNAL', orgName: '安全合规部' }),
  ],
  'user/organization': [
    row('org-1', 'ROOT', 'Kudos 集团', { shortName: '集团', typeDictCode: 'COMPANY', parentId: null, seqNo: 1 }),
    row('org-2', 'RND', '平台研发部', { shortName: '研发部', typeDictCode: 'DEPARTMENT', parentId: 'org-1', seqNo: 1 }),
    row('org-3', 'SEC', '安全合规部', { shortName: '安全部', typeDictCode: 'DEPARTMENT', parentId: 'org-1', seqNo: 2 }),
  ],
  'auth/role': [
    row('role-1', 'SUPER_ADMIN', '超级管理员', { roleCode: 'SUPER_ADMIN', roleName: '超级管理员', subSystemCode: 'console', dataScopeTypeDictCode: 'ALL' }),
    row('role-2', 'SECURITY_AUDITOR', '安全审计员', { roleCode: 'SECURITY_AUDITOR', roleName: '安全审计员', subSystemCode: 'console', dataScopeTypeDictCode: 'CUSTOM' }),
  ],
  'auth/group': [
    row('group-1', 'PLATFORM_ADMINS', '平台管理员组', { groupCode: 'PLATFORM_ADMINS', groupName: '平台管理员组', subSystemCode: 'console' }),
    row('group-2', 'AUDITORS', '审计员组', { groupCode: 'AUDITORS', groupName: '审计员组', subSystemCode: 'console' }),
  ],
  'auth/roleExclusion': [
    row('exclusion-1', 'ADMIN_AUDITOR', '管理与审计互斥', { roleAId: 'role-1', roleAName: '超级管理员', roleBId: 'role-2', roleBName: '安全审计员', statusDictCode: 'ENABLED' }),
  ],
  'auth/roleGrantRequest': [
    row('grant-1', 'GRANT-20260807-001', '临时审计权限申请', { roleId: 'role-2', roleName: '安全审计员', userId: 'account-2', userName: 'auditor', requesterId: 'account-1', requesterName: 'admin', status: 'PENDING', reason: '季度安全审计', startTime: NOW, endTime: '2026-08-14 18:00:00' }),
  ],
  'msg/template': [
    row('template-1', 'LOGIN_WARNING', '异常登录提醒', { templateCode: 'LOGIN_WARNING', templateName: '异常登录提醒', channelDictCode: 'EMAIL', subject: '异常登录提醒', content: '检测到异常登录，请及时确认。' }),
    row('template-2', 'GRANT_APPROVED', '授权审批通过', { templateCode: 'GRANT_APPROVED', templateName: '授权审批通过', channelDictCode: 'IN_APP', subject: '授权已通过', content: '您的授权申请已审批通过。' }),
  ],
  'msg/instance': [
    row('instance-1', 'MSG-001', '异常登录提醒实例', { templateId: 'template-1', subject: '异常登录提醒', content: '检测到账号 admin 在新设备登录。', statusDictCode: 'SENT' }),
  ],
  'msg/send': [
    row('send-1', 'BATCH-001', '安全通知批次', { instanceId: 'instance-1', totalCount: 2, successCount: 1, failureCount: 1, statusDictCode: 'PARTIAL_SUCCESS' }),
  ],
  'msg/receive': [
    row('receive-1', 'RECEIVE-001', '管理员接收记录', { sendId: 'send-1', receiverId: 'account-1', receiverName: 'admin', channelDictCode: 'EMAIL', statusDictCode: 'SUCCESS' }),
  ],
  'msg/unreceived': [
    row('unreceived-1', 'FAILED-001', '审计员发送失败', { sendId: 'send-1', receiverId: 'account-2', receiverName: 'auditor', channelDictCode: 'EMAIL', statusDictCode: 'FAILED', failureReason: '模拟网络超时', retryCount: 1 }),
  ],
  'msg/receiverGroup': [
    row('receiver-group-1', 'SECURITY_TEAM', '安全团队', { groupCode: 'SECURITY_TEAM', groupName: '安全团队', memberCount: 2 }),
  ],
};

/**
 * Stateful in-memory backend used by the browser-only demo. It models the common
 * paging, detail, CRUD, tree, approval and permission-assignment contracts.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class MockDatabase {
  private readonly tables = new Map<string, Row[]>();
  private readonly instanceShares: Row[] = [
    { id: 'share-1', principalId: 'account-1', principalName: 'admin', tenantId: 'tenant-1', resourceType: 'TENANT', instanceId: 'tenant-1', action: 'tenant:read', effect: 'ALLOW', grantedBy: 'admin', startTime: NOW, endTime: null },
  ];
  private sequence = 100;

  constructor() {
    Object.entries(INITIAL_TABLES).forEach(([key, value]) => {
      this.tables.set(key, value.map((item) => ({ ...item })));
    });
  }

  dispatch(url: URL, request: MockRequest): MockResponse | null {
    const route = normalizeRoute(url.pathname);
    const special = this.dispatchSpecial(route, url, request);
    if (special) return special;

    const root = [...this.tables.keys()]
      .sort((a, b) => b.length - a.length)
      .find((candidate) => route === candidate || route.startsWith(`${candidate}/`));
    if (!root) return null;

    const operation = route.slice(root.length).replace(/^\//, '') || 'pagingSearch';
    const rows = this.tables.get(root) ?? [];
    const params = { ...Object.fromEntries(url.searchParams), ...asRecord(request.body) };

    if (/^(pagingSearch|search|pagingSearchDict|pagingSearchDictItem)$/i.test(operation)) {
      const filtered = filterRows(rows, params);
      return ok(page(filtered, params));
    }
    if (/^(searchTree|loadTree|lazyLoadTree|loadTreeNodes|loadDirectChildrenForTree)$/i.test(operation)) {
      return ok(buildTree(filterRows(rows, params)));
    }
    if (/^(get|getDetail|getEdit|detail|findById)$/i.test(operation)) {
      return ok(findRow(rows, params) ?? rows[0] ?? {});
    }
    if (/^(save|saveOrUpdate|update|create)$/i.test(operation)) {
      const values = asRecord(request.body);
      const id = String(values.id ?? `${root.replace('/', '-')}-${++this.sequence}`);
      const existing = rows.findIndex((item) => String(item.id) === id);
      const next = { ...(existing >= 0 ? rows[existing] : row(id, String(values.code ?? id), String(values.name ?? values.title ?? '新增演示数据'))), ...values, id, updateTime: NOW };
      if (existing >= 0) rows.splice(existing, 1, next);
      else rows.unshift(next);
      return ok(id);
    }
    if (/^(delete|batchDelete|remove)$/i.test(operation)) {
      const ids = collectIds(request.body, params);
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (ids.has(String(rows[index].id))) rows.splice(index, 1);
      }
      return ok(true);
    }
    if (/^(updateActive|enable|disable)$/i.test(operation)) {
      const target = findRow(rows, params);
      if (target) target.active = operation === 'enable' ? true : operation === 'disable' ? false : Boolean(params.active);
      return ok(true);
    }
    if (/^(approve|reject|cancel|submit)$/i.test(operation)) {
      const target = findRow(rows, params);
      if (target) {
        target.status = ({ approve: 'APPROVED', reject: 'REJECTED', cancel: 'CANCELLED', submit: 'PENDING' } as Record<string, string>)[operation] ?? operation.toUpperCase();
        target.decisionComment = params.comment ?? params.decisionComment ?? null;
        target.decisionTime = NOW;
        target.approverId = 'account-1';
      }
      return ok(true);
    }
    return ok(true);
  }

  private dispatchSpecial(route: string, url: URL, request: MockRequest): MockResponse | null {
    if (route === 'sys/microService/getAllActiveAtomicServiceCodes') return ok(['sys', 'user', 'auth', 'msg', 'console']);
    if (route === 'sys/microService/getAllActiveMicroServiceCodes') return ok(['sys', 'user', 'auth', 'msg']);
    if (route === 'sys/system/getAllActiveSubSystemCodes' || route === 'sys/system/getAllActiveSystemCodes') return ok(['console', 'portal']);
    if (route === 'sys/tenant/getAllActiveTenants' || route === 'sys/tenant/getTenantsBySubSystemCode') {
      return ok((this.tables.get('sys/tenant') ?? []).map(({ id, code, name, subSystemCode }) => ({ id, code, name, subSystemCode })));
    }
    if (route === 'sys/dictItem/batchGetDictItemMap') return ok(batchDictionaryMap(asRecord(request.body)));
    if (route === 'sys/dictItem/getDictItemMap') return ok(dictionaryValues(String(url.searchParams.get('dictType') ?? 'status')));
    if (/^sys\/dict(Item)?\/(getDictTypesByAtomicServiceCode|loadDictTypes|getDirectChildrenOfDict|getDirectChildrenOfItem|getDictItemsByDictId)$/.test(route)) {
      return ok(this.tables.get(route.startsWith('sys/dictItem') ? 'sys/dictItem' : 'sys/dict') ?? []);
    }
    if (route === 'sys/i18n/batchGetI18ns') return ok({});
    if (route === 'sys/dataSource/test' || route.endsWith('/datasourceTest')) return ok({ success: true, message: '离线数据源连接成功' });
    if (route === 'sys/dataSource/encrypt') return ok(`MOCK_ENCRYPTED_${String(asRecord(request.body).password ?? '')}`);
    if (route === 'auth/roleExclusion/findViolations') return ok([]);
    if (/^auth\/(role|group)\/list(UserIds|RoleIds|ResourceIds|GroupIds)/.test(route)) return ok(route.includes('UserIds') ? ['account-1'] : ['role-1']);
    if (route === 'auth/resourcepermission/roleNamesByResourceIds') {
      const ids = Array.isArray(request.body) ? request.body.map(String) : [];
      return ok(Object.fromEntries(ids.map((id) => [id, id === 'resource-1' ? ['超级管理员'] : ['安全审计员']])));
    }
    if (/^auth\/(role|group)\/(listPermissionBindings|getEffectivePermissions|listTemporalGrants|listDataScopes)/.test(route)) {
      return ok([{ id: 'binding-1', principalId: 'role-1', resourceId: 'resource-1', effect: 'ALLOW', active: true }]);
    }
    if (/^(auth\/authz|auth\/roleDataScope)\/explain/.test(route)) {
      return ok({ allowed: true, decision: 'ALLOW', reason: '由超级管理员角色直接授权', steps: [{ order: 1, result: 'ALLOW', description: '命中角色资源授权' }] });
    }
    if (route.includes('rowScopeFindings')) {
      return request.method.toUpperCase() === 'DELETE'
        ? ok(true)
        : ok([{ id: 'finding-1', severity: 'HIGH', title: '历史行过滤条件待迁移', status: 'OPEN', resourceCode: 'sys:tenant:list' }]);
    }
    if (route === 'auth/instanceGrant/listShares' || route === 'auth/instanceGrant/listSharesOfPrincipal') {
      return ok(this.instanceShares.map((item) => ({ ...item })));
    }
    if (route === 'auth/instanceGrant/share') {
      const values = asRecord(request.body);
      const id = `share-${++this.sequence}`;
      this.instanceShares.unshift({ id, grantedBy: 'admin', startTime: NOW, endTime: null, ...values });
      return ok(id);
    }
    if (route === 'auth/instanceGrant/unshare') {
      const grantId = String(url.searchParams.get('grantId') ?? asRecord(request.body).grantId ?? asRecord(request.body).id ?? '');
      const index = this.instanceShares.findIndex((item) => String(item.id) === grantId);
      if (index >= 0) this.instanceShares.splice(index, 1);
      return ok(true);
    }
    if (route === 'msg/unreceived/listUnresolvedBySend') return ok(this.tables.get('msg/unreceived') ?? []);
    if (/\/(getValidationRule|validationRule)$/.test(route)) return { status: 200, body: {} };
    if (/\/(bind|unbind|grant|revoke|copy|share|unshare|retry|resend|moveOrg|reset|clear|evict|reload|bootstrap|seed|savePermissionBinding|revokeAllTokens)/i.test(route)) return ok(true);
    if (/\/(get|find|list|load|search|current|status|explain)[A-Z]/.test(route)) return ok([]);
    return null;
  }
}

function normalizeRoute(pathname: string): string {
  return pathname.replace(/^\/api\/admin\//, '').replace(/^\/api\//, '').replace(/^\//, '');
}

function ok(data: unknown): MockResponse {
  return { status: 200, body: { success: true, code: 200, data } };
}

function asRecord(value: unknown): Row {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function filterRows(rows: Row[], params: Row): Row[] {
  const ignored = new Set(['pageNo', 'pageSize', 'currentPage', 'sortField', 'sortOrder', 'orderBy', 'ids']);
  return rows.filter((item) => Object.entries(params).every(([key, raw]) => {
    if (ignored.has(key) || raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0) || !(key in item)) return true;
    const actual = item[key];
    if (typeof raw === 'string' && typeof actual === 'string') return actual.toLowerCase().includes(raw.toLowerCase());
    return String(actual) === String(raw);
  }));
}

function page(rows: Row[], params: Row): { data: Row[]; totalCount: number } {
  const pageNo = Math.max(1, Number(params.pageNo ?? params.currentPage ?? 1));
  const pageSize = Math.max(1, Number(params.pageSize ?? 20));
  const start = (pageNo - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), totalCount: rows.length };
}

function findRow(rows: Row[], params: Row): Row | undefined {
  const candidate = params.id ?? params.roleId ?? params.groupId ?? params.accountId ?? params.resourceId ?? params.requestId;
  return candidate == null ? undefined : rows.find((item) => String(item.id) === String(candidate));
}

function collectIds(body: unknown, params: Row): Set<string> {
  const values = Array.isArray(body) ? body : Array.isArray(params.ids) ? params.ids : [params.id];
  return new Set(values.filter((value) => value != null).map((value) => typeof value === 'object' ? String(asRecord(value).id) : String(value)));
}

function buildTree(rows: Row[]): Row[] {
  const copies: Row[] = rows.map((item) => ({ ...item, children: [] as Row[] }));
  const byId = new Map(copies.map((item) => [String(item.id), item]));
  const roots: Row[] = [];
  copies.forEach((item) => {
    const parent = item.parentId == null ? undefined : byId.get(String(item.parentId));
    if (parent) (parent.children as Row[]).push(item);
    else roots.push(item);
  });
  return roots;
}

function batchDictionaryMap(requested: Row): Record<string, Record<string, Record<string, string>>> {
  return Object.fromEntries(Object.entries(requested).map(([atomic, types]) => [
    atomic,
    Object.fromEntries((Array.isArray(types) ? types : []).map((type) => [String(type), dictionaryValues(String(type))])),
  ]));
}

function dictionaryValues(type: string): Record<string, string> {
  const maps: Record<string, Record<string, string>> = {
    account_status: { ACTIVE: '启用', DISABLED: '停用', LOCKED: '锁定' },
    user_status: { ACTIVE: '启用', DISABLED: '停用', LOCKED: '锁定' },
    user_type: { INTERNAL: '内部用户', EXTERNAL: '外部用户' },
    organization_type: { COMPANY: '公司', DEPARTMENT: '部门', TEAM: '团队' },
    resource_type: { API: '接口', MENU: '菜单', BUTTON: '按钮' },
    cache_strategy: { SINGLE_LOCAL: '本地缓存', REMOTE: '远程缓存', LOCAL_REMOTE: '两级缓存' },
    locale: { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English' },
    i18n_type: { UI: '界面文本', 'dict-item': '字典项', 'valid-msg': '校验消息', 'error-msg': '错误消息' },
    status: { PENDING: '待处理', APPROVED: '已通过', REJECTED: '已拒绝', SUCCESS: '成功', FAILED: '失败' },
    channel: { EMAIL: '邮件', IN_APP: '站内信', SMS: '短信' },
    data_scope_type: { ALL: '全部数据', CUSTOM: '自定义', SELF: '本人数据', ORG: '本组织数据' },
    principal_type: { USER: '用户', ROLE: '角色', GROUP: '用户组' },
    effect: { ALLOW: '允许', DENY: '拒绝' },
    access_rule_type: { ALLOW: '允许访问', DENY: '拒绝访问' },
    ip_type: { IPV4: 'IPv4', IPV6: 'IPv6', CIDR: 'CIDR' },
  };
  return maps[type] ?? { ENABLED: '启用', DISABLED: '停用', DEFAULT: '默认' };
}
