export class ColumnVisibilitySupport {
  private readonly allowedKeySet: Set<string>;

  constructor(
    private readonly storageKey: string,
    allowedKeys: string[],
    private readonly defaultVisibleKeys: string[] = allowedKeys
  ) {
    this.allowedKeySet = new Set(allowedKeys);
  }

  sanitize(keys: string[] | null | undefined): string[] {
    if (!keys || keys.length === 0) return [...this.defaultVisibleKeys];
    const next = keys.filter((key) => this.allowedKeySet.has(key));
    return next.length > 0 ? next : [...this.defaultVisibleKeys];
  }

  load(): string[] {
    if (typeof window === 'undefined') return [...this.defaultVisibleKeys];
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return [...this.defaultVisibleKeys];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...this.defaultVisibleKeys];
      return this.sanitize(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
      return [...this.defaultVisibleKeys];
    }
  }

  save(keys: string[]): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(this.sanitize(keys)));
  }

  shouldCloseOnOutsideClick(
    target: EventTarget | null,
    panelEl: HTMLElement | null,
    toggleSelector = '.table-corner-fold.is-left'
  ): boolean {
    if (!(target instanceof Node)) return false;
    if (panelEl?.contains(target)) return false;
    const targetEl = target as HTMLElement;
    return !(typeof targetEl.closest === 'function' && targetEl.closest(toggleSelector));
  }
}
