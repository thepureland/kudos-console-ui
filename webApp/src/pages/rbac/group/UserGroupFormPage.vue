<!-- 用户组新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog usergroup-add-edit-dialog"
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
        <div class="form-section__title">{{ t('userGroupAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('userGroupAddEdit.labels.groupCode')" prop="groupCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.groupCode"
                :placeholder="t('userGroupAddEdit.placeholders.groupCode')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('userGroupAddEdit.labels.groupName')" prop="groupName" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.groupName"
                :placeholder="t('userGroupAddEdit.placeholders.groupName')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('userGroupAddEdit.sections.other') }}</div>
        <el-form-item :label="t('userGroupAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('userGroupAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('userGroupAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('userGroupAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  groupCode: string | null;
  groupName: string | null;
  remark: string | null;
}

class UserGroupFormPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        groupCode: null,
        groupName: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'rbac/group';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'userGroupAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'UserGroupFormPage',
  props: {
    modelValue: { type: Boolean, default: false },
    rid: { type: String, default: '' },
    onSaved: { type: Function as (params: Record<string, unknown>) => void, default: undefined },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new UserGroupFormPage(p, c),
      i18nKeyPrefix: 'userGroupAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.groupCode != null && String(model.groupCode).trim() !== '') return true;
        if (model.groupName != null && String(model.groupName).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped></style>
