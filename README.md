# Kudos Console UI

## 项目定位
这是一个 Kotlin Multiplatform for Web 工程，职责分层如下：

- 展现层：`webApp/`，使用 TypeScript + Vue + Element Plus。
- 领域模型 / 业务逻辑 / 与服务端通信：`shared/`，由 Kotlin Multiplatform 负责。

## 开发期无后端支持
在没有真实服务端的情况下，项目也要能完整跑通，因此开发期会 mock 服务端数据。

现有实现：
- `shared/` 内部使用 Ktor `MockEngine` 返回 mock 响应，确保共享层逻辑也被验证。
- mock 数据以 JSON 形式存放在 `shared/src/jsMain/resources/mock/`。
- 通过 Gradle 属性 `-PuseMock=true` 启用 mock；未启用时会在构建阶段排除 `resources/mock/**`。

## 开发命令
在项目根目录执行：

- 启动开发服务：`npm run start`
- 生产构建：`npm run build`
