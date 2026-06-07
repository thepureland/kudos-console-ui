/**
 * Public contract that every detail-page class must satisfy.
 *
 * Page components cast their reactive instance to this type so that
 * `useDetailPageSetupBase` (and indirectly `useSectionedDetail`) can
 * consume them in a type-safe way.
 *
 * - `state` holds the page-specific reactive data; the default generic
 *   constrains it to carry at least a nullable `detail` record, which
 *   is the minimum expected by the sectioned-detail helpers.
 * - The three formatter methods (`transAtomicService`, `transDict`,
 *   `formatDate`) are called by `sectionedDetail` to render field values.
 *
 * @template TState - The page's reactive state shape. Defaults to
 *   `{ detail: Record<string, unknown> | null }`.
 */
export type DetailPageViewModel<TState extends Record<string, unknown> = { detail: Record<string, unknown> | null }> = {
  state: TState;
  /** Translate an atomic-service code to its display label. */
  transAtomicService: (code: string) => string;
  /** Translate a dictionary value given its module and code. */
  transDict: (module: string, code: string, value: string) => string;
  /** Format a raw date value into a locale-aware display string. */
  formatDate: (value: unknown) => string;
};
