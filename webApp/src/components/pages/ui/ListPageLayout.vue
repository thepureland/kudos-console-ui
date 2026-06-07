<!--
 * Unified list-page layout: toolbar + table area (with column visibility / operation-column fold) + pagination.
 * Works together with BaseListPage, useTableMaxHeight, and useOperationColumnFold.
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="list-page-layout">
    <el-card class="list-page-card">
      <div class="list-page-toolbar">
        <slot name="toolbar" />
      </div>
      <div
        class="list-page-table-wrap"
        @mousemove="operationColumn.handleTableWrapMouseMove"
        @mouseleave="operationColumn.handleTableWrapMouseLeave"
      >
        <div v-if="$slots.tableToolbar" class="list-page-table-toolbar-wrap">
          <slot name="tableToolbar" />
        </div>
        <div
          :ref="(el) => assignTableWrapRef(el)"
          class="list-page-table-area"
        >
          <operation-column-fold-toggle
            :visible="columnVisibilityPanelVisible"
            :show-text="columnPanelShowText"
            :hide-text="columnPanelHideText"
            position="left"
            @toggle-pin="toggleColumnVisibilityPanel"
          />
          <div
            v-if="columnVisibilityPanelVisible"
            ref="columnVisibilityPanelRef"
            class="list-page-column-panel"
          >
            <slot name="columnVisibilityPanel" />
          </div>
          <!--
            fold-mouseleave is a no-op: the table-wrap's own mousemove/mouseleave
            handlers own the hide schedule, so we suppress the toggle's built-in
            leave event to prevent a double-trigger that would collapse the column
            prematurely while moving from the toggle into the column itself.
          -->
          <operation-column-fold-toggle
            :visible="showOperationColumn"
            :show-text="operationColumnShowText"
            :hide-text="operationColumnHideText"
            position="right"
            @fold-mouseenter="operationColumn.handleFoldMouseEnter"
            @fold-mouseleave="() => {}"
            @toggle-pin="operationColumn.toggleOperationColumnPin"
          />
          <div class="list-page-table-slot">
            <slot />
          </div>
        </div>
        <div class="list-page-pagination-wrap">
          <slot name="pagination" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { Ref } from 'vue';
import OperationColumnFoldToggle from '../../widgets/OperationColumnFoldToggle.vue';
import { useOperationColumnFold } from '../list/useOperationColumnFold';

export default defineComponent({
  name: 'ListPageLayout',
  components: { OperationColumnFoldToggle },
  props: {
    /** Ref to the table's outer container, provided by useTableMaxHeight and used to compute the table height */
    tableWrapRef: {
      type: Object as () => Ref<HTMLElement | null>,
      required: true,
    },
    /** List-page instance (BaseListPage), used for column visibility, operation-column state, etc. */
    listPage: {
      type: Object,
      required: true,
    },
    /** Storage key for persisting the operation column's "pinned open" state, e.g. 'cacheList.operationColumnPinned' */
    operationColumnStorageKey: {
      type: String,
      required: true,
    },
    columnPanelShowText: { type: String, default: '' },
    columnPanelHideText: { type: String, default: '' },
    operationColumnShowText: { type: String, default: '' },
    operationColumnHideText: { type: String, default: '' },
  },
  emits: ['table-wrap-mounted'],
  setup(props, { emit }) {
    const listPage = props.listPage as { state: Record<string, unknown> };
    const columnVisibilityPanelRef = ref<HTMLElement | null>(null);

    function assignTableWrapRef(el: unknown) {
      const r = props.tableWrapRef;
      if (r) r.value = el as HTMLElement | null;
      if (el) emit('table-wrap-mounted');
    }

    const operationColumn = useOperationColumnFold(listPage, {
      storageKey: props.operationColumnStorageKey,
    });

    const columnVisibilityPanelVisible = computed(
      () => Boolean(listPage.state?.columnVisibilityPanelVisible)
    );
    const showOperationColumn = computed(
      () => Boolean(listPage.state?.showOperationColumn)
    );
    /**
     * Monotonically incrementing counter; BaseListPage bumps it after a search
     * that returns zero results so the watcher below can trigger the shake animation.
     */
    const emptyShakeVersion = computed(() => Number(listPage.state?.emptyShakeVersion ?? 0));

    function toggleColumnVisibilityPanel() {
      (listPage as { toggleColumnVisibilityPanel: () => void }).toggleColumnVisibilityPanel?.();
    }

    /**
     * Close the column-visibility panel when the user clicks outside both the
     * panel itself and the left-side toggle button (.table-corner-fold.is-left).
     * Delegated to BaseListPage.applyColumnVisibilityOutsideClick so the panel
     * state remains in the page layer rather than in this layout component.
     */
    function handleGlobalPointerDown(event: MouseEvent) {
      (listPage as {
        applyColumnVisibilityOutsideClick: (
          target: EventTarget | null,
          panelEl: HTMLElement | null,
          selector: string
        ) => void;
      }).applyColumnVisibilityOutsideClick?.(
        event.target,
        columnVisibilityPanelRef.value,
        '.table-corner-fold.is-left'
      );
    }

    onMounted(() => {
      document.addEventListener('mousedown', handleGlobalPointerDown);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', handleGlobalPointerDown);
    });

    /**
     * When BaseListPage signals an empty-result shake (by incrementing
     * emptyShakeVersion), wait for the DOM to settle then restart the
     * CSS shake animation on the table's empty-state elements.
     * Version 0 is the initial value before any search, so we skip it.
     */
    watch(
      emptyShakeVersion,
      (version) => {
        if (version <= 0) return;
        nextTick(() => {
          const host = props.tableWrapRef?.value;
          if (!host) return;
          const targets = host.querySelectorAll('.el-table__empty-block, .el-table__empty-text');
          targets.forEach((el) => {
            const node = el as HTMLElement;
            // Remove then force a synchronous reflow via offsetWidth so the
            // browser commits the removal before re-adding the class, which
            // restarts the CSS animation from frame 0.
            node.classList.remove('is-empty-shaking');
            void node.offsetWidth;
            node.classList.add('is-empty-shaking');
          });
        });
      }
    );

    return {
      assignTableWrapRef,
      columnVisibilityPanelRef,
      operationColumn,
      columnVisibilityPanelVisible,
      showOperationColumn,
      toggleColumnVisibilityPanel,
    };
  },
});
</script>

<style scoped>
.list-page-layout {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-page-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-page-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 5px 7px 7px 7px;
}

/* Area 1: search bar */
.list-page-toolbar {
  margin-bottom: 8px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  width: 100%;
  overflow-x: auto;
  box-sizing: border-box;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  padding: 7px 8px;
}

/* Area 2: table area (table toolbar + table + pagination) */
.list-page-table-wrap {
  margin-top: 0;
  min-width: 0;
  max-width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  padding: 7px 8px;
}

.list-page-table-toolbar-wrap {
  flex-shrink: 0;
  margin-bottom: 5px;
}

.list-page-pagination-wrap {
  flex-shrink: 0;
}
/* Pagination bar: slightly shrink the height of the jump-to input and the page-size selector */
.list-page-pagination-wrap :deep(.el-pagination .el-input__wrapper) {
  min-height: 22px !important;
  padding-top: 1px !important;
  padding-bottom: 1px !important;
}
.list-page-pagination-wrap :deep(.el-pagination .el-input__inner) {
  height: 20px !important;
  line-height: 20px !important;
}
/* el-select trigger for the page-size selector */
.list-page-pagination-wrap :deep(.el-pagination .el-select .el-input__wrapper),
.list-page-pagination-wrap :deep(.el-pagination .el-select .el-select__wrapper) {
  min-height: 22px !important;
  padding-top: 1px !important;
  padding-bottom: 1px !important;
}
.list-page-pagination-wrap :deep(.el-pagination .el-select .el-input__inner),
.list-page-pagination-wrap :deep(.el-pagination .el-select .el-select__placeholder) {
  height: 20px !important;
  line-height: 20px !important;
}

.list-page-table-area {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
}

.list-page-table-slot {
  flex: 0 0 auto;
}

/* When a search returns no results, scripts add a class to trigger a single shake; the initial pre-search state does not animate. */
.list-page-table-slot :deep(.el-table__empty-block.is-empty-shaking),
.list-page-table-slot :deep(.el-table__empty-text.is-empty-shaking) {
  animation: list-empty-shake 0.9s cubic-bezier(0.36, 0.07, 0.19, 0.97) 0.08s 1 both;
  transform-origin: center center;
  will-change: transform;
}

.list-page-column-panel {
  position: absolute;
  top: 22px;
  left: 8px;
  z-index: 35;
  min-width: 200px;
  max-width: 260px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color-overlay);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

@keyframes list-empty-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  12% {
    transform: translateX(-8px);
  }
  24% {
    transform: translateX(8px);
  }
  36% {
    transform: translateX(-6px);
  }
  48% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-3px);
  }
  72% {
    transform: translateX(3px);
  }
}
</style>
