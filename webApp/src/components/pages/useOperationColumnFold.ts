import { ref, onMounted, onUnmounted } from 'vue';

export interface UseOperationColumnFoldOptions {
  /** 本地存储 key，用于持久化「操作列是否固定展开」 */
  storageKey: string;
  /** 操作列宽度（px），用于计算右侧触达区域 */
  columnWidth?: number;
  /** 操作列右侧触达带宽度（px） */
  bandPadding?: number;
  /** 鼠标离开后延迟隐藏（ms） */
  hideDelayMs?: number;
}

const DEFAULT_COLUMN_WIDTH = 180;
const DEFAULT_BAND_PADDING = 12;
const DEFAULT_HIDE_DELAY_MS = 120;

/**
 * 操作列折角逻辑：悬停展开、离开延迟收起、点击固定/取消固定，状态持久化到 localStorage。
 * 用于与 BaseListPage 配合的列表页，listPage.state 需有 showOperationColumn。
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

  /** 同步 listPage.state.showOperationColumn */
  function setOperationColumnVisible(visible: boolean) {
    (listPage.state as { showOperationColumn: boolean }).showOperationColumn = visible;
  }

  function clearOperationColumnHideTimer() {
    if (operationColumnHideTimer.value !== null) {
      window.clearTimeout(operationColumnHideTimer.value);
      operationColumnHideTimer.value = null;
    }
  }

  /** 在 hideDelayMs 后若未固定则隐藏操作列 */
  function scheduleHideOperationColumn() {
    clearOperationColumnHideTimer();
    operationColumnHideTimer.value = window.setTimeout(() => {
      if (!operationColumnPinned.value) {
        setOperationColumnVisible(false);
      }
      operationColumnHideTimer.value = null;
    }, hideDelayMs);
  }

  /** 将操作列是否固定写入 localStorage */
  function persistOperationColumnPinned() {
    window.localStorage.setItem(storageKey, JSON.stringify(operationColumnPinned.value));
  }

  function handleFoldMouseEnter() {
    if (!operationColumnPinned.value) {
      clearOperationColumnHideTimer();
      setOperationColumnVisible(true);
    }
  }

  /** 在表格容器上移动时，若在操作列或右侧触达带内则取消隐藏，否则延迟隐藏 */
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

  /** 鼠标离开表格容器时，若未固定则延迟隐藏操作列 */
  function handleTableWrapMouseLeave() {
    if (!operationColumnPinned.value) {
      scheduleHideOperationColumn();
    }
  }

  /** 切换操作列固定状态并持久化，固定时立即显示、取消时立即隐藏 */
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
