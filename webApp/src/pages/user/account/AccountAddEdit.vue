<!-- 账号新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog account-add-edit-dialog"
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
        <div class="form-section__title">{{ t('accountAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accountAddEdit.labels.username')" prop="username" class="is-required">
          <el-input v-model="formModel.username" :placeholder="t('accountAddEdit.placeholders.username')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('accountAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-cascader ref="parentCascaderRef" v-model="formModel.parent" :props="cascaderProps" class="form-select-full" />
        </el-form-item>
        <el-form-item :label="t('accountAddEdit.labels.userTypeDictCode')" prop="userTypeDictCode" class="is-required">
          <el-select v-model="formModel.userTypeDictCode" :placeholder="t('accountAddEdit.placeholders.userTypeDictCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in getDictItems('kuark:user', 'user_type')" :key="item.first" :value="item.first" :label="item.second" />
          </el-select>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accountAddEdit.labels.remark')" prop="remark">
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('accountAddEdit.placeholders.remark')" maxlength="200" show-word-limit resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('accountAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accountAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { OrgSupportAddEditPage } from '../../../components/pages/OrgSupportAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { Pair } from '../../../components/model/Pair';
import '../../../styles/add-edit-dialog-common.css';

class AddEditPage extends OrgSupportAddEditPage {
  constructor(
    props: Record<string, unknown>,
    context: { emit: (event: string, ...args: unknown[]) => void },
    parentCascader: { value?: { getCheckedNodes: () => unknown[] } }
  ) {
    super(props, context, parentCascader);
    this.loadDicts([new Pair('kuark:user', 'user_type')]);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        username: null as string | null,
        userTypeDictCode: null as string | null,
        remark: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/account';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'accountAddEdit.messages.loadFailed';
  }

  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      {
        username: 'accountAddEdit.validation.requiredUsername',
        parent: 'accountAddEdit.validation.requiredParent',
        userTypeDictCode: 'accountAddEdit.validation.requiredUserType',
      },
      { userTypeDictCode: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }
}

export default defineComponent({
  name: 'AccountAddEdit',
  props: {
    modelValue: { type: Boolean, default: false },
    rid: { type: String, default: '' },
    onSaved: { type: Function as (params: Record<string, unknown>) => void, default: undefined },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const parentCascaderRef = ref<{ getCheckedNodes: () => unknown[] } | null>(null);
    return {
      ...useAddEditDialogSetup(props, context, {
        createPage: (p, c) => new AddEditPage(p, c, parentCascaderRef as { value?: { getCheckedNodes: () => unknown[] } }),
        i18nKeyPrefix: 'accountAddEdit',
        formHasContent(model: Record<string, unknown>) {
          if (!model) return false;
          if (model.username != null && String(model.username).trim() !== '') return true;
          if (model.userTypeDictCode != null && model.userTypeDictCode !== '') return true;
          if (model.remark != null && String(model.remark).trim() !== '') return true;
          const parent = model.parent as unknown[] | undefined;
          if (parent != null && parent.length > 0) return true;
          return false;
        },
      }),
      parentCascaderRef,
    };
  },
});
</script>

<style scoped></style>