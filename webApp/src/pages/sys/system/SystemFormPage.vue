<!-- 系统新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
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
            :maxlength="remarkMaxLength"
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
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  code: string | null;
  name: string | null;
  parentCode: string | null;
  subSystem: boolean;
  remark: string | null;
}

class SystemFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
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
    return 'sys/system';
  }

  protected getLoadFailedMessageKey(): string {
    return 'systemAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'SystemFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new SystemFormPage(p, c),
      i18nKeyPrefix: 'systemAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['code', 'name', 'parentCode', 'remark'],
          trueKeys: ['subSystem'],
        });
      },
    });
  },
});
</script>

<style scoped>
/* 仅系统页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
