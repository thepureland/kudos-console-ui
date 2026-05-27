<!-- Account-third add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="640px"
    center
    class="add-edit-dialog account-third-add-edit-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
  >
    <el-form
      ref="form"
      :model="formModel"
      :rules="rules"
      label-width="180px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('accountThirdAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accountThirdAddEdit.labels.userId')" prop="userId" class="is-required">
          <el-input v-model="formModel.userId" :placeholder="t('accountThirdAddEdit.placeholders.userId')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.provider')" prop="accountProviderDictCode" class="is-required">
          <el-input v-model="formModel.accountProviderDictCode" :placeholder="t('accountThirdAddEdit.placeholders.provider')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.providerIssuer')" prop="accountProviderIssuer">
          <el-input v-model="formModel.accountProviderIssuer" :placeholder="t('accountThirdAddEdit.placeholders.providerIssuer')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.subject')" prop="subject" class="is-required">
          <el-input v-model="formModel.subject" :placeholder="t('accountThirdAddEdit.placeholders.subject')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.unionId')" prop="unionId">
          <el-input v-model="formModel.unionId" :placeholder="t('accountThirdAddEdit.placeholders.unionId')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountThirdAddEdit.sections.external') }}</div>
        <el-form-item :label="t('accountThirdAddEdit.labels.externalDisplayName')" prop="externalDisplayName">
          <el-input v-model="formModel.externalDisplayName" :placeholder="t('accountThirdAddEdit.placeholders.externalDisplayName')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.externalEmail')" prop="externalEmail">
          <el-input v-model="formModel.externalEmail" :placeholder="t('accountThirdAddEdit.placeholders.externalEmail')" clearable />
        </el-form-item>
        <el-form-item :label="t('accountThirdAddEdit.labels.avatarUrl')" prop="avatarUrl">
          <el-input v-model="formModel.avatarUrl" :placeholder="t('accountThirdAddEdit.placeholders.avatarUrl')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountThirdAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accountThirdAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('accountThirdAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accountThirdAddEdit.buttons.confirm') }}</el-button>
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
  accountProviderDictCode: string | null;
  accountProviderIssuer: string | null;
  subject: string | null;
  unionId: string | null;
  externalDisplayName: string | null;
  externalEmail: string | null;
  avatarUrl: string | null;
  remark: string | null;
}

class AccountThirdFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        userId: null,
        accountProviderDictCode: null,
        accountProviderIssuer: null,
        subject: null,
        unionId: null,
        externalDisplayName: null,
        externalEmail: null,
        avatarUrl: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'user/accountThird';
  }

  protected getLoadFailedMessageKey(): string {
    return 'accountThirdAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'AccountThirdFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new AccountThirdFormPage(p, c),
      i18nKeyPrefix: 'accountThirdAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['userId', 'accountProviderDictCode', 'accountProviderIssuer', 'subject', 'unionId', 'externalDisplayName', 'externalEmail', 'avatarUrl', 'remark'],
        });
      },
    });
  },
});
</script>
