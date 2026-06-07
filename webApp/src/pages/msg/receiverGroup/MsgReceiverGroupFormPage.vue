<!-- Message receiver-group add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="560px"
    center
    class="add-edit-dialog msg-receiver-group-add-edit-dialog"
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
        <div class="form-section__title">{{ t('msgReceiverGroupAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('msgReceiverGroupAddEdit.labels.groupType')" prop="receiverGroupTypeDictCode" class="is-required">
          <el-select v-model="formModel.receiverGroupTypeDictCode" :placeholder="t('msgReceiverGroupAddEdit.placeholders.groupType')" clearable filterable class="form-select-full">
            <el-option v-for="item in getDictItems('msg', 'receiver_group_type')" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('msgReceiverGroupAddEdit.labels.defineTable')" prop="defineTable" class="is-required">
          <el-input v-model="formModel.defineTable" :placeholder="t('msgReceiverGroupAddEdit.placeholders.defineTable')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgReceiverGroupAddEdit.labels.nameColumn')" prop="nameColumn" class="is-required">
          <el-input v-model="formModel.nameColumn" :placeholder="t('msgReceiverGroupAddEdit.placeholders.nameColumn')" clearable />
        </el-form-item>
        <el-form-item :label="t('msgReceiverGroupAddEdit.labels.active')" prop="active">
          <el-switch v-model="formModel.active" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('msgReceiverGroupAddEdit.sections.other') }}</div>
        <el-form-item :label="t('msgReceiverGroupAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('formCommon.remarkPlaceholderWithMax', { max: 128 })"
            :maxlength="128"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('msgReceiverGroupAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('msgReceiverGroupAddEdit.buttons.confirm') }}</el-button>
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
  receiverGroupTypeDictCode: string | null;
  defineTable: string | null;
  nameColumn: string | null;
  active: boolean;
  remark: string | null;
}

class MsgReceiverGroupFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['receiver_group_type'], 'msg');
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        receiverGroupTypeDictCode: null,
        defineTable: null,
        nameColumn: null,
        active: true,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'msg/receiverGroup';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['receiver_group_type'], atomicServiceCode: 'msg' }];
  }

  protected getLoadFailedMessageKey(): string {
    return 'msgReceiverGroupAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'MsgReceiverGroupFormPage',
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new MsgReceiverGroupFormPage(p, c),
      i18nKeyPrefix: 'msgReceiverGroupAddEdit',
      formHasContent(model: Record<string, unknown>) {
        // 'active' is intentionally excluded: it is always a boolean with a default value (true)
        // and does not indicate meaningful user input on its own.
        return hasAnyFormContent(model, {
          stringKeys: ['receiverGroupTypeDictCode', 'defineTable', 'nameColumn', 'remark'],
        });
      },
    });
  },
});
</script>

<style scoped>
.form-select-full { width: 100%; }
</style>
