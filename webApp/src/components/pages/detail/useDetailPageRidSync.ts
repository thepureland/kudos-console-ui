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
 * Sync props.rid to page.state.rid and trigger a detail refresh when rid changes.
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
      // Skip refresh on: initial mount (oldId undefined), empty new id, or same id (no real change)
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
