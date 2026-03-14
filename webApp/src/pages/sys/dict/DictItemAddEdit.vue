<!-- 字典项 新增/编辑（内容复制自 DictAddEdit.vue） -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog dict-add-edit-dialog"
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
        <div class="form-section__title">{{ t('dictAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('dictAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-cascader
                v-model="formModel.parent"
                :props="cascaderProps"
                class="form-select-full"
                clearable
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.code')" prop="itemCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.itemCode"
                :placeholder="t('dictAddEdit.placeholders.code')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.name')" prop="itemName" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.itemName"
                :placeholder="t('dictAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.seqNo')" prop="orderNum">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input-number
                v-model="formModel.orderNum"
                :min="0"
                :max="999999999"
                :placeholder="t('dictAddEdit.placeholders.seqNo')"
                controls-position="right"
                class="form-input-number-full"
              />
            </el-col>
          </el-row>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('dictAddEdit.sections.other') }}</div>
        <el-form-item :label="t('dictAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('dictAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('dictAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('dictAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ElMessage } from 'element-plus';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest } from '../../../utils/backendRequest';
import { i18n, loadMessagesForConfig } from '../../../i18n';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  parent: string[] | null;
  itemCode: string | null;
  itemName: string | null;
  orderNum: number | undefined;
  remark: string | null;
}

interface CascaderNode {
  level: number;
  data?: { id?: string; code?: string; atomicServiceCode?: string; dictType?: string };
}

class DictItemAddEditPage extends BaseAddEditPage {
  private defaultModule: string = '';
  private defaultDictType: string = '';

  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.defaultModule = (props.module as string) ?? '';
    this.defaultDictType = (props.dictType as string) ?? '';
  }

  protected initState(): Record<string, unknown> {
    const self = this;
    return {
      formModel: {
        parent: null,
        itemCode: null,
        itemName: null,
        orderNum: undefined,
        remark: null,
      } as FormModel,
      cascaderProps: {
        lazy: true,
        value: 'id',
        label: 'name',
        multiple: false,
        checkStrictly: true,
        expandTrigger: 'hover',
        lazyLoad(node: CascaderNode, resolve: (data: unknown[]) => void) {
          self.doLoadTreeNodes(node, resolve);
        },
      },
      parentCache: {} as Record<string, string>,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/dictItem';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDictItem';
  }

  protected getLoadFailedMessageKey(): string {
    return 'dictAddEdit.messages.loadFailed';
  }

  protected createRowObjectLoadParams(): Record<string, unknown> {
    const params = super.createRowObjectLoadParams() as Record<string, unknown>;
    params.fetchAllParentIds = true;
    return params;
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const model = this.state.formModel as FormModel;
    const parent = model?.parent;
    if (parent && parent.length > 0) {
      params.module = parent[0];
      params.parentId = parent.length === 1 ? null : parent[parent.length - 1];
      params.dictId = parent.length === 1 ? null : parent[1];
      params.dictType =
        parent.length === 1 ? null : (this.state.parentCache as Record<string, string>)[parent[1]] ?? null;
    }
    return params;
  }

  protected doSubmit(): void {
    const model = this.state.formModel as FormModel;
    if (!model?.parent || model.parent.length === 0) {
      ElMessage.error(i18n.global.t('dictAddEdit.validation.requiredParent') as string);
      return;
    }
    super.doSubmit();
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const model = this.state.formModel as FormModel;
    model.itemCode = rowObject.itemCode as string;
    model.itemName = rowObject.itemName as string;
    model.orderNum = rowObject.orderNum as number | undefined;
    const parents: string[] = [rowObject.module as string];
    if (rowObject.parentIds && Array.isArray(rowObject.parentIds)) {
      for (const id of rowObject.parentIds) {
        parents.push(String(id));
      }
    }
    model.parent = parents;
  }

  /** 第三层及以下（字典项）节点名称：优先 dict-item 国际化 t(dictType.itemCode)，否则 itemName/code。需先 loadMessagesForConfig。 */
  private transDictItemName(dictType: string, itemCode: string, itemName: string): string {
    if (!itemCode) return itemName || '';
    const key = dictType + '.' + itemCode;
    const translated = i18n.global.t(key) as string;
    return (translated !== key ? translated : null) ?? itemName ?? itemCode;
  }

  /** 上级级联数据加载方式与列表页树一致：level0 原子服务 → level1 字典类型 → level2 字典项 → level3+ 子项 */
  private async doLoadTreeNodes(node: CascaderNode, resolve: (data: unknown[]) => void): Promise<void> {
    const activeOnly = true;
    const cache = this.state.parentCache as Record<string, string>;
    try {
      if (node.level === 0) {
        if (this.getAtomicServices().length === 0) {
          await this.loadAtomicServices();
        }
        const items = this.getAtomicServices();
        const nodes = items.map((item: { code: string; name: string }) => ({
          id: item.code,
          code: item.code,
          name: item.name,
          disabled: true, // 第一层仅用于展开，不允许选择
        }));
        resolve(nodes);
        this.autoSelectParentWhenAdd(node, nodes as Array<Record<string, unknown>>);
        return;
      }
      if (node.level === 1) {
        const atomicServiceCode = (node.data?.code ?? '') as string;
        const result = await backendRequest({
          url: 'sys/dict/getDictTypesByAtomicServiceCode',
          method: 'get',
          params: { atomicServiceCode, activeOnly },
        });
        const raw = result != null && typeof result === 'object' && !Array.isArray(result)
          ? (result.data != null && typeof result.data === 'object' ? result.data : result)
          : {};
        const map = raw as Record<string, string>;
        const nodes = Object.entries(map).map(([id, dictType]) => {
          cache[id] = dictType;
          return { id, code: dictType, name: dictType, atomicServiceCode };
        });
        resolve(nodes);
        this.autoSelectParentWhenAdd(node, nodes as Array<Record<string, unknown>>);
        return;
      }
      if (node.level === 2) {
        const atomicServiceCode = (node.data?.atomicServiceCode ?? '') as string;
        const dictType = (node.data?.code ?? '') as string;
        await loadMessagesForConfig([{ i18nTypeDictCode: 'dict-item', namespaces: [dictType], atomicServiceCode }]);
        const result = await backendRequest({
          url: 'sys/dictItem/getDirectChildrenOfDict',
          method: 'get',
          params: { atomicServiceCode, dictType, activeOnly },
        });
        const list = Array.isArray(result) ? result : (result?.data != null && Array.isArray(result.data) ? result.data : []);
        const nodes = list.map((item: { id: string; itemCode?: string; itemName?: string }) => {
          const code = item.itemCode ?? '';
          return {
            id: item.id,
            code,
            name: this.transDictItemName(dictType, code, item.itemName ?? ''),
            atomicServiceCode,
            dictType,
          };
        });
        resolve(nodes);
        return;
      }
      const atomicServiceCode = (node.data?.atomicServiceCode ?? '') as string;
      const dictType = (node.data?.dictType ?? '') as string;
      const itemCode = (node.data?.code ?? '') as string;
      await loadMessagesForConfig([{ i18nTypeDictCode: 'dict-item', namespaces: [dictType], atomicServiceCode }]);
      const result = await backendRequest({
        url: 'sys/dictItem/getDirectChildrenOfItem',
        method: 'get',
        params: { atomicServiceCode, dictType, itemCode, activeOnly },
      });
      const list = Array.isArray(result) ? result : (result?.data != null && Array.isArray(result.data) ? result.data : []);
      const nodes = list.map((item: { id: string; itemCode?: string; itemName?: string }) => {
        const code = item.itemCode ?? '';
        return {
          id: item.id,
          code,
          name: this.transDictItemName(dictType, code, item.itemName ?? ''),
          atomicServiceCode,
          dictType,
        };
      });
      resolve(nodes);
    } catch {
      ElMessage.error((i18n.global.t('dictAddEdit.messages.loadTreeFailed') as string) || '字典树加载失败！');
      resolve([]);
    }
  }

  private autoSelectParentWhenAdd(node: CascaderNode, data: Array<Record<string, unknown>>): void {
    if (this.props.rid) return;
    const model = this.state.formModel as FormModel;
    if (node.level === 0 && this.defaultModule) {
      model.parent = [this.defaultModule];
    } else if (node.level === 1 && this.defaultDictType) {
      for (const item of data) {
        if (item.code === this.defaultDictType) {
          model.parent = [this.defaultModule, String(item.id)];
          break;
        }
      }
    }
  }

  protected convertThis(): void {
    super.convertThis();
  }
}

export default defineComponent({
  name: 'DictItemAddEdit',
  components: {},
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
      type: String,
      default: '',
    },
    module: {
      type: String,
      default: '',
    },
    dictType: {
      type: String,
      default: '',
    },
    onSaved: {
      type: Function as (params: Record<string, unknown>) => void,
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new DictItemAddEditPage(p, c),
      i18nKeyPrefix: 'dictItemAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.parent != null && Array.isArray(model.parent) && model.parent.length > 0) return true;
        if (model.itemCode != null && String(model.itemCode).trim() !== '') return true;
        if (model.itemName != null && String(model.itemName).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.orderNum !== undefined && model.orderNum !== null) return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅字典项页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
