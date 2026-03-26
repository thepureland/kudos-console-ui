/** 页面组件通用 props 类型（setup/constructor 统一入口）。 */
export type PageProps = Record<string, unknown>;

/** 页面组件通用 context 类型（仅约束 emit）。 */
export type PageContext = {
  emit: (event: string, ...args: unknown[]) => void;
};
