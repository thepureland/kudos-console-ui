# 组织共享账号与租户权限控制台设计

状态：实施中。日期：2026-10-03。

规则以[后端主设计](../../../kudos/docs/superpowers/specs/2026-10-03-organization-tenant-identity-permission-design.md)（决定 G-1～G-19）为准，本文只写控制台怎么呈现与调用。

## 规则摘要

- 覆盖以角色为单位、针对个人：在 tenant t 为成员 **加入** 一个角色（ADD）或 **移除** 一个默认角色（REMOVE）。没有单权限 SET/REMOVE/RESET、没有 tenant 数据范围覆盖、没有成员禁入开关、没有审批流程。
- 有效角色(m, t) =（默认角色(m) − REMOVE(m, t)）∪ ADD(m, t)。默认角色含组织级直接授予与用户组带来的角色。
- 当下不改变结果的覆盖（REMOVE 一个非默认角色、ADD 一个已是默认的角色）标示“目前无作用”，不自动删除。
- 在某 tenant 没有有效角色即不能进入；组织管理员在已开放 tenant 内全权。未开放的 tenant 任何人都不能进入。
- tenant 由平台关联到组织，关联后为未开放；组织管理员或组织权限管理员预览后开放／改回未开放。
- 管理身份：组织管理员（指定）、组织权限管理员、tenant 权限管理员（只管辖指定 tenant）。只有管理身份的成员不进入任何 tenant，在 ORGANIZATION 范围（会话无 tenant）工作。
- 任何管理者都不能改自己的授权；控制台按 `callerRank` 隐藏明显不可用的操作，服务端仍是最终判定。

## 界面

| 位置 | 组件 | 内容 |
|---|---|---|
| Header 范围选择 | [OrganizationContextSelector](../src/components/auth/OrganizationContextSelector.vue) | 列出 tenant × 系统；`organizationScope` 为真时另有“组织管理（组织范围）”，切换时送 `tenantId: null`。下拉末项打开组织管理面板。进入 TENANT 范围而未带系统时自动选 `console`（或唯一系统） |
| 成员授权弹窗 | [OrganizationConfigurationDialog](../src/components/auth/OrganizationConfigurationDialog.vue)，由账号列表行内按钮打开 | 成员、组织管理员与管理角色标签；默认角色多选（`defaultsEditable` 时可改）→ 预览（新增／移除、“将重新取得／将失去 X 的进入资格”、各 tenant 角色变化、SoD 冲突）→ 填原因保存；各 tenant 页签列出角色与状态标签、开放状态、能否进入及原因，行内“在此 tenant 移除”“恢复继承”，以及“加入角色”。`editable` 为假时只读 |
| 组织管理面板 | [OrganizationManagementDrawer](../src/components/auth/OrganizationManagementDrawer.vue) | tenant：开放状态与系统，开放／改回未开放先预览（可进入成员及其角色、不能进入的成员、各角色人数）再填原因执行；组织管理员：列表、指定、撤销；管理角色：列表、授予（tenant 权限管理员须选管辖 tenant）、撤销 |
| 租户列表（平台） | [TenantListPage](../src/pages/sys/tenant/TenantListPage.vue)、[TenantOrganizationDialog](../src/pages/sys/tenant/TenantOrganizationDialog.vue) | 行数据带 `organizationId` 时显示组织与开放状态列，行内“关联组织”“解除关联”（确认后删除该 tenant 的覆盖与管辖）；逐 tenant 初始化只对未关联组织的 tenant 显示 |

状态标签由 [authorizationModel](../src/api/authorizationModel.ts) 的 `roleStatusTags` 统一计算：

| 条件 | 标签 |
|---|---|
| 默认角色、无覆盖 | 继承 |
| REMOVE | 已在此 tenant 移除 |
| ADD | 在此 tenant 加入 |
| 覆盖当下无作用 | 另加“目前无作用” |

行内操作：默认角色且尚未在此移除 → “在此 tenant 移除”；有覆盖 → “恢复继承”；“加入角色”只列目录中启用且此 tenant 尚未生效的角色。确认框按当前读数估计进入资格变化，写入后一律重新读取。

## 写入与并发

- 每次写入都带上次读取得到的 `expectedRevision`，成功后重新读取。
- HTTP 409 `{code:'AUTHZ_REVISION_CONFLICT', currentRevision}`：保留草稿与原因，提示重新加载；重新加载不丢弃未保存的默认角色草稿，但预览须重做。
- HTTP 403 `{code:'ORGANIZATION_...'}` 与 `AUTHZ_SOD_CONFLICT:<tenant>:<a>:<b>` 映射为 `organizationConsole.errors.*` 文案；未知代码显示原文。
- 组织接口走 `requestJson` 以保留 HTTP 状态（`backendRequest` 会把非 2xx 正文当作结果），路径约定与 `backendRequest` 相同；`X-Kudos-Context-Version` 与请求代次照旧由 HTTP 层附加与校验。

## 接口

管理端路径相对 `/api/admin/`，响应为 `ApiResponse` 信封。

| 接口 | 请求 | 返回 |
|---|---|---|
| `GET auth/organization/overview` | `organizationId` | revision、callerRank、manageableTenantIds（null 为全部）、tenants |
| `GET auth/organization/roleCatalog` | `organizationId` | 角色目录 |
| `POST auth/organization/tenant/associate`（平台） | tenantId、organizationId、reason? | 新修订号 |
| `POST auth/organization/tenant/dissociate`（平台） | tenantId、reason? | 新修订号 |
| `POST auth/organization/tenant/preview` | tenantId、open | affectedMembers、excludedMembers、membersPerRole、revision |
| `POST auth/organization/tenant/setOpen` | tenantId、open、expectedRevision?、reason? | 新修订号 |
| `POST auth/organization/member/read` | organizationId、userId | 默认角色、各 tenant 角色视图、管理身份、目录、revision |
| `POST auth/organization/member/previewDefaults` | organizationId、userId、roleIds | 新增／移除、entryChanges、tenantRoleChanges、sodConflicts |
| `POST auth/organization/member/saveDefaults` | 同上 + expectedRevision、reason | 新修订号 |
| `POST auth/organization/member/saveOverride` | organizationId、tenantId、userId、roleId、action、expectedRevision、reason | 新修订号 |
| `POST auth/organization/member/removeOverride` | 同上，无 action（恢复继承） | 新修订号 |
| `POST auth/organization/admin/list`、`/assign`、`/revoke` | organizationId（、userId、reason?） | 列表／新修订号 |
| `POST auth/organization/managementRole/list`、`/grant`、`/revoke` | organizationId（、userId、roleKind、tenantIds、reason?） | 列表／新修订号 |
| `GET /api/auth/contexts` | — | current（scope、tenantId 可为 null、contextVersion）、organizationScope、tenants |
| `POST /api/auth/context/switch` | tenantId（null 为组织范围）、subSystemCode、contextVersion | `{status:'SWITCHED', current, user}`；409 `AUTHENTICATION_*` |

`/api/auth/contexts` 返回 404 或 `AUTHENTICATION_ORGANIZATION_REQUIRED` 时视为旧模式，控制台照旧渲染。

## Mock 与测试

[organizationAuthorizationMock](../src/mocks/organizationAuthorizationMock.ts) 实现上表：组织 org-1 有 tenant A、B、C（已开放）与 D（未开放）；角色使用者管理员、报表查看、通知发送（与使用者管理员互斥）；小王默认两个角色、在 B 移除使用者管理员；zhang 为组织管理员兼 mock 会话用户，li 为组织权限管理员，chen 为 B 的 tenant 权限管理员。租户列表行由 mock 附上组织归属与开放状态。

`cd webApp && node --test test/*.test.mjs` 覆盖状态标签（含目前无作用）、K-1 有效角色、默认变更跟进 B 且 REMOVE 保留、409 不改状态、自我修改被拒、开放预览与进入、组织范围切换、迟到响应作废。
