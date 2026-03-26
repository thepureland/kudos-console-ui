/**
 * 详情页 setup 中常用的 page 视图模型类型：
 * - 含 state（可按页面扩展）
 * - 含 useSectionedDetail 依赖的格式化能力
 */
export type DetailPageViewModel<TState extends Record<string, unknown> = { detail: Record<string, unknown> | null }> = {
  state: TState;
  transAtomicService: (code: string) => string;
  transDict: (module: string, code: string, value: string) => string;
  formatDate: (value: unknown) => string;
};
