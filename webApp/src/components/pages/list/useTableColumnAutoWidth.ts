import { ref, watch, nextTick, onUnmounted } from 'vue';
import type { Ref } from 'vue';

/** 自动列宽计算列配置。 */
export interface TableColumnAutoWidthConfig {
  key: string;
  /** 列头显示文案（用于测量宽度） */
  getLabel: () => string;
  /** 是否有排序图标（需预留图标宽度） */
  sortable?: boolean;
  /** 从行数据取单元格展示文案，用于按内容算宽；不传则只按列头宽度 */
  getCellText?: (row: Record<string, unknown>) => string;
}

/** 自动列宽 hook 配置。 */
export interface UseTableColumnAutoWidthOptions {
  /** 表格外层容器 ref（用于取可用宽度和表头字体） */
  containerRef: Ref<HTMLElement | null>;
  /** 参与自动算宽的列配置（仅非固定列） */
  columns: Ref<TableColumnAutoWidthConfig[]>;
  /** 表格数据，用于按内容测宽 */
  tableData: Ref<Array<Record<string, unknown>>>;
  /** 左侧固定列总宽度（选择列+序号列+固定名称列等），从可用宽度中扣除 */
  reservedWidthLeft?: number;
  /** 右侧固定列总宽度（如操作列），从可用宽度中扣除 */
  reservedWidthRight?: number;
  /** 单元格左右内边距之和（px），默认 16 */
  cellPadding?: number;
  /** 排序列预留的排序图标宽度（px），默认 24 */
  sortIconWidth?: number;
  /** 单列最小宽度（px），默认 60 */
  minColumnWidth?: number;
  /** 单列最大宽度（px），不传则不设上限 */
  maxColumnWidth?: number;
}

const DEFAULT_CELL_PADDING = 16;
const DEFAULT_SORT_ICON_WIDTH = 24;
const DEFAULT_MIN_COLUMN_WIDTH = 60;
const FALLBACK_FONT = '14px var(--el-font-family)';

/**
 * 根据列名和内容长度自动算列宽，供列表页表格共用。
 * 规则：先保证列头（含排序图标）能一行显示；再在剩余空间内按列顺序优先让前面的列尽量显示全内容。
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

  /** 获取或创建离屏测量用 div，用于测量文本宽度 */
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

  /** 在测量元素内用指定字体渲染文本并返回宽度（px） */
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

  /** 根据容器宽度、列配置与表格数据计算每列宽度并写入 columnWidths */
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

  /** 在 nextTick 中执行 compute，供外部在挂载或数据变化后主动触发 */
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
