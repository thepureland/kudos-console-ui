<!-- 字典/字典项 新增/编辑 -->
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
        <el-form-item :label="t('dictAddEdit.labels.code')" prop="code" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.code"
                :placeholder="t('dictAddEdit.placeholders.code')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('dictAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.seqNo')" prop="seqNo">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input-number
                v-model="formModel.seqNo"
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
import { i18n } from '../../../i18n';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  parent: string[] | null;
  code: string | null;
  name: string | null;
  seqNo: number | undefined;
  remark: string | null;
}

interface CascaderNode {
  level: number;
  data?: { id?: string; code?: string };
}

class AddEditPage extends BaseAddEditPage {
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
        code: null,
        name: null,
        seqNo: undefined,
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
    return 'sys/dict';
  }

  /** 字典模块无 getValidationRule 接口，仅使用前端 i18n 必填规则 */
  protected async initValidationRule(): Promise<void> {
    const requiredRules = this.createRequiredRules(
      {
        parent: 'dictAddEdit.validation.requiredParent',
        code: 'dictAddEdit.validation.requiredCode',
        name: 'dictAddEdit.validation.requiredName',
      },
      { parent: 'change' }
    );
    this.state.rules = { ...requiredRules };
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDict';
  }

  protected getLoadFailedMessageKey(): string {
    return 'dictAddEdit.messages.loadFailed';
  }

  protected createRowObjectLoadParams(): Record<string, unknown> {
    const params = super.createRowObjectLoadParams() as Record<string, unknown>;
    params.isDict = this.props.isDict;
    params.fetchAllParentIds = true;
    return params;
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const model = this.state.formModel as FormModel;
    const parent = model?.parent;
    params.isDict = this.props.isDict;
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
    const isDict = this.props.isDict as boolean;
    const model = this.state.formModel as FormModel;
    model.code = isDict ? (rowObject.dictType as string) : (rowObject.itemCode as string);
    model.name = isDict ? (rowObject.dictName as string) : (rowObject.itemName as string);
    const parents: string[] = [rowObject.module as string];
    if (!isDict && rowObject.parentIds && Array.isArray(rowObject.parentIds)) {
      for (const id of rowObject.parentIds) {
        parents.push(String(id));
      }
    }
    model.parent = parents;
  }

  private async doLoadTreeNodes(node: CascaderNode, resolve: (data: unknown[]) => void): Promise<void> {
    const params: Record<string, unknown> = {
      parentId:
        node.level === 0 ? null : node.level === 1 ? node.data?.code : node.data?.id,
      firstLevel: node.level === 1,
      active: true,
    };
    const result = await backendRequest({ url: 'sys/dict/loadTreeNodes', method: 'post', params });
    if (result.code === 200 && result.data) {
      const data = result.data as Array<Record<string, unknown>>;
      const cache = this.state.parentCache as Record<string, string>;
      for (const item of data) {
        cache[String(item.id)] = String(item.code ?? '');
      }
      resolve(data);
      this.autoSelectParentWhenAdd(node, data);
    } else {
      ElMessage.error((i18n.global.t('dictAddEdit.messages.loadTreeFailed') as string) || '字典树加载失败！');
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
  name: 'DictAddEdit',
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
    isDict: {
      type: Boolean,
      default: false,
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
      createPage: (p, c) => new AddEditPage(p, c),
      i18nKeyPrefix: 'dictAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.parent != null && Array.isArray(model.parent) && model.parent.length > 0) return true;
        if (model.code != null && String(model.code).trim() !== '') return true;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.seqNo !== undefined && model.seqNo !== null) return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅字典页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
