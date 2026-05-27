import { onBeforeUnmount, ref } from 'vue';

interface UseTreeSplitResizeOptions {
  initialPercent?: number;
  minPercent?: number;
  maxPercent?: number;
}

/**
 * Tree/table split-pane drag width control; uniformly handles mousemove/mouseup binding and unmount cleanup.
 */
export function useTreeSplitResize(options: UseTreeSplitResizeOptions = {}) {
  const {
    initialPercent = 15.75,
    minPercent = 10,
    maxPercent = 50,
  } = options;

  const splitContainerRef = ref<HTMLElement | null>(null);
  const treePanelWidthPercent = ref(initialPercent);

  function stopResize() {
    document.removeEventListener('mousemove', onTreeResizeMove);
    document.removeEventListener('mouseup', stopResize);
  }

  function onTreeResizeMove(e: MouseEvent) {
    const el = splitContainerRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    treePanelWidthPercent.value = Math.min(maxPercent, Math.max(minPercent, pct));
  }

  function startTreeResize(e: MouseEvent) {
    e.preventDefault();
    document.addEventListener('mousemove', onTreeResizeMove);
    document.addEventListener('mouseup', stopResize);
  }

  onBeforeUnmount(() => {
    stopResize();
  });

  return {
    splitContainerRef,
    treePanelWidthPercent,
    startTreeResize,
  };
}
