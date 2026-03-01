<!--
 * 资源添加/编辑
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    v-model="visible"
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
          <el-cascader v-model="formModel.parent" :props="cascaderProps" class="form-select-full" />
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
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('resourceAddEdit.placeholders.remark')" maxlength="200" show-word-limit resize="none" />
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
import { defineComponent, reactive, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';

class AddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  protected initState(): Record<string, unknown> {
    const _self = this;
    return {
      formModel: {
        parent: [] as string[],
        name: null as string | null,
        url: null as string | null,
        icon: null as string | null,
        seqNo: undefined as number | undefined,
        remark: null as string | null,
      },
      cascaderProps: {
        lazy: true,
        value: 'id',
        label: 'name',
        multiple: false,
        checkStrictly: true,
        expandTrigger: 'hover',
        lazyLoad(node: unknown, resolve: (data: unknown) => void) {
          _self.doLoadTreeNodes(node as { level: number; data?: { id?: string } }, resolve);
        },
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'resourceAddEdit.messages.loadFailed';
  }

  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      { name: 'resourceAddEdit.validation.requiredName', parent: 'resourceAddEdit.validation.requiredParent' },
      { name: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const parent = (this.state.formModel as { parent?: string[] }).parent ?? [];
    const length = parent.length;
    params.parentId = length <= 2 ? null : parent[length - 1];
    params.resourceTypeDictCode = parent[0] ?? null;
    params.subSysDictCode = parent[1] ?? null;
    return params;
  }

  protected createRowObjectLoadParams(): any {
    const params = super.createRowObjectLoadParams()
    params["fetchAllParentIds"] = true
    return params
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    (this.state.formModel as { parent?: unknown[] }).parent = (rowObject.parentIds as string[]) ?? [];
  }

  private async doLoadTreeNodes(node: { level: number; data?: { id?: string } }, resolve: (data: unknown) => void): Promise<void> {
    const params = {
      level: node.level,
      parentId: node.level <= 2 ? null : node.data?.id ?? null,
      active: true,
    };
    const result = await backendRequest({ url: 'sys/resource/loadTreeNodes', method: 'post', params }) as { code?: number; data?: unknown };
    if (result.code === 200) {
      resolve(result.data ?? []);
    } else {
      ElMessage.error('资源树加载失败！');
    }
  }

}

export default defineComponent({
  name: 'ResourceAddEdit',
  props: {
    modelValue: { type: Boolean, default: false },
    rid: { type: String, default: '' },
    onSaved: { type: Function as (params: Record<string, unknown>) => void, default: undefined },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new AddEditPage(p, c),
      i18nKeyPrefix: 'resourceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        const parent = model.parent as unknown[] | undefined;
        if (parent != null && parent.length > 0) return true;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.url != null && String(model.url).trim() !== '') return true;
        if (model.icon != null && String(model.icon).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.seqNo != null && model.seqNo !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped></style>