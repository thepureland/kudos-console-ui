# Page.vue 与父类/公共组件功能重复情况

本报告梳理各 FormPage / ListPage / DetailPage 中与父类或公共逻辑重复的实现，便于后续收敛到基类或 composable。

---

## 一、DetailPage

### 1. 与 BaseDetailPage 重复或可下沉的逻辑

| 文件 | 重复/可收敛点 | 说明 |
|------|----------------|------|
| **所有 DetailPage** | 构造函数内 `if (props.rid) this.state.rid = props.rid as string` | 完全一致，可下沉到 BaseDetailPage 构造函数。 |
| **多数 DetailPage** | `createDetailLoadParams(): { id: String(this.state.rid \|\| this.props.rid \|\| '') }` | 与基类默认 `{ id: this.props.rid }` 仅差「用 state.rid 兜底」。若基类在构造函数中同步 `state.rid`，基类可改为 `return { id: String(this.state.rid \|\| this.props.rid \|\| '') }`，子类仅在有额外参数时再重写（如 Domain 的 pageNo/pageSize）。 |
| **TenantDetailPage** | `getDetailLoadUrl()` | 返回 `getRootActionPath() + '/getDetail'`，与基类默认一致，可删除重写。 |
| **TenantDetailPage** | `loadData()` | 逻辑与 BaseDetailPage.loadData() 一致（params → backendRequest → postLoadDataSuccessfully / error），可删除重写，仅保留 `postLoadDataSuccessfully` 中对字段的默认值处理。 |
| **DomainDetailPage** | `loadData()` | 仅多传了 `method: 'get'`，而基类未传 method 时 backendRequest 通常即 GET。若基类默认即为 GET，可删除重写，仅保留 `createDetailLoadParams`（含 pageNo/pageSize）和 `postLoadDataSuccessfully`。 |
| **TenantDetailPage / DomainDetailPage / ParamDetailPage / SystemDetailPage / MicroServiceDetailPage** | `postLoadDataSuccessfully` | 模式相同：对部分字段做 null/默认值处理 → `this.state.detail = data` → `showAfterLoadData() && this.render()`。可考虑基类提供「可覆盖的 normalizeDetail(data)」或共享工具，子类只填自己关心的字段默认值。 |

### 2. setup 中重复的 watch(rid)

所有使用 SectionedDetailDialog 的 DetailPage 在 setup 中都有相同逻辑：

```ts
watch(
  () => props.rid,
  (newRid, oldRid) => {
    const id = newRid ? String(newRid) : '';
    page.state.rid = id;
    if (oldRid !== undefined && id && id !== String(oldRid)) {
      page.state.detail = null;
      page.loadData();  // DictDetailPage 另有 loadOthers/tableData 等
    }
  }
);
```

- **建议**：抽成 composable，例如 `useDetailDialogRidWatch(page, props, { onRidChange?: () => void })`，供各 DetailPage 复用；DictDetailPage 可在 onRidChange 里再做 loadOthers、清 tableData 等。

---

## 二、FormPage

### 1. 与 BaseAddEditPage 重复或可下沉的逻辑

| 文件 | 重复/可收敛点 | 说明 |
|------|----------------|------|
| **ResourceFormPage** | `loadRowObject()` | 整体重写：先 `buildParentCascaderOptions()`，再请求、解析 result（支持直接实体或 `result.data`）、`ensureParentPathLoaded`、`fillForm`、`render`、`onEditFormLoaded` 或报错。与基类 `loadRowObject` 大量重复，仅多了「级联准备」与「result 包装格式」处理。建议：基类增加钩子如 `beforeLoadRowObject()`、`extractRowData(result)`，ResourceFormPage 只实现这些钩子，其余走基类。 |
| **各 FormPage** | `getRowObjectLoadUrl()` / `getLoadFailedMessageKey()` | 基类默认：`getRootActionPath() + "/get"`、`'addEditPage.loadFailed'`。子类改为 `/getDetail` 或模块级 i18n key 属于合理定制，非重复。 |

---

## 三、ListPage

### 1. 与 BaseListPage / TenantSupportListPage 重复或可下沉的逻辑

| 文件 | 重复/可收敛点 | 说明 |
|------|----------------|------|
| **SystemListPage / MicroServiceListPage** | `doSearch()` | 重写后仍为：`createSearchParams` → `backendRequest(getSearchUrl(), method: 'post', params)` → 按树形/扁平结果处理 → `postSearchSuccessfully`。与基类 `doSearch` 的差异主要在响应结构（数组或 `{ data }`）和 `postSearchSuccessfully` 的树化逻辑。保留重写合理，但可考虑基类支持「可配置的响应解析」或子类只重写 `postSearchSuccessfully` + 可选的 `extractSearchResult`，减少重复的请求代码。 |
| **ResourcePermissionListPage** | `doSearch` / 树点击 / `pagingSearch` | 有自定义 `doSearch`（先 parseSubSysOrTenant、loadMenus 再 super.doSearch）、树节点点击后直接 `backendRequest`、以及独立 `pagingSearch`。业务特殊，与基类分工明确，仅「调用 backendRequest + 填 tableData/total」的片段与基类相似，可视为必要定制。 |
| **各 ListPage** | `createSearchParams()` | 均为 `const params = super.createSearchParams(); ...; return params`，仅往 params 里塞本页 searchParams，属于正常扩展，非重复。 |

---

## 四、建议的改造优先级

1. **高（低风险、去重明显）**
   - BaseDetailPage：构造函数中统一 `if (props.rid) this.state.rid = String(props.rid)`；`createDetailLoadParams()` 默认实现改为 `return { id: String(this.state.rid || this.props.rid || '') }`。
   - 所有仅做「id 用 state.rid 兜底」的 DetailPage：删除对 `createDetailLoadParams` 的重写（Domain 等需要额外参数的保留并只加参数）。
   - TenantDetailPage：删除 `getDetailLoadUrl()`、`loadData()`，仅保留 `postLoadDataSuccessfully` 的字段默认值处理。

2. **中（需小范围联调）**
   - 抽 `useDetailDialogRidWatch(page, props, options)`，各 DetailPage 的 setup 改为调用该 composable。
   - DomainDetailPage：确认 backend 为 GET 且无特殊参数后，删除 `loadData()`，只保留 `createDetailLoadParams` 与 `postLoadDataSuccessfully`。

3. **低（结构性优化，改动面大）**
   - BaseAddEditPage：增加 `beforeLoadRowObject()`、`extractRowData(result)`，ResourceFormPage 只实现钩子并复用基类 `loadRowObject`。
   - BaseDetailPage：提供 `normalizeDetail(data)` 或类似钩子，Tenant/Domain/Param/System/MicroService 的 `postLoadDataSuccessfully` 收拢为对钩子的实现。
   - BaseListPage：对树形/特殊响应格式的列表，提供可选的 `extractSearchResult(result)` 或扩展 `postSearchSuccessfully` 的入参，减少各列表页对 `doSearch` 的完整重写。

---

## 五、已完成的收敛（本次实施）

- **BaseDetailPage**：构造函数中增加 `this.state.rid = String(props.rid)`；`createDetailLoadParams()` 默认改为 `return { id: String(this.state.rid || this.props.rid || '') }`。
- **TenantDetailPage**：删除与基类一致的 `getDetailLoadUrl()`、`loadData()`，仅保留 `postLoadDataSuccessfully`。
- **以下 DetailPage** 删除仅做「同步 state.rid」的构造函数与仅返回 `{ id }` 的 `createDetailLoadParams`：CacheDetailPage、DataSourceDetailPage、SystemDetailPage、MicroServiceDetailPage、TenantDetailPage、DomainDetailPage（仅删 constructor）、ResourceDetailPage、DictItemDetailPage、I18nDetailPage、RoleDetailPage、UserGroupDetailPage、OrganizationDetailPage、AccountDetailPage、ParamDetailPage。
- **DomainDetailPage / DictDetailPage** 仍保留各自的 `createDetailLoadParams`（含 pageNo/pageSize 或其它参数）和自定义 `loadData`（如需 method: 'get' 或其它逻辑）。

---

## 六、无需改动的部分

- **FormPage** 的 `getRowObjectLoadUrl()`、`getLoadFailedMessageKey()` 改为 `/getDetail` 或模块 i18n：属于业务/接口差异，保留即可。
- **ListPage** 的 `createSearchParams()` 在 `super.createSearchParams()` 上追加本页参数：标准用法。
- **DictDetailPage** 的 `getDetailLoadUrl`、`createDetailLoadParams`、`loadOthers`、字典项分页等：业务特殊，保持现状。
- **CacheListPage.getRowId(row)** 等对主键取法的重写：列表行主键不一致时的必要覆盖。
