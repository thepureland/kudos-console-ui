<!-- Contact way add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="560px"
    center
    class="add-edit-dialog contact-way-add-edit-dialog"
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
        <div class="form-section__title">{{ t('contactWayAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('contactWayAddEdit.labels.userId')" prop="userId" class="is-required">
          <el-input v-model="formModel.userId" :placeholder="t('contactWayAddEdit.placeholders.userId')" clearable />
        </el-form-item>
        <el-form-item :label="t('contactWayAddEdit.labels.contactWayDictCode')" prop="contactWayDictCode" class="is-required">
          <el-input v-model="formModel.contactWayDictCode" :placeholder="t('contactWayAddEdit.placeholders.contactWayDictCode')" clearable />
        </el-form-item>
        <el-form-item :label="t('contactWayAddEdit.labels.contactWayValue')" prop="contactWayValue" class="is-required">
          <el-input v-model="formModel.contactWayValue" :placeholder="t('contactWayAddEdit.placeholders.contactWayValue')" clearable />
        </el-form-item>
        <el-form-item :label="t('contactWayAddEdit.labels.contactWayStatusDictCode')" prop="contactWayStatusDictCode">
          <el-input v-model="formModel.contactWayStatusDictCode" :placeholder="t('contactWayAddEdit.placeholders.contactWayStatusDictCode')" clearable />
        </el-form-item>
        <el-form-item :label="t('contactWayAddEdit.labels.priority')" prop="priority">
          <el-input-number v-model="formModel.priority" :min="0" :max="32767" controls-position="right" class="form-input-number-full" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('contactWayAddEdit.sections.other') }}</div>
        <el-form-item :label="t('contactWayAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('contactWayAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('contactWayAddEdit.buttons.confirm') }}</el-button>
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
  contactWayDictCode: string | null;
  contactWayValue: string | null;
  contactWayStatusDictCode: string | null;
  priority: number;
  remark: string | null;
}

class ContactWayFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        userId: null,
        contactWayDictCode: null,
        contactWayValue: null,
        contactWayStatusDictCode: null,
        priority: 0,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'user/contactWay';
  }

  protected getLoadFailedMessageKey(): string {
    return 'contactWayAddEdit.messages.loadFailed';
  }

  /** Coerce priority into number for el-input-number compatibility on backfill. */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const p = this.state.formModel?.priority;
    if (p !== undefined && p !== null && typeof p !== 'number') {
      const n = Number(p);
      this.state.formModel.priority = Number.isNaN(n) ? 0 : Math.max(0, Math.min(32767, n));
    }
  }
}

export default defineComponent({
  name: 'ContactWayFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new ContactWayFormPage(p, c),
      i18nKeyPrefix: 'contactWayAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['userId', 'contactWayDictCode', 'contactWayValue', 'contactWayStatusDictCode', 'remark'],
          customChecks: [(m) => m.priority != null && m.priority !== 0],
        });
      },
    });
  },
});
</script>
