import { watch } from 'vue';
import type { PageProps } from '../core/pageTypes';

type DetailLikePage = {
  state: Record<string, unknown>;
  loadData: () => unknown;
};

export interface UseDetailPageRidSyncOptions {
  onRidChanged?: (page: DetailLikePage, newId: string, oldId: string | undefined) => void;
}

/**
 * 同步 props.rid 到 page.state.rid，并在 rid 变化时触发详情刷新。
 */
export function useDetailPageRidSync(
  props: PageProps,
  page: DetailLikePage,
  options: UseDetailPageRidSyncOptions = {}
): void {
  watch(
    () => props.rid,
    (newRid, oldRid) => {
      const id = newRid ? String(newRid) : '';
      const oldId = oldRid != null ? String(oldRid) : undefined;
      page.state.rid = id;
      if (oldId === undefined || !id || id === oldId) return;
      if (options.onRidChanged) {
        options.onRidChanged(page, id, oldId);
        return;
      }
      page.state.detail = null;
      page.loadData();
    }
  );
}
