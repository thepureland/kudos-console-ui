type MockRequest = {
  method: string;
  body?: unknown;
  headers: Record<string, string>;
};

export type MockResponse = {
  status: number;
  body: unknown;
};

const fixtureModules = import.meta.glob('./fixtures/**/*.json', {
  import: 'default',
}) as Record<string, () => Promise<unknown>>;

const fixtures = new Map<string, () => Promise<unknown>>();
Object.entries(fixtureModules).forEach(([file, load]) => {
  const relative = file.replace(/^\.\/fixtures\//, '').replace(/\.json$/, '');
  fixtures.set(relative, load);
});

/**
 * Lightweight TypeScript mock dispatcher. Static JSON fixtures remain the source of
 * deterministic data; generic mutations and empty collections keep new screens usable
 * without requiring a second application runtime.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class MockBackend {
  async dispatch(url: URL, request: MockRequest): Promise<MockResponse> {
    const route = normalizeRoute(url.pathname);
    if ((route === 'me' || route === 'menus') && !readAuthorization(request.headers)) {
      return { status: 401, body: {} };
    }

    const loadFixture = fixtures.get(route);
    if (loadFixture) return { status: 200, body: await loadFixture() };

    const operation = route.split('/').pop() ?? '';
    if (/^(save|update|saveOrUpdate|create|submit)$/i.test(operation)) {
      const body = asRecord(request.body);
      return { status: 200, body: { code: 200, data: body?.id ?? createMockId(route) } };
    }
    if (/^(delete|batchDelete|remove|approve|reject|cancel|updateActive|revokeAllTokens|clear|evict|reload|reloadAll)$/i.test(operation)) {
      return { status: 200, body: { code: 200, data: true } };
    }
    if (/^(search|pagingSearch)$/i.test(operation)) {
      return { status: 200, body: { code: 200, data: { data: [], totalCount: 0 } } };
    }
    if (/^(getValidationRule)$/i.test(operation)) return { status: 200, body: {} };
    if (/^(getAll|load|loadTree|loadTreeNodes|searchTree|searchCandidates)$/i.test(operation)) {
      return { status: 200, body: { code: 200, data: [] } };
    }
    return { status: 404, body: {} };
  }
}

const mockBackend = new MockBackend();

export function shouldUseMockBackend(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = (window as Window & { __KUDOS_USE_MOCK__?: boolean }).__KUDOS_USE_MOCK__;
  if (typeof forced === 'boolean') return forced;
  const env = import.meta.env.VITE_USE_MOCK;
  if (env === 'true') return true;
  if (env === 'false') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function dispatchMockRequest(url: URL, request: MockRequest): Promise<MockResponse> {
  return mockBackend.dispatch(url, request);
}

function normalizeRoute(pathname: string): string {
  return pathname
    .replace(/^\/api\/admin\//, '')
    .replace(/^\/api\//, '')
    .replace(/^\//, '');
}

function readAuthorization(headers: Record<string, string>): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization');
  return entry?.[1] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function createMockId(route: string): string {
  const entity = route.split('/').slice(-2, -1)[0] || 'entity';
  return `${entity}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
