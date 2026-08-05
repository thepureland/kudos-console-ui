/**
 * Path-to-component mapping; used to switch content by state when a menu item is clicked (without changing the address bar).
 * Convention: path /a/b maps by default to pages/a/b/${PascalCase(b)}ListPage.vue; exceptions are listed in PATH_OVERRIDES.
 */
import { defineAsyncComponent, type Component } from 'vue';

const PATH_REDIRECTS: Record<string, string> = {
  '/': '/home',
};

/** Paths that don't follow the convention -> component file path (relative to pages directory). */
const PATH_OVERRIDES: Record<string, string> = {
  '/home': 'Welcome.vue',
  '/tabs': 'Placeholder.vue',
  // Menu pages that are not lists. The convention below only picks up `*ListPage.vue`, so a page
  // named anything else is routable but *not reachable* — the content area resolves through this
  // map, not through <router-view>, so a missing entry here shows the previous page rather than
  // failing. Anything added to router/index.ts as a menu destination must be listed here too.
  '/auth/rowscope': 'auth/authz/RowScopeShadowPage.vue',
  '/auth/instancegrant': 'auth/instance/InstanceGrantPage.vue',
};

/** Only include components that can serve as menu main pages; avoids form/detail dialogs being mistakenly bundled into menu page async chunks. */
const PAGE_MODULES = import.meta.glob<{ default: Component }>([
  '../pages/**/*ListPage.vue',
  '../pages/Welcome.vue',
  '../pages/Placeholder.vue',
  // Listed individually rather than by a broader `*Page.vue` glob: that would also sweep in the
  // form and detail pages, which are dialogs mounted by their list page and must not become menu
  // chunks of their own.
  '../pages/auth/authz/RowScopeShadowPage.vue',
  '../pages/auth/instance/InstanceGrantPage.vue',
]);

/**
 * Derive path -> component file path (relative to pages) from glob.
 * For any pages/{s1}/{s2}/*ListPage.vue match, path is /s1/s2 (lowercase); file path preserves the actual casing (e.g. MicroServiceListPage.vue).
 */
function deriveConventionPathToFile(): Record<string, string> {
  const prefix = '../pages/';
  const suffix = '.vue';
  const pathToFile: Record<string, string> = {};
  for (const key of Object.keys(PAGE_MODULES)) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const inner = key.slice(prefix.length, -suffix.length);
    const parts = inner.split('/');
    if (parts.length !== 3) continue;
    const [s1, s2, fileName] = parts;
    if (!fileName.endsWith('ListPage')) continue;
    const path = `/${s1.toLowerCase()}/${s2.toLowerCase()}`;
    const relativePath = key.slice(prefix.length); // Preserve glob's actual path and casing (e.g. MicroServiceListPage.vue)
    pathToFile[path] = relativePath;
  }
  return pathToFile;
}

function loadPage(relativePath: string): Promise<Component> {
  const key = `../pages/${relativePath}`;
  const loader = PAGE_MODULES[key];
  if (!loader) return Promise.reject(new Error(`No page module: ${key}`));
  return loader().then((m) => m.default);
}

function buildPathToComponent(): Record<string, Component> {
  const map: Record<string, Component> = {};
  const convention = deriveConventionPathToFile();
  const overridePaths = new Set(Object.keys(PATH_OVERRIDES));
  for (const [p, file] of Object.entries(convention)) {
    if (overridePaths.has(p)) continue;
    map[p] = defineAsyncComponent(() => loadPage(file));
  }
  for (const [p, file] of Object.entries(PATH_OVERRIDES)) {
    map[p] = defineAsyncComponent(() => loadPage(file));
  }
  return map;
}

const PATH_TO_COMPONENT = buildPathToComponent();

/** Lowercase the path before lookup, matching the keys used by deriveConventionPaths / PATH_OVERRIDES. */
function normalizePath(path: string): string {
  if (!path || !path.startsWith('/')) return path;
  return '/' + path.slice(1).split('/').map((s) => s.toLowerCase()).join('/');
}

export function resolvePath(path: string): string {
  const redirected = PATH_REDIRECTS[path] ?? path;
  return normalizePath(redirected);
}

/**
 * The "address" field on a backend menu item: usually a relative path, but may be a full URL (with origin).
 * Convert to a path consistent with the frontend pages and el-menu index (resolvePath, lowercase segments).
 */
export function extractMenuPathFromBackend(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      s = new URL(s).pathname || '/';
    } catch {
      return null;
    }
  }
  if (!s.startsWith('/')) s = '/' + s;
  return resolvePath(s);
}

export const VALID_MENU_PATHS = new Set(Object.keys(PATH_TO_COMPONENT));

export function getComponentForPath(path: string): Component | undefined {
  const resolved = resolvePath(path);
  return PATH_TO_COMPONENT[resolved];
}
