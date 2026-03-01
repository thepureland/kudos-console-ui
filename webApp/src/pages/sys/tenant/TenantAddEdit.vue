<!-- 租户新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog tenant-add-edit-dialog"
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
        <div class="form-section__title">{{ t('tenantAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('tenantAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('tenantAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('tenantAddEdit.labels.subSysDictCode')" prop="subSysDictCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.subSysDictCode"
                :placeholder="t('tenantAddEdit.placeholders.subSysDictCode')"
                clearable
                filterable
                class="form-select-full"
              >
                <el-option
                  v-for="item in atomicServiceList"
                  :key="item.code"
                  :value="item.code"
                  :label="item.name"
                />
              </el-select>
            </el-col>
          </el-row>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('tenantAddEdit.sections.other') }}</div>
        <el-form-item :label="t('tenantAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('tenantAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('tenantAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('tenantAddEdit.buttons.confirm') }}</el-button>
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
  name: string | null;
  subSysDictCode: string | null;
  remark: string | null;
}

class AddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        name: null,
        subSysDictCode: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  /** 必填项使用基类 i18n 必填规则并合并 */
  protected async initValidationRule(): Promise<void> {
    await super.initValidationRule();
    const requiredRules = this.createRequiredRules(
      {
        name: 'tenantAddEdit.validation.requiredName',
        subSysDictCode: 'tenantAddEdit.validation.requiredSubSysDictCode',
      },
      { subSysDictCode: 'change' }
    );
    const rules = (this.state.rules as Record<string, unknown>) || {};
    this.state.rules = { ...rules, ...requiredRules };
  }

  protected getLoadFailedMessageKey(): string {
    return 'tenantAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'TenantAddEdit',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
      type: String,
      default: '',
    },
    onSaved: {
      type: Function as (params: Record<string, unknown>) => void,
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new AddEditPage(p, c),
      i18nKeyPrefix: 'tenantAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.subSysDictCode != null && model.subSysDictCode !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅租户页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
