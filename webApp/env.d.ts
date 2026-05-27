/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Whether to enable login authentication; disabled when 'false' (sys app). */
  readonly VITE_REQUIRE_AUTH: string;
  /** API proxy target during development (used only by the Vite dev server). */
  readonly VITE_API_PROXY_TARGET: string;
  /** Connect directly to the backend during development, bypassing the Vite proxy (resolves proxy latency when frontend/backend ports differ). */
  readonly VITE_API_DIRECT: string;
  /** Backend address for direct connection; defaults to VITE_API_PROXY_TARGET. */
  readonly VITE_API_DIRECT_TARGET: string;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, any>;
  export default component;
}

declare module 'vuex' {
  interface Store<S = any> {
    state: S;
    getters: any;
    dispatch: (type: string, payload?: any) => Promise<any>;
    commit: (type: string, payload?: any) => void;
  }
  export function useStore<S = any>(key?: string): Store<S>;
  export function createStore<S>(options: any): Store<S>;
  export default any;
}
