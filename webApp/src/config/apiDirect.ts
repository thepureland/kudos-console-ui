/**
 * 开发时直连后端，解决前后端端口不同的问题。
 * 当 VITE_API_DIRECT=true 时，请求直接发往后端，绕过 Vite 代理。
 * 需在 main.ts 中首个 import，确保在 shared 加载前设置。
 * 后端需配置 CORS 允许前端源（如 http://localhost:8888）。
 */
const target = import.meta.env.VITE_API_DIRECT_TARGET || import.meta.env.VITE_API_PROXY_TARGET;
if (import.meta.env.VITE_API_DIRECT === 'true' && target && typeof window !== 'undefined') {
  (window as unknown as { __KUDOS_API_BASE__?: string }).__KUDOS_API_BASE__ = target.replace(/\/$/, '');
}
