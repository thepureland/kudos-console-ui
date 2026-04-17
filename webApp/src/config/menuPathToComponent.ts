/**
 * 路径到组件的映射，用于菜单点击时按状态切换内容（不改变地址栏）
 * 约定：path /a/b 默认对应 pages/a/b/${PascalCase(b)}ListPage.vue；例外见 PATH_OVERRIDES
 */
import { defineAsyncComponent, type Component } from 'vue';

const PATH_REDIRECTS: Record<string, string> = {
  '/': '/home',
};

/** 不符合约定的 path → 组件文件路径（相对 pages 目录） */
const PATH_OVERRIDES: Record<string, string> = {
  '/home': 'Welcome.vue',
  '/tabs': 'Placeholder.vue',
};

const PAGE_MODULES = import.meta.glob<{ default: Component }>('../pages/**/*.vue');

/**
 * 从 glob 推导 path → 组件文件路径（相对 pages）。
 * 凡符合 pages/{s1}/{s2}/*ListPage.vue 的，path 为 /s1/s2（小写），文件路径保留实际大小写（如 MicroServiceListPage.vue）。
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
    const relativePath = key.slice(prefix.length); // 保留 glob 实际路径与大小写（如 MicroServiceListPage.vue）
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

/** path 查表前统一为小写，与 deriveConventionPaths / PATH_OVERRIDES 的 key 一致 */
function normalizePath(path: string): string {
  if (!path || !path.startsWith('/')) return path;
  return '/' + path.slice(1).split('/').map((s) => s.toLowerCase()).join('/');
}

export function resolvePath(path: string): string {
  const redirected = PATH_REDIRECTS[path] ?? path;
  return normalizePath(redirected);
}

/**
 * 后端菜单项上的「地址」：常见为相对 path，也可能是完整 URL（含 origin）。
 * 转成与前端页面、el-menu index 一致的路径（resolvePath，含小写段）。
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

