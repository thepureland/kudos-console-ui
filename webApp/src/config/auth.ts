/**
 * 鉴权配置（构建时注入）
 *
 * REQUIRE_AUTH：是否启用登录鉴权
 * - true：user 应用，未登录时显示登录页
 * - false：sys 应用，不显示登录页，直接进入主界面
 *
 * 由 VITE_REQUIRE_AUTH 环境变量控制，构建时写入产物。
 * 默认 true（安全优先）。
 *
 * @see .env      - 默认 user 模式
 * @see .env.sys  - sys 模式
 */
export const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH !== 'false';
