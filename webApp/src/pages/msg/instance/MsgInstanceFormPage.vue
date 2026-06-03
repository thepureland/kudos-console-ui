<!-- Message instance add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="680px"
    center
    class="add-edit-dialog msg-instance-add-edit-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
  >
    <el-form
      ref="form"
      :model="formModel"
      :rules="rules"
      label-width="150px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('msgInstanceAddEdit.sections.routing') }}</div>
        <el-form-item :label="t('msgInstanceAddEdit.labels.sendType')" prop="sendTypeDictCode" class="is-required">
          <el-select v-model="formModel.sendTypeDictCode" :placeholder="t('msgInstanceAddEdit.placeholders.sendType')" clearable class="form-select-full">
            <el-option v-for="opt in SEND_TYPE_OPTIONS" :key="opt" :value="opt" :label="t('msgTemplateCommon.sendType.' + opt)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.eventType')" prop="eventTypeDictCode" class="is-required">
          <el-input v-model="formModel.eventTypeDictCode" :placeholder="t('msgInstanceAddEdit.placeholders.eventType')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.msgType')" prop="msgTypeDictCode" class="is-required">
          <el-input v-model="formModel.msgTypeDictCode" :placeholder="t('msgInstanceAddEdit.placeholders.msgType')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.locale')" prop="localeDictCode">
          <el-input v-model="formModel.localeDictCode" :placeholder="t('msgInstanceAddEdit.placeholders.locale')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.templateId')" prop="templateId">
          <el-input v-model="formModel.templateId" :placeholder="t('msgInstanceAddEdit.placeholders.templateId')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('msgInstanceAddEdit.sections.content') }}</div>
        <el-form-item :label="t('msgInstanceAddEdit.labels.title')" prop="title">
          <el-input v-model="formModel.title" :placeholder="t('msgInstanceAddEdit.placeholders.title')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.content')" prop="content">
          <el-input v-model="formModel.content" type="textarea" :rows="4" :placeholder="t('msgInstanceAddEdit.placeholders.content')" resize="none" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('msgInstanceAddEdit.sections.validity') }}</div>
        <el-form-item :label="t('msgInstanceAddEdit.labels.validTimeStart')" prop="validTimeStart">
          <el-date-picker v-model="formModel.validTimeStart" type="datetime" class="form-date-picker-full" value-format="YYYY-MM-DDTHH:mm:ss" :placeholder="t('msgInstanceAddEdit.placeholders.validTimeStart')" />
        </el-form-item>
        <el-form-item :label="t('msgInstanceAddEdit.labels.validTimeEnd')" prop="validTimeEnd">
          <el-date-picker v-model="formModel.validTimeEnd" type="datetime" class="form-date-picker-full" value-format="YYYY-MM-DDTHH:mm:ss" :placeholder="t('msgInstanceAddEdit.placeholders.validTimeEnd')" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('msgInstanceAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('msgInstanceAddEdit.buttons.confirm') }}</el-button>
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

const SEND_TYPE_OPTIONS = ['auto', 'manual'];

interface FormModel {
  sendTypeDictCode: string | null;
  eventTypeDictCode: string | null;
  msgTypeDictCode: string | null;
  localeDictCode: string | null;
  templateId: string | null;
  title: string | null;
  content: string | null;
  validTimeStart: string | null;
  validTimeEnd: string | null;
}

class MsgInstanceFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        sendTypeDictCode: null,
        eventTypeDictCode: null,
        msgTypeDictCode: null,
        localeDictCode: null,
        templateId: null,
        title: null,
        content: null,
        validTimeStart: null,
        validTimeEnd: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'msg/instance';
  }

  protected getLoadFailedMessageKey(): string {
    return 'msgInstanceAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'MsgInstanceFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const vm = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new MsgInstanceFormPage(p, c),
      i18nKeyPrefix: 'msgInstanceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['sendTypeDictCode', 'eventTypeDictCode', 'msgTypeDictCode', 'localeDictCode', 'templateId', 'title', 'content', 'validTimeStart', 'validTimeEnd'],
        });
      },
    });
    return { ...vm, SEND_TYPE_OPTIONS };
  },
});
</script>

<style scoped>
.form-select-full { width: 100%; }
.form-date-picker-full { width: 100%; }
</style>
