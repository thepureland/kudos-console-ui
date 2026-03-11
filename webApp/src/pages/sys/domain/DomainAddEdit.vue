<!-- 域名新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog domain-add-edit-dialog"
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
        <div class="form-section__title">{{ t('domainAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('domainAddEdit.labels.domain')" prop="domain" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.domain"
                :placeholder="t('domainAddEdit.placeholders.domain')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('domainAddEdit.labels.subSysOrTenant')" prop="subSysOrTenant" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-cascader
                v-model="formModel.subSysOrTenant"
                :options="subSysOrTenants"
                :props="cascaderProps"
                :placeholder="t('domainAddEdit.placeholders.subSysOrTenant')"
                clearable
                class="form-select-full"
              />
            </el-col>
          </el-row>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('domainAddEdit.sections.other') }}</div>
        <el-form-item :label="t('domainAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('domainAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('domainAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('domainAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { TenantSupportAddEditPage } from '../../../components/pages/TenantSupportAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  domain: string | null;
  remark: string | null;
  subSysOrTenant: string[] | null;
  subSystemCode?: string | null;
}

class DomainAddEditPage extends TenantSupportAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        domain: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/domain';
  }

  protected getLoadFailedMessageKey(): string {
    return 'domainAddEdit.messages.loadFailed';
  }

  /** 提交前将 subSysOrTenant 拆成 systemCode、tenantId 写入 formModel（域名接口使用 systemCode 而非 subSystemCode） */
  protected beforeValidate(): void {
    const subSysOrTenant = this.state.formModel.subSysOrTenant;
    if (!subSysOrTenant || subSysOrTenant.length === 0) return;
    (this.state.formModel as Record<string, unknown>).systemCode = subSysOrTenant[0];
    if (subSysOrTenant.length > 1) {
      this.state.formModel.tenantId = subSysOrTenant[1];
    }
  }

  /** 提交时不带 subSysOrTenant、subSystemCode，只带 systemCode、tenantId 等后端字段 */
  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    delete params.subSysOrTenant;
    delete params.subSystemCode;
    return params;
  }

  /** 回填时用 systemCode（或 subSystemCode）与 tenantId 组成 subSysOrTenant 供级联显示 */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const subSys = rowObject.systemCode ?? rowObject.subSystemCode ?? (this.state.formModel as Record<string, unknown>)?.subSystemCode;
    if (subSys == null || subSys === '') return;
    const arr: string[] = [String(subSys)];
    const tid = rowObject.tenantId ?? (this.state.formModel as Record<string, unknown>)?.tenantId;
    if (tid != null && tid !== '') arr.push(String(tid));
    (this.state.formModel as Record<string, unknown>).subSysOrTenant = arr;
  }
}

export default defineComponent({
  name: 'DomainAddEdit',
  components: {},
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
      createPage: (p, c) => new DomainAddEditPage(p, c),
      i18nKeyPrefix: 'domainAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.domain != null && String(model.domain).trim() !== '') return true;
        if (model.subSysOrTenant != null && Array.isArray(model.subSysOrTenant) && model.subSysOrTenant.length > 0) return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅域名页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
