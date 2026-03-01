<!-- 组织新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog organization-add-edit-dialog"
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
        <div class="form-section__title">{{ t('organizationAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('organizationAddEdit.labels.name')" prop="name" class="is-required">
          <el-input v-model="formModel.name" :placeholder="t('organizationAddEdit.placeholders.name')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('organizationAddEdit.labels.abbrName')" prop="abbrName">
          <el-input v-model="formModel.abbrName" :placeholder="t('organizationAddEdit.placeholders.abbrName')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('organizationAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-cascader ref="parentCascaderRef" v-model="formModel.parent" :props="cascaderProps" class="form-select-full" />
        </el-form-item>
        <el-form-item :label="t('organizationAddEdit.labels.orgTypeDictCode')" prop="orgTypeDictCode" class="is-required">
          <el-select v-model="formModel.orgTypeDictCode" :placeholder="t('organizationAddEdit.placeholders.orgTypeDictCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in getDictItems('kuark:user', 'organization_type')" :key="item.first" :value="item.first" :label="item.second" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('organizationAddEdit.labels.seqNo')" prop="seqNo">
          <el-input-number v-model="formModel.seqNo" :min="0" :max="99999" controls-position="right" class="form-input-number-full" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('organizationAddEdit.sections.other') }}</div>
        <el-form-item :label="t('organizationAddEdit.labels.remark')" prop="remark">
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('organizationAddEdit.placeholders.remark')" maxlength="200" show-word-limit resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('organizationAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('organizationAddEdit.buttons.confirm') }}</el-button>
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
    this.loadDicts([new Pair('kuark:user', 'organization_type')]);
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        name: null as string | null,
        abbrName: null as string | null,
        orgTypeDictCode: null as string | null,
        seqNo: 0 as number,
        remark: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/organization';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'organizationAddEdit.messages.loadFailed';
  }

  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      {
        name: 'organizationAddEdit.validation.requiredName',
        parent: 'organizationAddEdit.validation.requiredParent',
        orgTypeDictCode: 'organizationAddEdit.validation.requiredOrgType',
      },
      { orgTypeDictCode: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }
}

export default defineComponent({
  name: 'OrganizationAddEdit',
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
        i18nKeyPrefix: 'organizationAddEdit',
        formHasContent(model: Record<string, unknown>) {
          if (!model) return false;
          if (model.name != null && String(model.name).trim() !== '') return true;
          if (model.abbrName != null && String(model.abbrName).trim() !== '') return true;
          if (model.orgTypeDictCode != null && model.orgTypeDictCode !== '') return true;
          if (model.remark != null && String(model.remark).trim() !== '') return true;
          if (model.seqNo != null && model.seqNo !== 0) return true;
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