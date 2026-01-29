import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  root: '.',
  plugins: [
    vue(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // Suppress missing sourcemap warnings from Kotlin/JS dependency output
    esbuildOptions: {
      sourcemap: false,
    },
  },
  server: { port: 8080 },
}));
