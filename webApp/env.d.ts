/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 是否启用登录鉴权，'false' 时关闭（sys 应用） */
  readonly VITE_REQUIRE_AUTH: string;
  /** 开发时 API 代理目标（仅 Vite 服务端使用） */
  readonly VITE_API_PROXY_TARGET: string;
  /** 开发时直连后端，绕过 Vite 代理（解决前后端端口不同时的代理延迟） */
  readonly VITE_API_DIRECT: string;
  /** 直连时的后端地址，默认用 VITE_API_PROXY_TARGET */
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
