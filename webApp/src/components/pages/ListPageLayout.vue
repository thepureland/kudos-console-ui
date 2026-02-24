<!--
 * 列表页统一布局：工具栏 + 表格区（含栏位可见性/操作列折角）+ 分页。
 * 与 BaseListPage、useTableMaxHeight、useOperationColumnFold 配合使用。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="list-page-layout">
    <el-card class="list-page-card">
      <slot name="toolbar" />
      <div
        :ref="(el) => assignTableWrapRef(el)"
        class="list-page-table-wrap"
        @mousemove="operationColumn.handleTableWrapMouseMove"
        @mouseleave="operationColumn.handleTableWrapMouseLeave"
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
        <operation-column-fold-toggle
          :visible="showOperationColumn"
          :show-text="operationColumnShowText"
          :hide-text="operationColumnHideText"
          position="right"
          @fold-mouseenter="operationColumn.handleFoldMouseEnter"
          @fold-mouseleave="() => {}"
          @toggle-pin="operationColumn.toggleOperationColumnPin"
        />
        <slot />
      </div>
      <slot name="pagination" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import OperationColumnFoldToggle from '../widgets/OperationColumnFoldToggle.vue';
import { useOperationColumnFold } from './useOperationColumnFold';

export default defineComponent({
  name: 'ListPageLayout',
  components: { OperationColumnFoldToggle },
  props: {
    /** 表格外层容器的 ref，由 useTableMaxHeight 提供，用于计算表格高度 */
    tableWrapRef: {
      type: Object as () => Ref<HTMLElement | null>,
      required: true,
    },
    /** 列表页实例（BaseListPage），用于列可见性、操作列状态等 */
    listPage: {
      type: Object,
      required: true,
    },
    /** 操作列「固定展开」持久化的 storage key，如 'cacheList.operationColumnPinned' */
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

    function toggleColumnVisibilityPanel() {
      (listPage as { toggleColumnVisibilityPanel: () => void }).toggleColumnVisibilityPanel?.();
    }

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
}

.list-page-table-wrap {
  position: relative;
  margin-top: 8px;
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
</style>
