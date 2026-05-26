import { onMounted, ref } from 'vue';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';

/** Backend microservice tree node. */
export type MicroServiceTreeNode = {
  id: string;
  name: string;
  parentId?: string | null;
  orderNum?: number | null;
  children?: MicroServiceTreeNode[];
};

/** Tree node for el-tree-select. */
export type MicroServiceTreeSelectNode = {
  value: string;
  label: string;
  children?: MicroServiceTreeSelectNode[];
};

interface UseMicroserviceTreeOptionsOptions {
  includeFlatOptions?: boolean;
}

/**
 * Load microservice tree, and optionally provide flat options (for code->label display mapping).
 */
export function useMicroserviceTreeOptions(options: UseMicroserviceTreeOptionsOptions = {}) {
  const { includeFlatOptions = false } = options;
  const microserviceTree = ref<MicroServiceTreeSelectNode[]>([]);
  const microserviceOptions = ref<Array<{ value: string; label: string }>>([]);

  function toTreeSelectNode(node: MicroServiceTreeNode): MicroServiceTreeSelectNode {
    const children = Array.isArray(node.children) && node.children.length > 0
      ? node.children.map(toTreeSelectNode)
      : undefined;
    return {
      value: String(node.id),
      label: node.name ?? String(node.id),
      ...(children ? { children } : {}),
    };
  }

  function flattenMicroServiceTree(nodes: MicroServiceTreeNode[]): Array<{ value: string; label: string }> {
    if (!Array.isArray(nodes) || nodes.length === 0) return [];
    const list: Array<{ value: string; label: string }> = [];
    for (const node of nodes) {
      list.push({ value: String(node.id), label: node.name ?? String(node.id) });
      if (Array.isArray(node.children) && node.children.length > 0) {
        list.push(...flattenMicroServiceTree(node.children));
      }
    }
    return list;
  }

  onMounted(() => {
    backendRequest({ url: 'sys/microService/getFullMicroServiceTree', method: 'get' })
      .then((result) => {
        const payload = getApiResponseData<MicroServiceTreeNode[]>(result);
        const raw = (Array.isArray(payload) ? payload : []) as MicroServiceTreeNode[];
        microserviceTree.value = raw.map(toTreeSelectNode);
        microserviceOptions.value = includeFlatOptions ? flattenMicroServiceTree(raw) : [];
      })
      .catch(() => {
        microserviceTree.value = [];
        microserviceOptions.value = [];
      });
  });

  return { microserviceTree, microserviceOptions };
}
