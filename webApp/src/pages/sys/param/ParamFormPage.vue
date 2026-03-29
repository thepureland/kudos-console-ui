<!-- 参数新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
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
        <el-form-item :label="t('paramAddEdit.labels.module')" prop="atomicServiceCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.atomicServiceCode"
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
        <el-form-item :label="t('paramAddEdit.labels.paramValue')" prop="paramValue" class="is-required">
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
        <el-form-item :label="t('paramAddEdit.labels.seqNo')" prop="orderNum">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input-number
                v-model="formModel.orderNum"
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
            :placeholder="t('formCommon.remarkPlaceholderWithMax', { max: remarkMaxLength })"
            :maxlength="remarkMaxLength"
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
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  atomicServiceCode: string | null;
  paramName: string | null;
  paramValue: string | null;
  defaultValue: string | null;
  orderNum: number;
  remark: string | null;
}

class ParamFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        atomicServiceCode: null,
        paramName: null,
        paramValue: null,
        defaultValue: null,
        orderNum: 1,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/param';
  }

  protected getLoadFailedMessageKey(): string {
    return 'paramAddEdit.messages.loadFailed';
  }

  /** 回填时保证 orderNum 为 number，兼容 el-input-number */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const orderNum = this.state.formModel?.orderNum;
    if (orderNum !== undefined && orderNum !== null && typeof orderNum !== 'number') {
      const n = Number(orderNum);
      this.state.formModel.orderNum = Number.isNaN(n) ? 1 : Math.max(1, Math.min(999999999, n));
    }
  }
}

export default defineComponent({
  name: 'ParamFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new ParamFormPage(p, c),
      i18nKeyPrefix: 'paramAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['atomicServiceCode', 'paramName', 'paramValue', 'defaultValue', 'remark'],
          customChecks: [(m) => m.orderNum != null && m.orderNum !== 1],
        });
      },
    });
  },
});
</script>

<style scoped>
/* 仅参数页特有覆盖时可在此添加 */
</style>
