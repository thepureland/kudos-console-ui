<!--
 * Resource add/edit
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog resource-add-edit-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
  >
    <el-form
      ref="form"
      :model="formModel"
      :rules="rules"
      label-width="140px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('resourceAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('resourceAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-cascader
            ref="parentCascaderRef"
            v-model="formModel.parent"
            :options="parentCascaderOptionsWithI18n"
            :props="cascaderProps"
            class="form-select-full"
            clearable
            @change="onParentCascaderChange"
          />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.name')" prop="name" class="is-required">
          <el-input v-model="formModel.name" :placeholder="t('resourceAddEdit.placeholders.name')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.url')" prop="url">
          <el-input v-model="formModel.url" :placeholder="t('resourceAddEdit.placeholders.url')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.icon')" prop="icon">
          <el-input v-model="formModel.icon" :placeholder="t('resourceAddEdit.placeholders.icon')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.seqNo')" prop="seqNo">
          <el-input-number v-model="formModel.seqNo" :min="0" :max="99999" controls-position="right" class="form-input-number-full" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('resourceAddEdit.sections.other') }}</div>
        <el-form-item :label="t('resourceAddEdit.labels.remark')" prop="remark">
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('formCommon.remarkPlaceholderWithMax', { max: remarkMaxLength })" :maxlength="remarkMaxLength" show-word-limit resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('resourceAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('resourceAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, nextTick, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import { loadMessagesForConfig } from '../../../i18n';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent, useCloseDropdownOnChange } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

const MENU_I18N_CONFIG = [{ i18nTypeDictCode: 'view', namespaces: ['menu'], atomicServiceCode: 'sys' as const }];

type ParentCascaderNode = {
  value: string;
  label: string;
  _level: number;
  _resourceTypeDictCode?: string;
  _subSystemCode?: string;
  nameKey?: string;
  children?: ParentCascaderNode[];
};

class ResourceFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        parent: [] as string[],
        name: null as string | null,
        url: null as string | null,
        icon: null as string | null,
        seqNo: undefined as number | undefined,
        remark: null as string | null,
      },
      /** Parent-resource cascader options (same source as the list page's left tree: loadDirectChildrenForTree); root is level 0, children lazy-loaded. */
      parentCascaderOptions: [] as Array<ParentCascaderNode>,
      /** node value -> type/subsystem/level (cascader doesn't preserve custom fields, so lazy loading uses this map to infer the level and look up type/sub). */
      parentCascaderNodeMeta: {} as Record<string, { resourceTypeDictCode: string; subSystemCode?: string; level: number }>,
      cascaderProps: {
        value: 'value',
        label: 'label',
        multiple: false,
        checkStrictly: true,
        expandTrigger: 'hover',
        lazy: true,
        lazyLoad: (node: ParentCascaderNode, resolve: (nodes: ParentCascaderNode[]) => void) => {
          (this as ResourceFormPage).lazyLoadParentCascader(node, resolve);
        },
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getResourceDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'resourceAddEdit.messages.loadFailed';
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const model = this.state.formModel as { parent?: string[]; seqNo?: number };
    const parent = model.parent ?? [];
    const length = parent.length;
    params.parentId = length <= 2 ? null : parent[length - 1];
    params.resourceTypeDictCode = parent[0] ?? null;
    params.subSystemCode = parent[1] ?? null;
    delete params.parent;
    params.orderNum = model.seqNo;
    delete params.seqNo;
    return params;
  }

  protected createRowObjectLoadParams(): any {
    const params = super.createRowObjectLoadParams()
    params["fetchAllParentIds"] = true
    return params
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const formModel = this.state.formModel as { parent?: string[]; seqNo?: number };
    if (rowObject.orderNum !== undefined && rowObject.orderNum !== null) {
      formModel.seqNo = rowObject.orderNum as number;
    }
    const rt = rowObject.resourceTypeDictCode as string | undefined;
    const sub = rowObject.subSystemCode as string | undefined;
    const pid = rowObject.parentId as string | undefined;
    const ids = Array.isArray(rowObject.parentIds) ? (rowObject.parentIds as string[]).slice() : [];
    let parent: string[] = [];
    if (rt != null && sub != null) {
      parent = ids.length > 0 ? [rt, sub, ...ids] : (pid != null ? [rt, sub, pid] : [rt, sub]);
    }
    formModel.parent = parent.length > 0 ? parent.slice() : [];
    if (parent.length > 0) {
      // Set synchronously so the UI is not momentarily blank, then re-set after
      // nextTick so the El-Cascader internal state aligns with the new value.
      nextTick(() => {
        formModel.parent = parent.slice();
      });
    }
  }

  /** Edit-mode load: first fetch the first two cascader levels to build static options, then fetch the detail and fillForm so the Parent field can be back-populated. */
  protected async loadRowObject(): Promise<void> {
    await this.buildParentCascaderOptions();
    const params = this.createRowObjectLoadParams();
    const result = await backendRequest({ url: this.getRowObjectLoadUrl(), params });
    const payload = getApiResponseData(result);
    const rowData =
      payload != null && typeof payload === 'object' && !Array.isArray(payload) && 'id' in payload
        ? payload
        : null;
    if (rowData != null) {
      const rt = rowData.resourceTypeDictCode as string | undefined;
      const sub = rowData.subSystemCode as string | undefined;
      const pid = rowData.parentId as string | undefined;
      const ids = Array.isArray(rowData.parentIds) ? (rowData.parentIds as string[]).slice() : [];
      const path: string[] =
        rt != null && sub != null
          ? ids.length > 0
            ? [rt, sub, ...ids]
            : pid != null
              ? [rt, sub, pid]
              : [rt, sub]
          : [];
      if (path.length > 1) {
        await this.ensureParentPathLoaded(path);
      }
      this.fillForm(rowData);
      super.render();
      this.onEditFormLoaded?.();
    } else {
      const i18n = (await import('../../../i18n')).i18n;
      ElMessage.error(i18n.global.t(this.getLoadFailedMessageKey()) as string);
    }
  }

  /** Called when the dialog opens; ensures the first level (resource type) is loaded. */
  public async ensureParentCascaderOptions(): Promise<void> {
    await this.buildParentCascaderOptions();
  }

  /** I18n for cascader nodes; consistent with the list tree. parentLevel 0 = resource type (nameKey = resource_type.id), 1 = subsystem (none), 1+ = specific resource (nameKey = titleKey or name, including the layer directly under the subsystem). */
  private getCascaderNodeLabel(
    item: Record<string, unknown>,
    parentLevel: number,
    t: (key: string) => string,
    te: (key: string) => boolean,
  ): { nameKey: string; label: string } {
    const id = String(item.id ?? item.value ?? '').trim();
    const name = item.name != null ? String(item.name) : '';
    const titleKey = item.titleKey != null ? String(item.titleKey) : '';
    let nameKey = '';
    if (parentLevel === 0) nameKey = id ? 'resource_type.' + id : '';
    else if (parentLevel >= 1) nameKey = titleKey || (name && name.includes('.') ? name : '');
    const label = nameKey && te(nameKey) ? t(nameKey) : (name || titleKey || id);
    return { nameKey, label };
  }

  /** Case 1: on page open, load resource types; params pass level and active (parentId is null so the backend returns the root layer correctly). */
  private async buildParentCascaderOptions(): Promise<void> {
    const opts = this.state.parentCascaderOptions as ParentCascaderNode[];
    if (opts.length > 0) return;
    const params = { level: 0, parentId: null, active: true };
    const result = await backendRequest({ url: 'sys/resource/loadDirectChildrenForTree', method: 'post', params });
    const rawList = getApiResponseData(result);
    const list = Array.isArray(rawList) ? rawList : [];
    const { i18n } = await import('../../../i18n');
    const t = (k: string) => i18n.global.t(k) as string;
    const te = (k: string) => i18n.global.te(k);
    const options: ParentCascaderNode[] = list.map((item: Record<string, unknown>) => {
      const id = String(item.id ?? item.value ?? '');
      const { nameKey, label } = this.getCascaderNodeLabel(item, 0, t, te);
      return { value: id, label, _level: 0, nameKey };
    });
    (this.state as Record<string, unknown>).parentCascaderOptions = options;
  }

  /** Find a node in the options tree by path. */
  private findNodeInOptions(opts: ParentCascaderNode[], pathSegments: string[]): ParentCascaderNode | null {
    if (pathSegments.length === 0) return null;
    const first = pathSegments[0];
    const node = opts.find((o) => o.value === first) ?? null;
    if (!node || pathSegments.length === 1) return node;
    const children = node.children;
    if (!Array.isArray(children)) return null;
    return this.findNodeInOptions(children, pathSegments.slice(1));
  }

  /** Preload each level's options along the path into the tree so the cascader can resolve correctly and display the back-populated value. */
  private async ensureParentPathLoaded(path: string[]): Promise<void> {
    if (path.length <= 1) return;
    const opts = this.state.parentCascaderOptions as ParentCascaderNode[];
    if (opts.length === 0) return;
    const metaMap = this.state.parentCascaderNodeMeta as Record<string, { resourceTypeDictCode: string; subSystemCode?: string; level: number }>;
    if (path.length >= 2) await loadMessagesForConfig(MENU_I18N_CONFIG);
    // Import once outside the loop — the bundler caches the module, but hoisting
    // makes the dependency explicit and avoids repeated async expressions.
    const { i18n } = await import('../../../i18n');
    const t = (k: string) => i18n.global.t(k) as string;
    const te = (k: string) => i18n.global.te(k);
    for (let i = 0; i < path.length - 1; i++) {
      const parentNode = this.findNodeInOptions(opts, path.slice(0, i + 1));
      if (!parentNode) return;
      if (Array.isArray(parentNode.children) && parentNode.children.length > 0) continue;
      const parentValue = path[i];
      const stored = metaMap[parentValue];
      const expandingLevel = stored != null ? stored.level : (i === 0 ? 0 : i);
      let params: Record<string, unknown>;
      if (expandingLevel === 0) {
        params = { active: true, level: 1 };
      } else if (expandingLevel === 1) {
        params = {
          active: true,
          level: 2,
          subSystemCode: parentValue,
          resourceTypeDictCode: path[0],
        };
      } else {
        params = {
          active: true,
          level: expandingLevel === 2 ? 3 : expandingLevel,
          parentId: parentValue,
        };
      }
      const result = await backendRequest({ url: 'sys/resource/loadDirectChildrenForTree', method: 'post', params });
      const rawList = getApiResponseData(result);
      const list = Array.isArray(rawList) ? rawList : [];
      const typeCode = expandingLevel === 0 ? parentValue : (stored?.resourceTypeDictCode ?? path[0]);
      const subCode = expandingLevel === 1 ? parentValue : stored?.subSystemCode;
      const childrenLevel = expandingLevel + 1;
      const nodes: ParentCascaderNode[] = list.map((item: Record<string, unknown>) => {
        const id = String(item.id ?? item.value ?? '');
        const { nameKey, label } = this.getCascaderNodeLabel(item, expandingLevel, t, te);
        metaMap[id] = { resourceTypeDictCode: typeCode, level: childrenLevel };
        if (expandingLevel >= 1 && subCode != null) metaMap[id].subSystemCode = subCode;
        return { value: id, label, _level: childrenLevel, nameKey };
      });
      parentNode.children = nodes;
    }
  }

  /**
   * Lazy-load parent-cascader children. There are 4 parameter shapes for loadDirectChildrenForTree:
   * Case 2 = resource type expanded -> load subsystems: pass only active and level
   * Case 3 = subsystem expanded -> load the first resource layer: pass active, level, subSystemCode, and resourceTypeDictCode
   * Case 4 = level > 2: pass active, level, and parentId
   */
  private async lazyLoadParentCascader(node: ParentCascaderNode, resolve: (nodes: ParentCascaderNode[]) => void): Promise<void> {
    const meta = (this.state.parentCascaderNodeMeta as Record<string, { resourceTypeDictCode: string; subSystemCode?: string; level: number }>) ?? {};
    const key = String(node.value ?? '');
    const stored = meta[key];
    const rootOpts = this.state.parentCascaderOptions as ParentCascaderNode[];
    const isRequestingRoot = rootOpts.length === 0;
    const expandingLevel = stored != null ? stored.level : 0;
    const childrenLevel = expandingLevel + 1;

    let params: Record<string, unknown>;
    if (isRequestingRoot || (expandingLevel === 0 && rootOpts.length > 0)) {
      if (isRequestingRoot) {
        // Case 1: cascader's first data fetch (page just opened); load resource types with level=0
        params = { level: 0, parentId: null, active: true };
      } else {
        // Case 2: resource type expanded; load subsystems with only active and level
        params = { active: true, level: 1 };
      }
    } else if (expandingLevel === 1) {
      // Case 3: subsystem expanded; load the first resource layer with active, level, subSystemCode, resourceTypeDictCode
      params = {
        active: true,
        level: 2,
        subSystemCode: node.value,
        resourceTypeDictCode: stored!.resourceTypeDictCode,
      };
    } else {
      // Case 4: expanding the first specific-resource layer and below; pass active, level, parentId. When expanding nodes directly under a subsystem, use level=3.
      params = {
        active: true,
        level: expandingLevel === 2 ? 3 : expandingLevel,
        parentId: node.value,
      };
    }

    if (expandingLevel >= 1) await loadMessagesForConfig(MENU_I18N_CONFIG);
    const result = await backendRequest({ url: 'sys/resource/loadDirectChildrenForTree', method: 'post', params });
    const rawList = getApiResponseData(result);
    const list = Array.isArray(rawList) ? rawList : [];
    // Bundler-cached; importing here ensures t/te are available before either branch below.
    const { i18n } = await import('../../../i18n');
    const t = (k: string) => i18n.global.t(k) as string;
    const te = (k: string) => i18n.global.te(k);

    if (isRequestingRoot) {
      const options: ParentCascaderNode[] = list.map((item: Record<string, unknown>) => {
        const id = String(item.id ?? item.value ?? '');
        const { nameKey, label } = this.getCascaderNodeLabel(item, 0, t, te);
        return { value: id, label, _level: 0, nameKey };
      });
      (this.state as Record<string, unknown>).parentCascaderOptions = options;
      resolve(options);
      return;
    }

    const typeCode = expandingLevel === 0 ? node.value : stored!.resourceTypeDictCode;
    const subCode = expandingLevel === 1 ? node.value : stored?.subSystemCode;
    const metaMap = this.state.parentCascaderNodeMeta as Record<string, { resourceTypeDictCode: string; subSystemCode?: string; level: number }>;
    const nodes: ParentCascaderNode[] = list.map((item: Record<string, unknown>) => {
      const id = String(item.id ?? item.value ?? '');
      const { nameKey, label } = this.getCascaderNodeLabel(item, expandingLevel, t, te);
      metaMap[id] = {
        resourceTypeDictCode: typeCode,
        level: childrenLevel,
      };
      if (expandingLevel >= 1 && subCode != null && subCode !== '') {
        metaMap[id].subSystemCode = subCode;
      }
      return {
        value: id,
        label,
        _level: childrenLevel,
        _resourceTypeDictCode: typeCode ?? undefined,
        _subSystemCode: subCode ?? undefined,
        nameKey,
      };
    });
    resolve(nodes);
  }

}

export default defineComponent({
  name: 'ResourceFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const result = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new ResourceFormPage(p, c),
      i18nKeyPrefix: 'resourceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['name', 'url', 'icon', 'remark'],
          arrayKeys: ['parent'],
          valueKeys: ['seqNo'],
        });
      },
      onVisible: async (result) => {
        // `result` is a Vue reactive proxy, so a method may be either the function
        // directly or wrapped in a ref-like { value: fn } object — handle both.
        const fn = (result as { ensureParentCascaderOptions?: (() => Promise<void>) | { value: () => Promise<void> } }).ensureParentCascaderOptions;
        const call = typeof fn === 'function' ? fn : (fn as { value: () => Promise<void> } | undefined)?.value;
        if (call) await call();
      },
    });
    const { t, te, locale } = useI18n();
    /**
     * Re-apply i18n labels on every locale change. The raw options store a `nameKey`
     * so we can call t() here rather than at load time, keeping labels reactive.
     * `void locale.value` is intentional: it makes Vue track the locale ref so the
     * computed re-runs whenever the language changes.
     * The `'value' in raw` check unwraps the Vue reactive proxy that may wrap the
     * array in a ref-like object depending on how the page class exposes state.
     */
    const parentCascaderOptionsWithI18n = computed(() => {
      void locale.value;
      const raw = (result as { parentCascaderOptions?: { value: ParentCascaderNode[] } | ParentCascaderNode[] }).parentCascaderOptions;
      const opts = raw != null && typeof raw === 'object' && 'value' in raw ? (raw as { value: ParentCascaderNode[] }).value : (raw as ParentCascaderNode[] | undefined);
      const list = Array.isArray(opts) ? opts : [];
      const map = (arr: ParentCascaderNode[]): ParentCascaderNode[] =>
        arr.map((opt) => ({
          ...opt,
          label: (opt.nameKey && te(opt.nameKey)) ? t(opt.nameKey) : opt.label,
          children: (opt as ParentCascaderNode & { children?: ParentCascaderNode[] }).children
            ? map((opt as ParentCascaderNode & { children: ParentCascaderNode[] }).children)
            : undefined,
        }));
      return map(list);
    });
    const parentCascaderRef = ref<{ blur: () => void; togglePopperVisible: (visible?: boolean) => void } | null>(null);
    const { closeDropdown } = useCloseDropdownOnChange();
    function onParentCascaderChange() {
      closeDropdown(parentCascaderRef);
    }
    return {
      ...result,
      parentCascaderOptionsWithI18n,
      parentCascaderRef,
      onParentCascaderChange,
    };
  },
});
</script>

