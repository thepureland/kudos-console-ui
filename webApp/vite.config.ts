import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

/** 将 localhost 转为 127.0.0.1，避免 Node.js 解析到 IPv6(::1) 导致连接慢或超时 */
function normalizeProxyTarget(url: string): string {
  return url.replace(/^(https?:\/\/)localhost/i, '$1127.0.0.1');
}

function createProxyOptions(target: string) {
  const normalized = normalizeProxyTarget(target);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    target: normalized,
    changeOrigin: true,
    configure: isDev
      ? (proxy: { on: (event: string, fn: (...args: unknown[]) => void) => void }) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            (req as unknown as { _proxyStart?: number })._proxyStart = Date.now();
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const start = (req as unknown as { _proxyStart?: number })._proxyStart;
            if (start) {
              const ms = Date.now() - start;
              if (ms > 1000) {
                console.warn(
                  `[vite proxy] 慢请求 ${ms}ms: ${req.method} ${req.url} -> ${proxyRes.statusCode}`
                );
              }
            }
          });
        }
      : undefined,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8081';

  return {
    root: '.',
    plugins: [vue()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    optimizeDeps: {
      esbuildOptions: { sourcemap: false },
    },
    server: {
      port: 8888,
      host: true,
      allowedHosts: ['localhost', '127.0.0.1', 'kudos.io'],
      proxy: {
        '/api': createProxyOptions(proxyTarget),
        '/sys': createProxyOptions(proxyTarget),
        '/user': createProxyOptions(proxyTarget),
        '/rbac': createProxyOptions(proxyTarget),
      },
    },
  };
});
