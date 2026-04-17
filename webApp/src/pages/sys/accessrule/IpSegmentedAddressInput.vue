<!--
 * IPv4：每格最多 3 位十进制；仅失焦时将该格规范为 3 位（0–255）；输入过程中不补前导零。
 * IPv6：每格最多 4 位 hex；仅失焦时将该格规范为 4 位小写 hex；输入过程中不补前导零。
 * 粘贴：在 el-input 上使用 @paste；整段 IPv4 / 含 :: 的 IPv6 一次填满；否则按当前聚焦段起合并多段。
 * v-model：IPv4 须为后端 `IPV4_FULL` 格式（每段 3 位零补齐）；格内仍可短数字输入。IPv6 为 8 段（与 `IPV6_FULL` 一致）。
 * 键入满当前段位数（IPv4 三位 / IPv6 四位）时自动聚焦下一段。
 -->
<template>
  <div
    ref="rootRef"
    class="ip-segmented-address"
    :class="['ip-segmented-address--' + protocol, { 'ip-segmented-address--compact': compact }]"
    role="group"
  >
    <template v-if="protocol === 'ipv4'">
      <template v-for="(_, i) in v4Segs" :key="'o' + i">
        <el-input
          v-model="v4Segs[i]"
          class="ip-segmented-address__cell"
          :disabled="disabled"
          maxlength="3"
          inputmode="numeric"
          @input="onV4Input(i)"
          @blur="onV4Blur(i)"
          @focus="onIpCellFocus"
          @paste="onV4Paste($event, i)"
        />
        <span v-if="i < 3" class="ip-segmented-address__sep" aria-hidden="true">.</span>
      </template>
    </template>
    <template v-else>
      <template v-for="(_, i) in v6Segs" :key="'h' + i">
        <el-input
          v-model="v6Segs[i]"
          class="ip-segmented-address__cell ip-segmented-address__cell--v6"
          :disabled="disabled"
          maxlength="4"
          @input="onV6Input(i)"
          @blur="onV6Blur(i)"
          @focus="onIpCellFocus"
          @paste="onV6Paste($event, i)"
        />
        <span v-if="i < 7" class="ip-segmented-address__sep" aria-hidden="true">:</span>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, nextTick, onMounted, ref, watch } from 'vue';

/** 从完整 IPv4 字符串拆到各格：非零用十进制值串；数值为 0 的段格内固定为 `000`（与空表默认一致）；失焦时再 normalize 为 3 位 */
function parseIpv4Full(s: string | null | undefined): string[] {
  const d = ['000', '000', '000', '000'];
  if (s == null || String(s).trim() === '') return d;
  const parts = String(s).trim().split('.');
  if (parts.length !== 4) return d;
  for (let i = 0; i < 4; i++) {
    const n = parseInt(parts[i], 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) return ['000', '000', '000', '000'];
    d[i] = n === 0 ? '000' : String(n);
  }
  return d;
}

/** 从完整 8 段 IPv6 字符串拆到各格：非零用最短小写 hex；数值为 0 的段格内固定为 `0000`（与空表默认一致）；失焦时再按 normalize 补零 */
function parseIpv6Full(s: string | null | undefined): string[] {
  const d = Array.from({ length: 8 }, () => '0000');
  if (s == null || String(s).trim() === '') return d;
  const parts = String(s).trim().split(':');
  if (parts.length !== 8) return d;
  for (let i = 0; i < 8; i++) {
    const p = parts[i].trim().toLowerCase();
    if (!/^[0-9a-f]{1,4}$/.test(p)) return d;
    const n = parseInt(p, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return d;
    d[i] = n === 0 ? '0000' : n.toString(16);
  }
  return d;
}

/** 单格 IPv4：取数字 → 0–255 → 始终 3 位十进制字符串 */
function normalizeV4Cell(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 3);
  const n = parseInt(digits || '0', 10);
  const v = Math.min(255, Math.max(0, Number.isFinite(n) ? n : 0));
  return String(v).padStart(3, '0');
}

/** 单格 IPv6：取十六进制 → 0–ffff → 始终 4 位小写十六进制 */
function normalizeV6Cell(raw: string): string {
  let p = (raw ?? '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 4);
  const n = parseInt(p || '0', 16);
  const v = Math.min(0xffff, Math.max(0, Number.isFinite(n) ? n : 0));
  return v.toString(16).padStart(4, '0');
}

/**
 * 组 v-model 点分 IPv4：每段固定 3 位十进制（与 Java `RegExps.Network.IPV4_FULL` 一致）。
 * 格内展示仍可在输入中用短数字；此处 emit 的值必须零补齐，否则校验「须为零补齐的 IPv4」会失败。
 */
function assembleIpv4(segs: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const raw = segs[i] ?? '';
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    const n = digits.length === 0 ? 0 : parseInt(digits, 10);
    const v = Math.min(255, Math.max(0, Number.isFinite(n) ? n : 0));
    parts.push(String(v).padStart(3, '0'));
  }
  return parts.join('.');
}

/** 组 v-model 用冒号分 hex；输入过程中不对各段做 4 位补零，避免键入「a」就变成「000a」 */
function assembleIpv6(segs: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = segs[i] ?? '';
    const hex = raw.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 4);
    if (hex.length === 0) {
      out.push('0');
      continue;
    }
    const n = parseInt(hex, 16);
    const v = Math.min(0xffff, Math.max(0, Number.isFinite(n) ? n : 0));
    out.push(v.toString(16));
  }
  return out.join(':');
}

/** 剪贴板为完整 IPv4（如 192.168.0.1）时解析为 4 段，供粘贴分发 */
function tryParseIpv4Pasted(raw: string): string[] | null {
  const t = raw.replace(/\r?\n/g, '').trim();
  if (!t || t.includes(':')) return null;
  const parts = t.split('.').map((p) => p.trim());
  if (parts.length !== 4) return null;
  const segs: string[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    segs.push(n === 0 ? '000' : String(n));
  }
  return segs;
}

/**
 * 剪贴板为 IPv6（含 :: 压缩）时展开为 8 段，每段为最短小写十六进制（与输入中不补零一致）。
 * 不支持 IPv4 映射形式（含 `.`）。
 */
function tryExpandIpv6Pasted(raw: string): string[] | null {
  let t = raw.replace(/\r?\n/g, '').trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1).trim();
  if (t.includes('.')) return null;

  const hasDouble = t.includes('::');
  let all: string[];

  if (hasDouble) {
    const pair = t.split('::');
    if (pair.length !== 2) return null;
    const leftRaw = pair[0];
    const rightRaw = pair[1];
    const left = leftRaw ? leftRaw.split(':').filter((x) => x.length > 0) : [];
    const right = rightRaw ? rightRaw.split(':').filter((x) => x.length > 0) : [];
    if (left.length + right.length >= 8) return null;
    const zeros = 8 - left.length - right.length;
    if (zeros < 0) return null;
    all = [...left, ...Array(zeros).fill('0'), ...right];
  } else {
    const parts = t.split(':');
    if (parts.length !== 8) return null;
    all = parts;
  }

  if (all.length !== 8) return null;
  const out: string[] = [];
  for (const p of all) {
    const q = p.trim();
    if (q === '' || !/^[0-9a-f]{1,4}$/.test(q)) return null;
    const n = parseInt(q, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
    out.push(n === 0 ? '0000' : n.toString(16));
  }
  return out;
}

/** 从指定段起合并点分十进制片段 */
function tryMergeIpv4FromIndex(raw: string, startIdx: number, current: string[]): string[] | null {
  const t = raw.replace(/\r?\n/g, '').trim();
  if (!t || t.includes(':')) return null;
  const parts = t
    .split('.')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (parts.length === 0 || startIdx + parts.length > 4) return null;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
  }
  const out = [...current];
  for (let k = 0; k < parts.length; k++) {
    const n = parseInt(parts[k]!, 10);
    out[startIdx + k] = n === 0 ? '000' : String(n);
  }
  return out;
}

/** 从指定段起合并冒号分隔的十六进制组（无 `::`） */
function tryMergeIpv6GroupsFromIndex(raw: string, startIdx: number, current: string[]): string[] | null {
  let t = raw.replace(/\r?\n/g, '').trim().toLowerCase();
  if (!t || t.includes('.') || t.includes('::')) return null;
  const parts = t.split(':').filter((x) => x.length > 0);
  if (parts.length === 0 || startIdx + parts.length > 8) return null;
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
  }
  const out = [...current];
  for (let k = 0; k < parts.length; k++) {
    const n = parseInt(parts[k]!, 16);
    out[startIdx + k] = n === 0 ? '0000' : n.toString(16);
  }
  return out;
}

export default defineComponent({
  name: 'IpSegmentedAddressInput',
  props: {
    modelValue: { type: String, default: null },
    protocol: { type: String as () => 'ipv4' | 'ipv6', required: true },
    disabled: { type: Boolean, default: false },
    /** 收窄每格宽度（如列表筛选栏）：IPv4/IPv6 较默认略窄但仍留足可视与内边距 */
    compact: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const rootRef = ref<HTMLElement | null>(null);
    const v4Segs = ref<string[]>(parseIpv4Full(props.modelValue));
    const v6Segs = ref<string[]>(parseIpv6Full(props.modelValue));

    /** 聚焦本组件内第 segmentIndex 个分段输入（与 DOM 中 input 顺序一致） */
    function focusSegmentAt(segmentIndex: number) {
      if (props.disabled || segmentIndex < 0) return;
      nextTick(() => {
        const root = rootRef.value;
        if (!root) return;
        const inputs = root.querySelectorAll<HTMLInputElement>('input');
        const el = inputs[segmentIndex];
        if (el && !el.disabled) el.focus();
      });
    }

    function emitV4() {
      emit('update:modelValue', assembleIpv4(v4Segs.value));
    }

    function emitV6() {
      emit('update:modelValue', assembleIpv6(v6Segs.value));
    }

    watch(
      () => props.modelValue,
      (v) => {
        if (props.protocol === 'ipv4') v4Segs.value = parseIpv4Full(v);
        else v6Segs.value = parseIpv6Full(v);
      }
    );

    watch(
      () => props.protocol,
      () => {
        if (props.protocol === 'ipv4') v4Segs.value = parseIpv4Full(props.modelValue);
        else v6Segs.value = parseIpv6Full(props.modelValue);
      }
    );

    /** 聚焦时全选当前格，便于覆盖输入 */
    function onIpCellFocus(_e: FocusEvent) {
      nextTick(() => {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement && el.closest('.ip-segmented-address')) {
          el.select();
        }
      });
    }

    function onV4Input(i: number) {
      let t = (v4Segs.value[i] ?? '').replace(/\D/g, '');
      if (t.length > 3) t = t.slice(0, 3);
      const arr = [...v4Segs.value];
      arr[i] = t;
      v4Segs.value = arr;
      emitV4();
      if (t.length === 3 && i < 3) focusSegmentAt(i + 1);
    }

    function onV4Blur(i: number) {
      const arr = [...v4Segs.value];
      arr[i] = normalizeV4Cell(arr[i] ?? '');
      v4Segs.value = arr;
      emitV4();
    }

    function onV6Input(i: number) {
      let t = (v6Segs.value[i] ?? '')
        .toLowerCase()
        .replace(/[^0-9a-f]/g, '');
      if (t.length > 4) t = t.slice(0, 4);
      const arr = [...v6Segs.value];
      arr[i] = t;
      v6Segs.value = arr;
      emitV6();
      if (t.length === 4 && i < 7) focusSegmentAt(i + 1);
    }

    function onV6Blur(i: number) {
      const arr = [...v6Segs.value];
      arr[i] = normalizeV6Cell(arr[i] ?? '');
      v6Segs.value = arr;
      emitV6();
    }

    function onV4Paste(e: ClipboardEvent, startIdx: number) {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const full = tryParseIpv4Pasted(text);
      if (full) {
        e.preventDefault();
        e.stopPropagation();
        v4Segs.value = full;
        emitV4();
        return;
      }
      const merged = tryMergeIpv4FromIndex(text, startIdx, v4Segs.value);
      if (merged) {
        e.preventDefault();
        e.stopPropagation();
        v4Segs.value = merged;
        emitV4();
      }
    }

    function onV6Paste(e: ClipboardEvent, startIdx: number) {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const full = tryExpandIpv6Pasted(text);
      if (full) {
        e.preventDefault();
        e.stopPropagation();
        v6Segs.value = full;
        emitV6();
        return;
      }
      const merged = tryMergeIpv6GroupsFromIndex(text, startIdx, v6Segs.value);
      if (merged) {
        e.preventDefault();
        e.stopPropagation();
        v6Segs.value = merged;
        emitV6();
      }
    }

    onMounted(() => {
      if (props.protocol === 'ipv4') emitV4();
      else emitV6();
    });

    return {
      rootRef,
      v4Segs,
      v6Segs,
      onV4Input,
      onV4Blur,
      onV6Input,
      onV6Blur,
      onV4Paste,
      onV6Paste,
      onIpCellFocus,
    };
  },
});
</script>

<style scoped>
.ip-segmented-address {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  width: 100%;
}
.ip-segmented-address__cell {
  flex: 1 1 0;
  min-width: 0;
}
.ip-segmented-address__cell--v6 {
  flex: 1 1 0;
}
.ip-segmented-address__sep {
  flex: 0 0 auto;
  color: var(--el-text-color-regular);
  user-select: none;
  padding: 0 1px;
  font-weight: 500;
}

.ip-segmented-address :deep(.el-input__inner),
.ip-segmented-address :deep(.el-input__wrapper input) {
  text-align: center;
}

.ip-segmented-address--compact {
  width: auto;
  gap: 0;
}
.ip-segmented-address--compact .ip-segmented-address__sep {
  padding: 0;
  font-size: 12px;
}
.ip-segmented-address--compact.ip-segmented-address--ipv4 .ip-segmented-address__cell {
  flex: 0 0 auto;
  width: calc(4.5ch + 26px);
  min-width: calc(4.5ch + 26px);
  max-width: calc(4.5ch + 26px);
}
.ip-segmented-address--compact.ip-segmented-address--ipv4 .ip-segmented-address__cell :deep(.el-input__wrapper) {
  padding-left: 7px;
  padding-right: 7px;
}
.ip-segmented-address--compact.ip-segmented-address--ipv6 .ip-segmented-address__cell--v6 {
  flex: 0 0 auto;
  width: calc(5ch + 22px);
  min-width: calc(5ch + 22px);
  max-width: calc(5ch + 22px);
}
.ip-segmented-address--compact.ip-segmented-address--ipv6 .ip-segmented-address__cell :deep(.el-input__wrapper) {
  padding-left: 6px;
  padding-right: 6px;
}
</style>
