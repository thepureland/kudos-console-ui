<!-- Account protection add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="640px"
    center
    class="add-edit-dialog account-protection-add-edit-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
  >
    <el-form
      ref="form"
      :model="formModel"
      :rules="rules"
      label-width="160px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('accountProtectionAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accountProtectionAddEdit.labels.userId')" prop="userId" class="is-required">
          <el-input v-model="formModel.userId" :placeholder="t('accountProtectionAddEdit.placeholders.userId')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.safeContactWayId')" prop="safeContactWayId">
          <el-input v-model="formModel.safeContactWayId" :placeholder="t('accountProtectionAddEdit.placeholders.safeContactWayId')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountProtectionAddEdit.sections.questions') }}</div>
        <el-form-item :label="t('accountProtectionAddEdit.labels.question1')" prop="question1">
          <el-input v-model="formModel.question1" :placeholder="t('accountProtectionAddEdit.placeholders.question')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.answer1')" prop="answer1">
          <el-input v-model="formModel.answer1" :placeholder="t('accountProtectionAddEdit.placeholders.answer')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.question2')" prop="question2">
          <el-input v-model="formModel.question2" :placeholder="t('accountProtectionAddEdit.placeholders.question')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.answer2')" prop="answer2">
          <el-input v-model="formModel.answer2" :placeholder="t('accountProtectionAddEdit.placeholders.answer')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.question3')" prop="question3">
          <el-input v-model="formModel.question3" :placeholder="t('accountProtectionAddEdit.placeholders.question')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountProtectionAddEdit.labels.answer3')" prop="answer3">
          <el-input v-model="formModel.answer3" :placeholder="t('accountProtectionAddEdit.placeholders.answer')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountProtectionAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accountProtectionAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('accountProtectionAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accountProtectionAddEdit.buttons.confirm') }}</el-button>
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
  userId: string | null;
  question1: string | null;
  answer1: string | null;
  question2: string | null;
  answer2: string | null;
  question3: string | null;
  answer3: string | null;
  safeContactWayId: string | null;
  remark: string | null;
}

class AccountProtectionFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        userId: null,
        question1: null,
        answer1: null,
        question2: null,
        answer2: null,
        question3: null,
        answer3: null,
        safeContactWayId: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'user/accountProtection';
  }

  protected getLoadFailedMessageKey(): string {
    return 'accountProtectionAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'AccountProtectionFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new AccountProtectionFormPage(p, c),
      i18nKeyPrefix: 'accountProtectionAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['userId', 'question1', 'answer1', 'question2', 'answer2', 'question3', 'answer3', 'safeContactWayId', 'remark'],
        });
      },
    });
  },
});
</script>
