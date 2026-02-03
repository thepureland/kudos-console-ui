# pages/sys/cache 所需数据与 Mock 说明

## 1. CacheList.vue

| 接口 | 方法 | 说明 | 请求 | 响应 |
|------|------|------|------|------|
| sys/cache/search | POST | 分页列表 | body: `{ pageNo, pageSize, orders?, name?, subSysDictCode? }` | `{ code: 200, data: { first: rows[], second: total } }` |
| sys/cache/delete | DELETE | 单条删除 | query: `id` | `{ code: 200, data: true }` |
| sys/cache/batchDelete | POST | 批量删除 | body: `[id, ...]` | `{ code: 200, data: true }` |
| sys/cache/updateActive | GET | 启用/停用 | query: `id, active, subSysDictCode?` | `{ code: 200, data: true }` |
| sys/cache/management/{op} | GET | 管理操作 | query: `cacheName`, `key`(op 非 reloadAll/clear 时) | `{ code: 200, data?: string }` |
| sys/dictItem/* | GET/POST | 字典 | 见 BasePage | sub_sys、cache_strategy |

**列表行字段**：id, name, subSysDictCode, strategyDictCode, writeOnBoot, writeInTime, ttl, remark, active。

**management 的 op**：reload, reloadAll, evict, clear, isExists, valueInfo。

## 2. CacheDetail.vue

| 接口 | 方法 | 说明 | 请求 | 响应 |
|------|------|------|------|------|
| sys/cache/getDetail | GET | 详情 | query: `id` | `{ code: 200, data: detail }` |

**detail 字段**：id, name, subSysDictCode, strategyDictCode, writeOnBoot, writeInTime, builtIn, active, ttl, remark, createTime, updateTime, createUser, updateUser。

## 3. CacheAddEdit.vue

| 接口 | 方法 | 说明 | 请求 | 响应 |
|------|------|------|------|------|
| sys/cache/get | GET | 编辑回显 | query: `id` | `{ code: 200, data: row }` |
| sys/cache/getValidationRule | GET | 表单校验规则 | - | `{ code: 200, data: { [field]: [{ message?, ... }] } }` |
| sys/cache/saveOrUpdate | POST | 保存 | body: id?, name, subSysDictCode, strategyDictCode, writeOnBoot, writeInTime, ttl, managementBeanName?, remark | `{ code: 200, data: id }` |

**表单 formModel**：name, subSysDictCode, strategyDictCode, writeOnBoot, writeInTime, ttl, managementBeanName, remark。

---

Mock 放在 `shared/src/jsMain/resources/mock/`，路径与 URL 一致（如 `sys/cache/search.json`）。构建时用 `useMock=true` 会生成 MockJsonStore 并供 MockEngine 按 path 返回。
