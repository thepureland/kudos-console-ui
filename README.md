# Kudos Console UI

## 项目定位

这是一个纯 TypeScript 的 Vue 3 管理控制台：

- 展现层：Vue 3 + Element Plus。
- 状态与业务模型：TypeScript。
- 服务端通信：浏览器原生 `fetch`，统一封装在 `webApp/src/api/` 与 `webApp/src/utils/backendRequest.ts`。
- 工程构建：npm + Vite，不需要 JDK、Gradle 或 Kotlin 工具链。

## 开发期无后端支持
在没有真实服务端的情况下，项目也要能完整跑通，因此开发期会 mock 服务端数据。

现有实现：

- Mock 调度器位于 `webApp/src/mocks/mockBackend.ts`。
- mock 数据以 JSON 形式存放在 `webApp/src/mocks/fixtures/`。
- `window.__KUDOS_USE_MOCK__` 可在应用启动前强制指定；也可使用 `VITE_USE_MOCK=true/false`。
- 未显式配置时，`localhost` 与 `127.0.0.1` 默认启用 Mock，其他主机默认访问真实后端。

## 开发命令
在项目根目录执行：

- 启动开发服务：`npm run start`
- 生产构建：`npm run build`
- 安装依赖：`npm install`

## 鉴权模式（sys / user）
项目支持两种构建模式，由环境变量 `VITE_REQUIRE_AUTH` 控制：

| 模式 | 命令 | 说明 |
|------|------|------|
| **user**（默认） | `npm run start` / `npm run build` | 需要登录，未登录显示登录页 |
| **sys** | `npm run start:sys` / `npm run build:sys` | 无需登录，直接进入主界面（仅 sys 微服务，无用户体系） |

- 配置文件：`webApp/.env`（默认）、`webApp/.env.sys`（sys 模式）
- sys 模式下：不显示登录页、不显示用户下拉（头像/退出）、侧栏使用静态菜单

## 开发时前后端分离
前端与后端端口不同时，通过 Vite proxy 将 API 请求转发到后端：

- 配置 `VITE_API_PROXY_TARGET`（如 `http://localhost:8080`）。
- 所有服务端调用统一使用 `/api` 路径并由 Vite proxy 转发。
- 如需绕过代理，可设置 `VITE_API_DIRECT=true`；目标地址取 `VITE_API_DIRECT_TARGET` 或 `VITE_API_PROXY_TARGET`。
- Mock 模式不发起真实请求，因此不经过 proxy。

## 服务端响应契约

后端（`kudos-ability-web-springmvc` 的 `GlobalResponseBodyHandler`）把**所有**控制器返回值统一包成
`ApiResponse` 信封：`{ success, code, message, data, errors, timestamp, traceId }`。标注了
`@IgnoreApiResponseWrap` 的类或方法除外。

### 两条请求通道的错误语义不同

| 通道 | 入口 | 非 2xx 响应 |
|---|---|---|
| `backendRequest` | `utils/backendRequest.ts` → `requestText` | **不抛异常**，照常读 body |
| `requestJson` | `api/httpClient.ts` | **抛 `HttpResponseError`** |

差别来自 `requestText` 里那个开关：

```ts
if (options.throwOnHttpError && (status < 200 || status >= 300)) { throw new HttpResponseError(...) }
```

`backendRequest` 不传这个选项，`requestJson` 恒定传 `true`。

**管理台所有业务页面走的都是 `backendRequest`，因此对 HTTP 状态码不敏感**：成败一律由 body 里的
`success` 字段判定（`isApiSuccessResponse` / `getApiFailureMessage` 等辅助函数），失败提示取
`errors[0].message`，取不到再回落顶层 `message`。全项目没有任何一处按 `response.status` 分支。

这是有意的解耦：后端的 HTTP 状态码策略（业务异常 200、参数错 400、记录不存在 404、
未捕获异常 500）可以独立演进而不影响前端，只要信封结构不变。`backendRequest` 另有一层
`extractErrorPayload` 兜底，即使将来某处打开 `throwOnHttpError`，也会从
`error.response.data` / `error.data` / `error.message` 把信封捞回来继续走正常流程。

### `authApi` 的解包

`api/authApi.ts` 的三个端点 `/api/auth/login`、`/api/me`、`/api/menus` 目前**只存在于
`mocks/mockBackend.ts`**（后端只有 `/api/admin/**` 控制器），mock 返回的是裸载荷。但它们已按
真实后端的信封约定处理，走 `requestAuthPayload` → `resolveApiPayload`，与管理台同一套解包逻辑。

`resolveApiPayload` 对两种响应形态都成立，因此**现在接 mock、将来接真实后端都不需要再改**：

- 裸载荷（mock 的对象或数组）——原样透传
- `ApiResponse` 信封——取 `data`

失败也有两种形态，都会被翻译成用户可读的文案后抛出：

| 形态 | 典型场景 | 处理 |
|---|---|---|
| HTTP 200 + `success: false` | 密码错误（后端的 `ServiceException`） | `resolveApiPayload` 取 `errors[0].message` / `message` 并翻译 |
| 非 2xx | 网关 401/403、服务端 500 | 捕获 `HttpResponseError`，用 `resolveThrownErrorMessage` 从 body 取信封并翻译 |

> 这里的 `success` 检查不是可选项。密码错误在后端是业务异常，**回的是 HTTP 200**；只解包不检查
> `success` 的话，拿到的是 `data: null`，最终报成"响应里没有 token"——描述了症状，掩盖了后端
> 已经说清楚的原因。同理，非 2xx 分支若不走 `resolveThrownErrorMessage`，用户看到的会是
> `sys.error-msg.default.401` 这样的原始 i18n key。
