<!-- 参数新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog param-add-edit-dialog"
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
        <div class="form-section__title">{{ t('paramAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('paramAddEdit.labels.module')" prop="module" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.module"
                :placeholder="t('paramAddEdit.placeholders.module')"
                clearable
                filterable
                class="form-select-full"
              >
                <el-option
                  v-for="item in atomicServiceList"
                  :key="item.code"
                  :value="item.code"
                  :label="item.name"
                />
              </el-select>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('paramAddEdit.labels.paramName')" prop="paramName" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.paramName"
                :placeholder="t('paramAddEdit.placeholders.paramName')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('paramAddEdit.labels.paramValue')" prop="paramValue">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.paramValue"
                :placeholder="t('paramAddEdit.placeholders.paramValue')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('paramAddEdit.labels.defaultValue')" prop="defaultValue">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.defaultValue"
                :placeholder="t('paramAddEdit.placeholders.defaultValue')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('paramAddEdit.labels.seqNo')" prop="seqNo">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input-number
                v-model="formModel.seqNo"
                :min="1"
                :max="999999999"
                controls-position="right"
                class="form-input-number-full"
              />
            </el-col>
          </el-row>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('paramAddEdit.sections.other') }}</div>
        <el-form-item :label="t('paramAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('paramAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('paramAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('paramAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  module: string | null;
  paramName: string | null;
  paramValue: string | null;
  defaultValue: string | null;
  seqNo: number;
  remark: string | null;
}

class AddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        module: null,
        paramName: null,
        paramValue: null,
        defaultValue: null,
        seqNo: 1,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/param';
  }

  /** 与详情一致：Mock/后端使用 getDetail 按 id 拉取单条 */
  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'paramAddEdit.messages.loadFailed';
  }

  /** 必填项使用基类 i18n 必填规则并合并 */
  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      {
        module: 'paramAddEdit.validation.requiredModule',
        paramName: 'paramAddEdit.validation.requiredParamName',
      },
      { module: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }

  /** 回填时保证 seqNo 为 number，兼容 el-input-number */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const seqNo = this.state.formModel?.seqNo;
    if (seqNo !== undefined && seqNo !== null && typeof seqNo !== 'number') {
      const n = Number(seqNo);
      this.state.formModel.seqNo = Number.isNaN(n) ? 1 : Math.max(1, Math.min(999999999, n));
    }
  }
}

export default defineComponent({
  name: 'ParamAddEdit',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
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
      i18nKeyPrefix: 'paramAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.module != null && String(model.module).trim() !== '') return true;
        if (model.paramName != null && String(model.paramName).trim() !== '') return true;
        if (model.paramValue != null && String(model.paramValue).trim() !== '') return true;
        if (model.defaultValue != null && String(model.defaultValue).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.seqNo != null && model.seqNo !== 1) return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅参数页特有覆盖时可在此添加 */
</style>
