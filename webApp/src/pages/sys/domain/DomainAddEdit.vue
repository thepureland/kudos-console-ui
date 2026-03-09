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
  subSysDictCode?: string | null;
}

class DomainAddEditPage extends TenantSupportAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  /** 允许只选子系统不选租户，级联需 checkStrictly 才能回填仅子系统的值 */
  protected isCheckStrictly(): boolean {
    return true;
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
