<!--
 * Grant menu permissions to a role (tree-based picker).
 *
 * Aligns with kudos-ms-auth's AuthRoleAdminController:
 *   GET    /api/admin/auth/role/listResourceIds?roleId=...                   → Set<resourceId>
 *   POST   /api/admin/auth/role/bindResources?roleId=...   body=[ids]        → newly created count
 *   DELETE /api/admin/auth/role/unbindResource?roleId=...&resourceId=...     → boolean
 *
 * Menu tree comes from sys/resource/pagingSearch filtered by resourceTypeDictCode='1';
 * we build the tree client-side from a flat (parentId-linked) list since we want everything
 * eagerly, not lazy-loaded as in ResourceListPage.
 *
 * Restore strategy when check-strictly=false: el-tree links parents↔children, so if we
 * default-check a parent that has unselected children, those children get force-selected.
 * To avoid that we only restore leaf ids, mirroring the original implementation's intent.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('menuAuthorization.title')" v-model="visible" width="38%" center @close="close">
    <el-tree
        ref="treeRef"
        :data="menuData"
        show-checkbox
        node-key="id"
        :check-strictly="false"
        default-expand-all
        :default-checked-keys="defaultCheckedKeys"
        :props="treeProps"
    />
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="close">{{ t('menuAuthorization.cancel') }}</el-button>
        <el-button type="primary" @click="save">{{ t('menuAuthorization.confirm') }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { defineComponent, reactive, ref, toRefs } from 'vue';
import { ElMessage, ElTree } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

interface MenuNode {
  id: string;
  name?: string | null;
  title?: string | null;
  parentId?: string | null;
  children?: MenuNode[];
}

class MenuAuthorization extends BaseDetailPage {
  public treeRef = ref<InstanceType<typeof ElTree> | null>(null);
  public treeProps = { children: 'children', label: (data: MenuNode) => data.title || data.name || data.id };
  /** All known resource ids (whole tree) — used to limit unbinds to menu-type ids only. */
  private menuIdSet: Set<string> = new Set();
  /** Snapshot of the assigned set as loaded; doSubmit() diffs against this. */
  private originalAssignedIds: Set<string> = new Set();

  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'auth/role';
  }

  protected initState(): any {
    return {
      menuData: [] as MenuNode[],
      defaultCheckedKeys: [] as string[],
    };
  }

  protected getDetailLoadUrl(): string {
    return this.getRootActionPath() + '/listResourceIds';
  }

  protected createDetailLoadParams(): any {
    return { roleId: this.props.rid };
  }

  protected async preLoad(): Promise<void> {
    const tree = await this.fetchMenuTree();
    this.state.menuData = tree;
    this.menuIdSet = new Set();
    this.collectIds(tree, this.menuIdSet);
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    const allAssigned: string[] = Array.isArray(data)
      ? data.map(String)
      : (data && typeof data === 'object'
          ? Array.from(Object.values(data as Record<string, unknown>)).map(String)
          : []);
    // Scope to menu-type ids; pre-check only leaves to avoid el-tree parent-child cascade flipping
    // grandchildren on.
    const scoped = allAssigned.filter(id => this.menuIdSet.has(id));
    this.originalAssignedIds = new Set(scoped);
    const leafChecks: string[] = [];
    this.collectLeafChecks(this.state.menuData as MenuNode[], this.originalAssignedIds, leafChecks);
    this.state.defaultCheckedKeys = leafChecks;
    super.postLoadDataSuccessfully(data);
  }

  private async fetchMenuTree(): Promise<MenuNode[]> {
    const params: Record<string, unknown> = {
      pageNo: 1,
      pageSize: 1000,
      resourceTypeDictCode: '1',
    };
    const result = await backendRequest({ url: 'sys/resource/pagingSearch', method: 'post', params });
    if (!isApiSuccessResponse(result)) {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Failed to load menus');
      return [];
    }
    const payload = getApiResponseData<{ data?: MenuNode[] } | MenuNode[]>(result);
    const flat: MenuNode[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
    return this.buildTree(flat);
  }

  private buildTree(flat: MenuNode[]): MenuNode[] {
    const byId = new Map<string, MenuNode>();
    flat.forEach(item => { byId.set(String(item.id), { ...item, children: [] }); });
    const roots: MenuNode[] = [];
    byId.forEach(node => {
      const parentId = node.parentId == null || node.parentId === '' ? null : String(node.parentId);
      if (parentId && byId.has(parentId)) {
        byId.get(parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    // Strip empty children arrays so el-tree treats them as leaves.
    const normalize = (nodes: MenuNode[]): void => {
      nodes.forEach(n => {
        if (n.children && n.children.length === 0) delete n.children;
        else if (n.children) normalize(n.children);
      });
    };
    normalize(roots);
    return roots;
  }

  private collectIds(nodes: MenuNode[] | undefined, sink: Set<string>): void {
    if (!nodes) return;
    nodes.forEach(n => {
      sink.add(String(n.id));
      if (n.children) this.collectIds(n.children, sink);
    });
  }

  private collectLeafChecks(nodes: MenuNode[] | undefined, assigned: Set<string>, sink: string[]): void {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        this.collectLeafChecks(n.children, assigned, sink);
      } else if (assigned.has(String(n.id))) {
        sink.push(String(n.id));
      }
    }
  }

  public save!: () => void;

  protected async doSave(): Promise<void> {
    const tree = this.treeRef.value;
    if (!tree) return;
    // Include parent nodes whose entire subtree is selected by passing leafOnly=false.
    const checked = new Set<string>((tree.getCheckedKeys(false) as Array<string | number>).map(k => String(k)));
    const halfChecked = new Set<string>((tree.getHalfCheckedKeys() as Array<string | number>).map(k => String(k)));
    // Persist both fully and partially checked parents — partial means "some children granted",
    // which still implies the parent menu node itself should be visible.
    halfChecked.forEach(k => checked.add(k));

    const toBind: string[] = [];
    checked.forEach(id => { if (!this.originalAssignedIds.has(id)) toBind.push(id); });
    const toUnbind: string[] = [];
    this.originalAssignedIds.forEach(id => { if (!checked.has(id)) toUnbind.push(id); });

    try {
      if (toBind.length > 0) {
        const bindUrl = `${this.getRootActionPath()}/bindResources?roleId=${encodeURIComponent(this.props.rid)}`;
        const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: toBind as unknown as Record<string, unknown> });
        if (!isApiSuccessResponse(bindResult)) {
          ElMessage.error(await resolveApiResponseMessage(bindResult) || getApiResponseMessage(bindResult) || 'Authorization failed');
          return;
        }
      }
      for (const resourceId of toUnbind) {
        const unbindResult = await backendRequest({
          url: this.getRootActionPath() + '/unbindResource',
          method: 'delete',
          params: { roleId: this.props.rid, resourceId },
        });
        if (!isApiSuccessResponse(unbindResult)) {
          ElMessage.error(await resolveApiResponseMessage(unbindResult) || getApiResponseMessage(unbindResult) || 'Authorization failed');
          return;
        }
      }
      ElMessage.success(this.tr('menuAuthorization.success'));
      this.context.emit('update:modelValue', false);
    } catch (err) {
      ElMessage.error(String(err));
    }
  }

  /** Local i18n helper; t() isn't directly accessible from a class method. */
  private tr(key: string): string {
    try {
      const win = window as unknown as { __kudosI18nTranslate?: (k: string) => string };
      const fn = win.__kudosI18nTranslate;
      return typeof fn === 'function' ? fn(key) : key;
    } catch {
      return key;
    }
  }

  protected convertThis(): void {
    super.convertThis();
    this.save = () => { this.doSave(); };
  }
}

export default defineComponent({
  name: 'MenuAuthorization',
  props: {
    modelValue: Boolean,
    rid: String,
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const { t } = useI18n();
    const page = reactive(new MenuAuthorization(props, context));
    return {
      t,
      ...toRefs(page),
      ...toRefs(page.state),
    };
  },
});
</script>

<style lang='css' scoped>
</style>
