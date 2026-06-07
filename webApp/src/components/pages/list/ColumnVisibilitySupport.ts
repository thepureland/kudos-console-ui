export class ColumnVisibilitySupport {
  private readonly allowedKeySet: Set<string>;

  /**
   * @param storageKey    localStorage key used to persist the visible-column list
   * @param allowedKeys   exhaustive list of column keys the table supports
   * @param defaultVisibleKeys  columns shown when no saved preference exists (defaults to all allowed)
   */
  constructor(
    private readonly storageKey: string,
    allowedKeys: string[],
    private readonly defaultVisibleKeys: string[] = allowedKeys
  ) {
    this.allowedKeySet = new Set(allowedKeys);
  }

  /**
   * Remove unknown keys from `keys` and fall back to defaults when the result is empty.
   * Always returns a fresh array so callers can mutate freely.
   */
  sanitize(keys: string[] | null | undefined): string[] {
    if (!keys || keys.length === 0) return [...this.defaultVisibleKeys];
    const next = keys.filter((key) => this.allowedKeySet.has(key));
    return next.length > 0 ? next : [...this.defaultVisibleKeys];
  }

  /** Read and validate the persisted column list from localStorage; returns defaults on any failure. */
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

  /** Sanitize and persist the given column list to localStorage. */
  save(keys: string[]): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(this.sanitize(keys)));
  }

  /**
   * Return true when a document click should close the column-visibility panel.
   * Clicks inside the panel itself or on the toggle button (matched by `toggleSelector`) are ignored.
   */
  shouldCloseOnOutsideClick(
    target: EventTarget | null,
    panelEl: HTMLElement | null,
    toggleSelector = '.table-corner-fold.is-left'
  ): boolean {
    if (!(target instanceof Node)) return false;
    // Click is inside the open panel — do not close.
    if (panelEl?.contains(target)) return false;
    const targetEl = target as HTMLElement;
    // Click is on the toggle button that opens/closes the panel — let that handler decide.
    return !(typeof targetEl.closest === 'function' && targetEl.closest(toggleSelector));
  }
}
