/**
 * IP 访问规则表单：IPv4 与后端 uint32 互转；IPv6 为 128 位无符号整数，`ipStart`/`ipEnd` 对应库内 NUMERIC(39,0)（JSON 常为十进制字符串）。
 */

const U64_MASK = (1n << 64n) - 1n;

/** IPV4_FULL 点分串 → uint32（与 Java 无符号转 long 写入一致） */
export function ipv4PaddedToUint32(s: string): number {
  const parts = String(s).trim().split('.');
  if (parts.length !== 4) return 0;
  const a = parts.map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n >= 0 && n <= 255 ? n : 0;
  });
  return ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
}

/** uint32 → IPV4_FULL */
export function uint32ToIpv4Padded(n: number): string {
  const x = n >>> 0;
  return [24, 16, 8, 0].map((sh) => String((x >>> sh) & 255).padStart(3, '0')).join('.');
}

function javaLongBitsToBigUint64(n: number): bigint {
  let x = BigInt(Math.trunc(n));
  if (x < 0n) x = (x + (1n << 64n)) & U64_MASK;
  return x & U64_MASK;
}

/** 后端 Long 可能为 JSON number 或十进制字符串（大整数时），转为无符号 64 位再参与 IPv6 拼接 */
export function javaLongLikeToBigUint64(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === 'bigint') {
    return javaLongLikeToBigUint64(v.toString());
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || !/^-?\d+$/.test(t)) return 0n;
    let x = BigInt(t);
    if (x < 0n) x = (x + (1n << 64n)) & U64_MASK;
    return x & U64_MASK;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return javaLongBitsToBigUint64(v);
  return 0n;
}

function bigUint64ToSignedBigInt(u: bigint): bigint {
  const x = u & U64_MASK;
  if (x >= 1n << 63n) return x - (1n << 64n);
  return x;
}

/** 无符号 64 位 → 可 JSON 传给后端的值（安全整数用 number，否则用十进制字符串，便于 Jackson 反序列化为 Long） */
export function signedLongBigIntToParam(v: bigint): number | string {
  if (v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(v);
  }
  return v.toString();
}

/** 8 组 4 位十六进制 IPv6 全写 → 高 64 / 低 64（有符号 int64 BigInt） */
export function ipv6FullToHiLoBigInts(full: string): [bigint, bigint] {
  const parts = String(full).trim().split(':');
  if (parts.length !== 8) return [0n, 0n];
  let bi = 0n;
  for (const p of parts) {
    const v = parseInt(p, 16);
    if (!Number.isFinite(v) || v < 0 || v > 0xffff) return [0n, 0n];
    bi = (bi << 16n) | BigInt(v);
  }
  const hiU = (bi >> 64n) & U64_MASK;
  const loU = bi & U64_MASK;
  return [bigUint64ToSignedBigInt(hiU), bigUint64ToSignedBigInt(loU)];
}

/** 高/低 64 位（Java long：number 或十进制字符串）→ 8 组 4 位小写十六进制 */
export function hiLoLongsToIpv6Full(hi: number | string, lo: number | string): string {
  const hiU = javaLongLikeToBigUint64(hi);
  const loU = javaLongLikeToBigUint64(lo);
  const bi = (hiU << 64n) | loU;
  const out: string[] = [];
  let t = bi;
  for (let i = 0; i < 8; i++) {
    const w = Number(t & 0xffffn);
    out.unshift(w.toString(16).padStart(4, '0'));
    t >>= 16n;
  }
  return out.join(':');
}

export function normalizeIpv6Full(s: string | null | undefined): string {
  if (s == null || String(s).trim() === '') return '';
  return String(s).trim().toLowerCase();
}

/**
 * 与后端 `RegExps.Network.IPV6_FULL` 一致：8 段、段间为 `:`、每段 1～4 位十六进制（无 `::`）。
 * 勿要求每段固定 4 位，否则合法地址如 `2001:db8:…`（`db8` 仅 3 位）会被误判。
 */
export function isWellFormedIpv6Full(s: string): boolean {
  const n = normalizeIpv6Full(s);
  if (n === '') return false;
  const parts = n.split(':');
  if (parts.length !== 8) return false;
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return false;
    const v = parseInt(p, 16);
    if (!Number.isFinite(v) || v < 0 || v > 0xffff) return false;
  }
  return true;
}

/** IPV6_FULL 规范串 → 128 位无符号整数，用于起止比较 */
export function ipv6FullToBigUint128(s: string): bigint {
  const n = normalizeIpv6Full(s);
  if (!isWellFormedIpv6Full(n)) return 0n;
  let v = 0n;
  for (const p of n.split(':')) {
    v = (v << 16n) | BigInt(parseInt(p, 16));
  }
  return v;
}

const U128_MAX = (1n << 128n) - 1n;

/** 128 位无符号整数 → 8 段 4 位十六进制（小写） */
export function bigUint128ToIpv6Full(v: bigint): string {
  const x = v & U128_MAX;
  const out: string[] = [];
  let t = x;
  for (let i = 0; i < 8; i++) {
    const w = Number(t & 0xffffn);
    out.unshift(w.toString(16).padStart(4, '0'));
    t >>= 16n;
  }
  return out.join(':');
}

const IPV6_ZERO_FULL = '0000:0000:0000:0000:0000:0000:0000:0000';

/**
 * 后端 `ipStart`/`ipEnd`：十进制整数字符串、BigInt 或安全整数 number → 全格式 IPv6。
 * 超过 128 位或无法解析时返回全零地址。
 */
export function decimal128LikeToIpv6Full(v: unknown): string {
  let bi: bigint;
  if (typeof v === 'bigint') {
    bi = v;
  } else if (typeof v === 'number' && Number.isFinite(v)) {
    bi = BigInt(Math.trunc(v));
  } else if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || !/^\d+$/.test(t)) return IPV6_ZERO_FULL;
    bi = BigInt(t);
  } else {
    return IPV6_ZERO_FULL;
  }
  if (bi < 0n || bi > U128_MAX) return IPV6_ZERO_FULL;
  return bigUint128ToIpv6Full(bi);
}
