/**
 * Direct backend connection during development; works around frontend/backend port differences.
 * When VITE_API_DIRECT=true, requests go straight to the backend, bypassing the Vite proxy.
 * Must be the first import in main.ts so it is set before `shared` is loaded.
 * The backend must allow the frontend origin (e.g. http://localhost:8888) via CORS.
 */
const target = import.meta.env.VITE_API_DIRECT_TARGET || import.meta.env.VITE_API_PROXY_TARGET;
if (import.meta.env.VITE_API_DIRECT === 'true' && target && typeof window !== 'undefined') {
  (window as unknown as { __KUDOS_API_BASE__?: string }).__KUDOS_API_BASE__ = target.replace(/\/$/, '');
}
