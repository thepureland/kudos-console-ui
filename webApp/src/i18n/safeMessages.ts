const RESERVED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** Translation paths are data; none of their segments may name an object prototype. */
export function isSafeMessagePath(path: string): boolean {
  return path.split('.').every((segment) => segment.length > 0 && !RESERVED_SEGMENTS.has(segment));
}

export function messageDictionary(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

/** Safely expand backend dotted keys, including when old stored entries contain unsafe keys. */
export function flatMessagesToNested(flat: Record<string, string>): Record<string, unknown> {
  const result = messageDictionary();
  for (const [key, value] of Object.entries(flat)) {
    if (!isSafeMessagePath(key) || typeof value !== 'string') continue;
    const parts = key.split('.');
    let current = result;
    for (const segment of parts.slice(0, -1)) {
      if (!Object.prototype.hasOwnProperty.call(current, segment) ||
          current[segment] === null || typeof current[segment] !== 'object') {
        current[segment] = messageDictionary();
      }
      current = current[segment] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}
