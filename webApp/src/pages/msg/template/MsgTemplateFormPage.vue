<!-- Message template add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="680px"
    center
    class="add-edit-dialog msg-template-add-edit-dialog"
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
        <div class="form-section__title">{{ t('msgTemplateAddEdit.sections.routing') }}</div>
        <el-form-item :label="t('msgTemplateAddEdit.labels.sendType')" prop="sendTypeDictCode" class="is-required">
          <el-select v-model="formModel.sendTypeDictCode" :placeholder="t('msgTemplateAddEdit.placeholders.sendType')" clearable class="form-select-full">
            <el-option v-for="opt in SEND_TYPE_OPTIONS" :key="opt" :value="opt" :label="t('msgTemplateCommon.sendType.' + opt)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.eventType')" prop="eventTypeDictCode" class="is-required">
          <el-input v-model="formModel.eventTypeDictCode" :placeholder="t('msgTemplateAddEdit.placeholders.eventType')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.msgType')" prop="msgTypeDictCode" class="is-required">
          <el-input v-model="formModel.msgTypeDictCode" :placeholder="t('msgTemplateAddEdit.placeholders.msgType')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.locale')" prop="localeDictCode">
          <el-input v-model="formModel.localeDictCode" :placeholder="t('msgTemplateAddEdit.placeholders.locale')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.receiverGroup')" prop="receiverGroupCode">
          <el-input v-model="formModel.receiverGroupCode" :placeholder="t('msgTemplateAddEdit.placeholders.receiverGroup')" clearable />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('msgTemplateAddEdit.sections.content') }}</div>
        <el-form-item :label="t('msgTemplateAddEdit.labels.title')" prop="title">
          <el-input v-model="formModel.title" :placeholder="t('msgTemplateAddEdit.placeholders.title')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.content')" prop="content">
          <el-input v-model="formModel.content" type="textarea" :rows="4" :placeholder="t('msgTemplateAddEdit.placeholders.content')" resize="none" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('msgTemplateAddEdit.sections.defaults') }}</div>
        <el-form-item :label="t('msgTemplateAddEdit.labels.defaultActive')" prop="defaultActive">
          <el-switch v-model="formModel.defaultActive" />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.defaultTitle')" prop="defaultTitle">
          <el-input v-model="formModel.defaultTitle" :placeholder="t('msgTemplateAddEdit.placeholders.defaultTitle')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgTemplateAddEdit.labels.defaultContent')" prop="defaultContent">
          <el-input v-model="formModel.defaultContent" type="textarea" :rows="4" :placeholder="t('msgTemplateAddEdit.placeholders.defaultContent')" resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('msgTemplateAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('msgTemplateAddEdit.buttons.confirm') }}</el-button>
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
  receiverGroupCode: string | null;
  title: string | null;
  content: string | null;
  defaultActive: boolean;
  defaultTitle: string | null;
  defaultContent: string | null;
}

class MsgTemplateFormPage extends BaseAddEditPage {
  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        sendTypeDictCode: null,
        eventTypeDictCode: null,
        msgTypeDictCode: null,
        localeDictCode: null,
        receiverGroupCode: null,
        title: null,
        content: null,
        defaultActive: true,
        defaultTitle: null,
        defaultContent: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'msg/template';
  }

  protected getLoadFailedMessageKey(): string {
    return 'msgTemplateAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'MsgTemplateFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const vm = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new MsgTemplateFormPage(p, c),
      i18nKeyPrefix: 'msgTemplateAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['sendTypeDictCode', 'eventTypeDictCode', 'msgTypeDictCode', 'localeDictCode', 'receiverGroupCode', 'title', 'content', 'defaultTitle', 'defaultContent'],
        });
      },
    });
    return { ...vm, SEND_TYPE_OPTIONS };
  },
});
</script>

<style scoped>
.form-select-full { width: 100%; }
</style>
