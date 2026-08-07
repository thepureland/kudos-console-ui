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
