import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Convert localhost to 127.0.0.1 to avoid Node.js resolving to IPv6 (::1), which can cause slow connections or timeouts. */
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
                  `[vite proxy] slow request ${ms}ms: ${req.method} ${req.url} -> ${proxyRes.statusCode}`
                );
              }
            }
          });
        }
      : undefined,
  };
}

/**
 * Split large, size-stable dependencies into separate chunks to reduce the entry-bundle size and improve browser cache hits.
 * `shared` is a Kotlin/JS workspace artifact; its path may appear as either a package name or a local build directory — both are handled.
 */
function manualChunks(id: string): string | undefined {
  if (id.includes('@element-plus/icons-vue')) return 'element-icons';
  if (id.includes('element-plus')) return 'element-plus';
  if (id.includes('build/shared/dist/js/developmentLibrary') || id.includes('/node_modules/shared/')) {
    return 'shared-kotlin';
  }
  if (
    id.includes('/node_modules/vue/') ||
    id.includes('/node_modules/vue-router/') ||
    id.includes('/node_modules/vuex/') ||
    id.includes('/node_modules/vue-i18n/') ||
    id.includes('/node_modules/@vue/')
  ) {
    return 'vue-vendor';
  }
  return undefined;
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
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
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
      },
    },
  };
});
