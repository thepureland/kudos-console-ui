import { computed, ref } from 'vue';
import { nextTick } from 'vue';

export interface UseColumnOrderDragOptions {
  /** 列顺序变更并持久化后调用（如用于 nextTick(forceFixedLeftWidth)） */
  onOrderChange?: () => void;
  /** 从 localStorage 读取后对顺序做一次规范化（如强制某列紧跟某列） */
  normalizeOrder?: (order: string[]) => string[];
}

/**
 * 列表页「列顺序持久化 + 表头拖拽排序」通用逻辑。
 * 从 localStorage 读取/写入列顺序，提供 orderedColumnKeys 与拖拽事件处理函数。
 *
 * @param storageKey localStorage key，如 'tenantList.columnOrder'
 * @param allColumnKeys 当前页所有可排序列的 key（不含 index/selection）
 * @param options.onOrderChange 顺序变更后调用，可选
 */
export function useColumnOrderDrag(
  storageKey: string,
  allColumnKeys: string[],
  options?: UseColumnOrderDragOptions
) {
  const onOrderChange = options?.onOrderChange;
  const normalizeOrder = options?.normalizeOrder;

  /** 从 localStorage 读取列顺序，无效或缺失时返回 allColumnKeys 副本，并可选执行 normalizeOrder */
  function loadColumnOrder(): string[] {
    if (typeof window === 'undefined') return [...allColumnKeys];
    try {
      const raw = window.localStorage.getItem(storageKey);
      let ordered: string[];
      if (!raw) {
        ordered = [...allColumnKeys];
      } else {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) ordered = [...allColumnKeys];
        else {
          const set = new Set(allColumnKeys);
          ordered = (parsed as string[]).filter((k) => set.has(k));
          const missing = allColumnKeys.filter((k) => !ordered.includes(k));
          ordered = ordered.length ? [...ordered, ...missing] : [...allColumnKeys];
        }
      }
      return normalizeOrder ? normalizeOrder(ordered) : ordered;
    } catch {
      return [...allColumnKeys];
    }
  }

  /** 将列顺序持久化到 localStorage */
  function saveColumnOrder(order: string[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(order));
  }

  const columnOrder = ref<string[]>(loadColumnOrder());

  const orderedColumnKeys = computed(() => {
    const order = columnOrder.value;
    if (!order.length) return [...allColumnKeys];
    const set = new Set(allColumnKeys);
    const ordered = order.filter((k) => set.has(k));
    const missing = allColumnKeys.filter((k) => !ordered.includes(k));
    return ordered.length ? [...ordered, ...missing] : [...allColumnKeys];
  });

  const columnDragKey = ref<string | null>(null);
  const columnDropTargetKey = ref<string | null>(null);

  function onHeaderDragStart(e: DragEvent, key: string) {
    columnDragKey.value = key;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function onHeaderDragOver(e: DragEvent, toKey: string) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    columnDropTargetKey.value = toKey;
  }

  /** 将拖拽列放到 toKey 位置，更新 columnOrder、持久化并触发 onOrderChange */
  function applyColumnDrop(toKey: string) {
    const fromKey = columnDragKey.value;
    columnDragKey.value = null;
    columnDropTargetKey.value = null;
    if (!fromKey || fromKey === toKey) return;
    const order = [...orderedColumnKeys.value];
    const fromIndex = order.indexOf(fromKey);
    const toIndex = order.indexOf(toKey);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [removed] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, removed);
    columnOrder.value = order;
    saveColumnOrder(order);
    nextTick(() => onOrderChange?.());
  }

  function onHeaderDrop(e: DragEvent, toKey: string) {
    e.preventDefault();
    e.stopPropagation();
    applyColumnDrop(toKey);
  }

  function onTableDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
    if (keyEl) columnDropTargetKey.value = keyEl.getAttribute('data-column-key');
  }

  function onTableDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const keyEl = (e.target as HTMLElement)?.closest?.('[data-column-key]');
    const toKey = keyEl?.getAttribute('data-column-key') ?? columnDropTargetKey.value;
    if (toKey) applyColumnDrop(toKey);
  }

  function onHeaderDragEnd() {
    columnDragKey.value = null;
    columnDropTargetKey.value = null;
  }

  return {
    orderedColumnKeys,
    columnDragKey,
    columnDropTargetKey,
    onHeaderDragStart,
    onHeaderDragOver,
    onHeaderDrop,
    onHeaderDragEnd,
    onTableDragOver,
    onTableDrop,
  };
}
