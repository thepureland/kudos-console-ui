import { computed, nextTick, ref } from 'vue';

/** Column drag-and-sort options. */
export interface UseColumnOrderDragOptions {
  /** Called after the column order changes and is persisted (e.g. for nextTick(forceFixedLeftWidth)) */
  onOrderChange?: () => void;
  /** Normalize the order once after reading from localStorage (e.g. force a column to always follow another) */
  normalizeOrder?: (order: string[]) => string[];
}

/**
 * Shared list-page logic for "persist column order + drag-to-reorder column headers".
 * Reads/writes the column order from localStorage and exposes orderedColumnKeys plus drag event handlers.
 *
 * @param storageKey localStorage key, e.g. 'tenantList.columnOrder'
 * @param allColumnKeys keys of all reorderable columns on the current page (excluding index/selection)
 * @param options.onOrderChange called after the order changes, optional
 */
export function useColumnOrderDrag(
  storageKey: string,
  allColumnKeys: string[],
  options?: UseColumnOrderDragOptions
) {
  const onOrderChange = options?.onOrderChange;
  const normalizeOrder = options?.normalizeOrder;

  /** Read the column order from localStorage; return a copy of allColumnKeys if invalid or missing, optionally running normalizeOrder */
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

  /** Persist the column order to localStorage */
  function saveColumnOrder(order: string[]) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(order));
  }

  const columnOrder = ref<string[]>(loadColumnOrder());

  /**
   * Reactively re-derives the ordered key list from columnOrder.
   * The filtering logic mirrors loadColumnOrder so that columns added after the stored order
   * was saved are appended at the end rather than silently dropped.
   */
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

  /** Move the dragged column to toKey's position, update columnOrder, persist, and trigger onOrderChange */
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
