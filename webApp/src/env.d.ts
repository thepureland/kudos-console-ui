/**
 * Options accepted by the legacy global `ajax` helper. Assigned to `window.ajax`
 * in main.ts for older pages while new code imports backendRequest directly.
 */
export type AjaxOptions = {
  url: string;
  /** HTTP verb; defaults to GET when omitted. */
  method?: string;
  /** Query/body parameters forwarded to backendRequest. */
  params?: Record<string, any> | null;
  /** Extra request headers (e.g. auth tokens). */
  headers?: Record<string, string> | null;
};

declare global {
  // Ambient const so TypeScript accepts bare `ajax(...)` calls inside .ts/.vue
  // files without an explicit window prefix.
  const ajax: (options: AjaxOptions) => Promise<any>;
  interface Window {
    // Optional on Window because it is assigned during application startup.
    ajax?: (options: AjaxOptions) => Promise<any>;
  }
}
