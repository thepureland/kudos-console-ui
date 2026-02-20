export class ColumnVisibilitySupport {
  private readonly allowedKeySet: Set<string>;

  constructor(
    private readonly storageKey: string,
    allowedKeys: string[],
    private readonly defaultVisibleKeys: string[] = allowedKeys
  ) {
    this.allowedKeySet = new Set(allowedKeys);
  }

  // 兜底与白名单校验：防止 localStorage 中的脏值污染列配置
  sanitize(keys: string[] | null | undefined): string[] {
    if (!keys || keys.length === 0) {
      return [...this.defaultVisibleKeys];
    }
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

  // 保存前再次 sanitize，保证数据始终可回放
  save(keys: string[]): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(this.sanitize(keys)));
  }

  shouldCloseOnOutsideClick(
    target: EventTarget | null,
    panelEl: HTMLElement | null,
    toggleSelector = '.table-corner-fold.is-left'
  ): boolean {
    // 仅在“点击既不在面板内，也不在折角按钮上”时触发关闭
    if (!(target instanceof Node)) return false;
    if (panelEl?.contains(target)) return false;
    const targetEl = target as HTMLElement;
    return !(typeof targetEl.closest === 'function' && targetEl.closest(toggleSelector));
  }
}
