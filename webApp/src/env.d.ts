/**
 * Options accepted by the global `ajax` helper that bridges Vue components to
 * the Kotlin Multiplatform "shared" BackendApi.  Assigned to `window.ajax` in
 * main.ts so the prebuilt shared artifact can call it without importing
 * anything from the UI layer.
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
    // Optional on Window because it is assigned after the shared module loads.
    ajax?: (options: AjaxOptions) => Promise<any>;
  }
}
