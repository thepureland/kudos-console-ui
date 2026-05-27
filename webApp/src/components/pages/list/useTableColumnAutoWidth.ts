import { ref, watch, nextTick, onUnmounted } from 'vue';
import type { Ref } from 'vue';

/** Per-column config for auto-width calculation. */
export interface TableColumnAutoWidthConfig {
  key: string;
  /** Header display text (used to measure width) */
  getLabel: () => string;
  /** Whether the column has a sort icon (reserve icon width) */
  sortable?: boolean;
  /** Pull the cell display text from a row, used for content-based widths; if omitted, only the header width is considered */
  getCellText?: (row: Record<string, unknown>) => string;
}

/** Auto column-width hook options. */
export interface UseTableColumnAutoWidthOptions {
  /** Outer table container ref (used to read available width and header font) */
  containerRef: Ref<HTMLElement | null>;
  /** Configs of columns participating in auto-width (non-fixed columns only) */
  columns: Ref<TableColumnAutoWidthConfig[]>;
  /** Table data, used for content-based measurement */
  tableData: Ref<Array<Record<string, unknown>>>;
  /** Total width of left fixed columns (selection + index + fixed name, etc.), subtracted from the available width */
  reservedWidthLeft?: number;
  /** Total width of right fixed columns (e.g. operations), subtracted from the available width */
  reservedWidthRight?: number;
  /** Sum of left and right cell padding (px), default 16 */
  cellPadding?: number;
  /** Reserved sort-icon width for sortable columns (px), default 24 */
  sortIconWidth?: number;
  /** Minimum column width (px), default 60 */
  minColumnWidth?: number;
  /** Maximum column width (px); if omitted, no upper bound */
  maxColumnWidth?: number;
}

const DEFAULT_CELL_PADDING = 16;
const DEFAULT_SORT_ICON_WIDTH = 24;
const DEFAULT_MIN_COLUMN_WIDTH = 60;
const FALLBACK_FONT = '14px var(--el-font-family)';

/**
 * Auto-compute column widths from column names and content lengths, shared across list-page tables.
 * Rules: first ensure each header (including the sort icon) fits on one line, then within the remaining space prefer to fully display leading columns' content in order.
 */
export function useTableColumnAutoWidth(options: UseTableColumnAutoWidthOptions) {
  const {
    containerRef,
    columns,
    tableData,
    reservedWidthLeft = 0,
    reservedWidthRight = 0,
    cellPadding = DEFAULT_CELL_PADDING,
    sortIconWidth = DEFAULT_SORT_ICON_WIDTH,
    minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
    maxColumnWidth,
  } = options;

  const columnWidths = ref<Record<string, number>>({});

  let measureEl: HTMLDivElement | null = null;

  /** Get or create the off-screen measurement div used to measure text width */
  function getMeasureEl(): HTMLDivElement {
    if (measureEl) return measureEl;
    measureEl = document.createElement('div');
    measureEl.setAttribute('aria-hidden', 'true');
    measureEl.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;';
    document.body.appendChild(measureEl);
    return measureEl;
  }

  function getHeaderFont(container: HTMLElement): string {
    const th = container.querySelector('.el-table th .cell, .el-table th');
    if (th) {
      const style = window.getComputedStyle(th);
      const font = style.getPropertyValue('font-size') && style.getPropertyValue('font-family')
        ? `${style.fontSize} ${style.fontFamily}`
        : FALLBACK_FONT;
      return font;
    }
    return FALLBACK_FONT;
  }

  /** Render text inside the measurement element with the given font and return the width in px */
  function measureText(text: string, font: string): number {
    if (text == null || text === '') return 0;
    const el = getMeasureEl();
    const prevFont = el.style.font;
    el.style.font = font;
    const span = document.createElement('span');
    span.textContent = String(text);
    el.appendChild(span);
    const w = span.offsetWidth;
    el.removeChild(span);
    el.style.font = prevFont;
    return Math.ceil(w);
  }

  /** Compute each column's width from the container width, column configs, and table data, and write into columnWidths */
  function compute() {
    const container = containerRef.value;
    const cols = columns.value;
    const data = Array.isArray(tableData.value) ? tableData.value : [];

    if (!container || !cols.length) {
      columnWidths.value = {};
      return;
    }

    const font = getHeaderFont(container);
    const availableWidth =
      container.clientWidth - reservedWidthLeft - reservedWidthRight;
    if (availableWidth <= 0) {
      columnWidths.value = {};
      return;
    }

    const headerWidths: number[] = [];
    const contentWidths: number[] = [];

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const label = col.getLabel();
      const headerW =
        measureText(label, font) +
        (col.sortable ? sortIconWidth : 0) +
        cellPadding;
      headerWidths[i] = Math.max(minColumnWidth, Math.ceil(headerW));

      let contentW = 0;
      if (col.getCellText && Array.isArray(data) && data.length > 0) {
        for (let r = 0; r < data.length; r++) {
          const cellText = col.getCellText(data[r] as Record<string, unknown>);
          const w = measureText(String(cellText ?? ''), font) + cellPadding;
          if (w > contentW) contentW = w;
        }
      }
      contentWidths[i] =
        maxColumnWidth != null && contentW > maxColumnWidth
          ? maxColumnWidth
          : Math.max(headerWidths[i], contentW || headerWidths[i]);
    }

    const desiredWidths = headerWidths.map((hw, i) =>
      Math.max(hw, contentWidths[i])
    );

    const totalHeaderMin = headerWidths.reduce((a, b) => a + b, 0);
    const widths: number[] = [];

    if (availableWidth < totalHeaderMin) {
      widths.push(...headerWidths);
    } else {
      const totalDesired = desiredWidths.reduce((a, b) => a + b, 0);
      if (totalDesired <= availableWidth) {
        for (let i = 0; i < cols.length; i++) {
          let w = desiredWidths[i];
          if (maxColumnWidth != null && w > maxColumnWidth) w = maxColumnWidth;
          widths.push(Math.max(headerWidths[i], w));
        }
      } else {
        let extra = availableWidth - totalHeaderMin;
        for (let i = 0; i < cols.length; i++) {
          const headerMin = headerWidths[i];
          const need = Math.max(0, (desiredWidths[i] ?? headerMin) - headerMin);
          const give = Math.min(need, extra);
          const w = headerMin + give;
          const clamped =
            maxColumnWidth != null
              ? Math.min(Math.round(w), maxColumnWidth)
              : Math.round(w);
          widths.push(Math.max(headerMin, clamped));
          extra -= give;
        }
      }
    }

    const result: Record<string, number> = {};
    cols.forEach((col, i) => {
      result[col.key] = Math.max(headerWidths[i], widths[i] ?? headerWidths[i]);
    });
    columnWidths.value = result;
  }

  /** Run compute in nextTick; callers trigger this manually after mount or data changes */
  function run() {
    nextTick(() => compute());
  }

  watch(
    [containerRef, columns, tableData],
    () => run(),
    { deep: true }
  );

  let resizeObserver: ResizeObserver | null = null;
  watch(
    containerRef,
    (el) => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (el) {
        resizeObserver = new ResizeObserver(() => run());
        resizeObserver.observe(el);
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = null;
    if (measureEl && measureEl.parentNode) {
      measureEl.parentNode.removeChild(measureEl);
    }
    measureEl = null;
  });

  return { columnWidths, run };
}
