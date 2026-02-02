/// <reference types="vite/client" />

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
