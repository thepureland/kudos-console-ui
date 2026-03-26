<!-- 字典 新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
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
        <el-form-item :label="t('dictAddEdit.labels.atomicService')" prop="atomicServiceCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.atomicServiceCode"
                :placeholder="t('dictAddEdit.placeholders.atomicService')"
                clearable
                filterable
                class="form-select-full"
              >
                <el-option
                  v-for="item in getAtomicServices()"
                  :key="item.code"
                  :value="item.code"
                  :label="item.name"
                />
              </el-select>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.dictType')" prop="dictType" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.dictType"
                :placeholder="t('dictAddEdit.placeholders.dictType')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dictAddEdit.labels.nameOrI18nKey')" prop="dictName" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.dictName"
                :placeholder="t('dictAddEdit.placeholders.nameOrI18nKey')"
                clearable
                size="default"
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
            :maxlength="remarkMaxLength"
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
import { i18n } from '../../../i18n';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  atomicServiceCode: string | null;
  dictType: string | null;
  dictName: string | null;
  remark: string | null;
}

class DictFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        atomicServiceCode: null,
        dictType: null,
        dictName: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/dict';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDict';
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
    if (model?.atomicServiceCode) {
      params.atomicServiceCode = model.atomicServiceCode;
      params.dictType = (model.dictType as string) ?? null;
    }
    return params;
  }

  protected doSubmit(): void {
    const model = this.state.formModel as FormModel;
    if (!model?.atomicServiceCode || String(model.atomicServiceCode).trim() === '') {
      ElMessage.error(i18n.global.t('dictAddEdit.validation.requiredAtomicService') as string);
      return;
    }
    super.doSubmit();
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const model = this.state.formModel as FormModel;
    model.dictType = rowObject.dictType as string;
    model.dictName = rowObject.dictName as string;
    model.atomicServiceCode = (rowObject.atomicServiceCode ?? rowObject.module) as string;
  }

}

export default defineComponent({
  name: 'DictFormPage',
  props: {
    ...commonAddEditDialogProps,
    atomicServiceCode: {
      type: String,
      default: '',
    },
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new DictFormPage(p, c),
      i18nKeyPrefix: 'dictAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['atomicServiceCode', 'dictType', 'dictName', 'remark'],
        });
      },
      onVisible: async (result) => {
        if (typeof (result as { loadAtomicServices?: () => Promise<void> }).loadAtomicServices === 'function') {
          await (result as { loadAtomicServices: () => Promise<void> }).loadAtomicServices();
          if (!props.rid && props.atomicServiceCode) {
            const state = (result as { state?: { formModel?: { atomicServiceCode?: string | null } } }).state;
            if (state?.formModel) state.formModel.atomicServiceCode = String(props.atomicServiceCode);
          }
        }
      },
    });
  },
});
</script>

<style scoped>
/* 仅字典页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
