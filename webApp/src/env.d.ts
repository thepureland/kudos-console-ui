export type AjaxOptions = {
  url: string;
  method?: string;
  params?: Record<string, any> | null;
  headers?: Record<string, string> | null;
};

declare global {
  const ajax: (options: AjaxOptions) => Promise<any>;
  interface Window {
    ajax?: (options: AjaxOptions) => Promise<any>;
  }
}
