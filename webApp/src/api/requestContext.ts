/** Transport context is separate from Vue state so requests cannot infer identity from a selector. */
export type SessionScope = 'TENANT' | 'ORGANIZATION';

/**
 * Where the current session works, as the server issued it. ORGANIZATION scope is management-only
 * and has no tenant; TENANT scope names one tenant and (usually) one sub-system.
 */
export interface SessionTarget {
  organizationId: string;
  scope: SessionScope;
  tenantId: string | null;
  subSystemCode?: string | null;
  contextVersion: string;
}

let target: SessionTarget | null = null;
let generation = 0;
export function getRequestContext(): Readonly<SessionTarget> | null { return target; }
export function getRequestGeneration(): number { return generation; }
export function acceptRequestContext(next: SessionTarget | null): number {
  target = next == null ? null : { ...next };
  return ++generation;
}
export class StaleContextError extends Error {
  constructor() { super('The request belongs to a previous console context'); this.name = 'StaleContextError'; }
}
export function assertRequestGeneration(expected: number): void {
  if (expected !== generation) throw new StaleContextError();
}
