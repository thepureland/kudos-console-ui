import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

// Exercise the actual HTTP client and response decoder through the production TS bundle.
const bundle = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    minify: false,
    lib: { entry: fileURLToPath(new URL('../src/api/authApi.ts', import.meta.url)), formats: ['es'] },
  },
});
const chunk = (Array.isArray(bundle) ? bundle.flatMap((result) => result.output) : bundle.output)
  .find((entry) => entry.type === 'chunk');
const { authApi } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);

async function withBrowser(run) {
  const original = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const values = new Map([['kudos_token', 'existing-token']]);
  globalThis.window = { location: { origin: 'https://console.example', hostname: 'console.example' }, __KUDOS_USE_MOCK__: false };
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try { await run(values); } finally { Object.assign(globalThis, original); }
}

test('logout revokes the server session before clearing the local token', async () => {
  await withBrowser(async (values) => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.pathname, '/api/public/auth/sessions/current');
      assert.equal(options.method, 'DELETE');
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.headers.Authorization, 'Bearer existing-token');
      assert.equal(values.get('kudos_token'), 'existing-token');
      return new Response(JSON.stringify({ success: true, code: 200, data: true }), { status: 200 });
    };
    await authApi.logout();
    assert.equal(values.has('kudos_token'), false);
  });
});

test('failed server revocation is reported while the local token is cleared', async () => {
  await withBrowser(async (values) => {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, code: 503, message: 'Session service unavailable' }), { status: 503 });
    await assert.rejects(authApi.logout(), /Session service unavailable/);
    assert.equal(values.has('kudos_token'), false);
  });
});
