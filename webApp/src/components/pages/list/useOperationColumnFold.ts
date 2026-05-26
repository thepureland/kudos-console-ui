import { ref, onMounted, onUnmounted } from 'vue';

/** Operation-column fold control options. */
export interface UseOperationColumnFoldOptions {
  /** localStorage key used to persist "is the operation column pinned open" */
  storageKey: string;
  /** Operation column width (px), used to compute the right-side hit area */
  columnWidth?: number;
  /** Width of the hit-band to the right of the operation column (px) */
  bandPadding?: number;
  /** Delay before hiding after mouse leave (ms) */
  hideDelayMs?: number;
}

const DEFAULT_COLUMN_WIDTH = 180;
const DEFAULT_BAND_PADDING = 12;
const DEFAULT_HIDE_DELAY_MS = 120;

/**
 * Operation-column fold logic: expand on hover, collapse after a delay on leave, click to pin/unpin, state persisted to localStorage.
 * For list pages working with BaseListPage; listPage.state must expose showOperationColumn.
 */
export function useOperationColumnFold(
  listPage: { state: { showOperationColumn?: boolean } },
  options: UseOperationColumnFoldOptions
) {
  const {
    storageKey,
    columnWidth = DEFAULT_COLUMN_WIDTH,
    bandPadding = DEFAULT_BAND_PADDING,
    hideDelayMs = DEFAULT_HIDE_DELAY_MS,
  } = options;

  const operationColumnPinned = ref(false);
  const operationColumnHideTimer = ref<number | null>(null);

  /** Sync listPage.state.showOperationColumn */
  function setOperationColumnVisible(visible: boolean) {
    (listPage.state as { showOperationColumn: boolean }).showOperationColumn = visible;
  }

  function clearOperationColumnHideTimer() {
    if (operationColumnHideTimer.value !== null) {
      window.clearTimeout(operationColumnHideTimer.value);
      operationColumnHideTimer.value = null;
    }
  }

  /** Hide the operation column after hideDelayMs if not pinned */
  function scheduleHideOperationColumn() {
    clearOperationColumnHideTimer();
    operationColumnHideTimer.value = window.setTimeout(() => {
      if (!operationColumnPinned.value) {
        setOperationColumnVisible(false);
      }
      operationColumnHideTimer.value = null;
    }, hideDelayMs);
  }

  /** Persist the pinned state of the operation column to localStorage */
  function persistOperationColumnPinned() {
    window.localStorage.setItem(storageKey, JSON.stringify(operationColumnPinned.value));
  }

  function handleFoldMouseEnter() {
    if (!operationColumnPinned.value) {
      clearOperationColumnHideTimer();
      setOperationColumnVisible(true);
    }
  }

  /** While moving over the table container, cancel hiding if inside the operation column or the right-hand hit band; otherwise schedule the delayed hide */
  function handleTableWrapMouseMove(event: MouseEvent) {
    if (operationColumnPinned.value) return;
    if (!(listPage.state as { showOperationColumn: boolean }).showOperationColumn) return;
    const wrap = event.currentTarget as HTMLElement | null;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const target = event.target as HTMLElement | null;
    const inOperationColumnByTarget = Boolean(
      target?.closest?.('.operation-column')
    );
    const inOperationBand =
      event.clientX >= rect.right - columnWidth - bandPadding &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (inOperationColumnByTarget || inOperationBand) {
      clearOperationColumnHideTimer();
    } else {
      scheduleHideOperationColumn();
    }
  }

  /** When the mouse leaves the table container, schedule a delayed hide if not pinned */
  function handleTableWrapMouseLeave() {
    if (!operationColumnPinned.value) {
      scheduleHideOperationColumn();
    }
  }

  /** Toggle the operation column's pinned state and persist it; show immediately when pinning, hide immediately when unpinning */
  function toggleOperationColumnPin() {
    if (operationColumnPinned.value) {
      operationColumnPinned.value = false;
      clearOperationColumnHideTimer();
      setOperationColumnVisible(false);
    } else {
      operationColumnPinned.value = true;
      clearOperationColumnHideTimer();
      setOperationColumnVisible(true);
    }
    persistOperationColumnPinned();
  }

  onMounted(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        operationColumnPinned.value = JSON.parse(raw) === true;
        if (operationColumnPinned.value) {
          setOperationColumnVisible(true);
        }
      } catch {
        // ignore
      }
    }
  });

  onUnmounted(() => {
    clearOperationColumnHideTimer();
  });

  return {
    operationColumnPinned,
    handleFoldMouseEnter,
    handleTableWrapMouseMove,
    handleTableWrapMouseLeave,
    toggleOperationColumnPin,
  };
}
