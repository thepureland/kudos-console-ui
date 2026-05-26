/**
 * Common page view-model type used in detail-page setup:
 * - includes state (extendable per page)
 * - includes the formatting helpers required by useSectionedDetail
 */
export type DetailPageViewModel<TState extends Record<string, unknown> = { detail: Record<string, unknown> | null }> = {
  state: TState;
  transAtomicService: (code: string) => string;
  transDict: (module: string, code: string, value: string) => string;
  formatDate: (value: unknown) => string;
};
