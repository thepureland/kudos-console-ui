<!-- Remember-me token add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="560px"
    center
    class="add-edit-dialog remember-me-add-edit-dialog"
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
        <div class="form-section__title">{{ t('rememberMeAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('rememberMeAddEdit.labels.username')" prop="username" class="is-required">
          <el-input v-model="formModel.username" :placeholder="t('rememberMeAddEdit.placeholders.username')" clearable />
        </el-form-item>
        <el-form-item :label="t('rememberMeAddEdit.labels.token')" prop="token" class="is-required">
          <el-input v-model="formModel.token" type="textarea" :rows="3" :placeholder="t('rememberMeAddEdit.placeholders.token')" resize="none" />
        </el-form-item>
        <el-form-item :label="t('rememberMeAddEdit.labels.lastUsed')" prop="lastUsed">
          <el-date-picker
            v-model="formModel.lastUsed"
            type="datetime"
            :placeholder="t('rememberMeAddEdit.placeholders.lastUsed')"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="form-date-picker-full"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('rememberMeAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('rememberMeAddEdit.buttons.confirm') }}</el-button>
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
  username: string | null;
  token: string | null;
  lastUsed: string | null;
}

class RememberMeFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        username: null,
        token: null,
        lastUsed: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'user/rememberMe';
  }

  protected getLoadFailedMessageKey(): string {
    return 'rememberMeAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'RememberMeFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new RememberMeFormPage(p, c),
      i18nKeyPrefix: 'rememberMeAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['username', 'token', 'lastUsed'],
        });
      },
    });
  },
});
</script>

<style scoped>
.form-date-picker-full { width: 100%; }
</style>
