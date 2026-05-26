/** Common page component props type (unified entry for setup/constructor). */
export type PageProps = Record<string, unknown>;

/** Common page component context type (only constrains emit). */
export type PageContext = {
  emit: (event: string, ...args: unknown[]) => void;
};
