<!-- 子系统新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog system-add-edit-dialog"
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
        <div class="form-section__title">{{ t('systemAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('systemAddEdit.labels.code')" prop="code" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.code"
                :placeholder="t('systemAddEdit.placeholders.code')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('systemAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.parentCode')" prop="parentCode">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.parentCode"
                :placeholder="t('systemAddEdit.placeholders.parentCode')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.subSystem')" prop="subSystem" class="form-item--inline">
          <el-switch
            v-model="formModel.subSystem"
            :active-value="true"
            :inactive-value="false"
            inline-prompt
            :active-text="t('systemAddEdit.switch.yes')"
            :inactive-text="t('systemAddEdit.switch.no')"
          />
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('systemAddEdit.sections.other') }}</div>
        <el-form-item :label="t('systemAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('systemAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('systemAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('systemAddEdit.buttons.confirm') }}</el-button>
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
  code: string | null;
  name: string | null;
  parentCode: string | null;
  subSystem: boolean;
  remark: string | null;
}

class AddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        code: null,
        name: null,
        parentCode: null,
        subSystem: false,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/subsys';
  }

  /** 与详情一致：使用 getDetail 接口按 id 拉取单条，Mock 已有此路径 */
  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'systemAddEdit.messages.loadFailed';
  }

  /** 必填项使用基类 i18n 必填规则并合并 */
  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      {
        code: 'systemAddEdit.validation.requiredCode',
        name: 'systemAddEdit.validation.requiredName',
      },
      { code: 'change', name: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }
}

export default defineComponent({
  name: 'SystemAddEdit',
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
      i18nKeyPrefix: 'systemAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.code != null && String(model.code).trim() !== '') return true;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.parentCode != null && String(model.parentCode).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.subSystem === true) return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅子系统页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
