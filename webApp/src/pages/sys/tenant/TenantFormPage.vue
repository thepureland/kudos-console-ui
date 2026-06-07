<!-- Tenant add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
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
        <el-form-item :label="t('tenantAddEdit.labels.subSystemCodes')" prop="subSystemCodes" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.subSystemCodes"
                :placeholder="t('tenantAddEdit.placeholders.subSystemCodes')"
                multiple
                clearable
                filterable
                class="form-select-full tenant-subsystem-multi-select"
              >
                <el-option
                  v-for="code in subSystemCodesOptions || []"
                  :key="code"
                  :value="code"
                  :label="code"
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
        <el-button @click="handleCloseRequest">{{ t('tenantAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('tenantAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  name: string | null;
  /** Selected subsystem codes (multi-select) */
  subSystemCodes: string[];
  remark: string | null;
}

class TenantFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadSubSystems();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        name: null,
        subSystemCodes: [],
        remark: null,
      } as FormModel,
      /** Subsystem dropdown options: list of active subsystem codes */
      subSystemCodesOptions: [] as string[],
    };
  }

  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  /** This module's edit-time fetch still uses /get, not the original getDetail path */
  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/get';
  }

  protected getLoadFailedMessageKey(): string {
    return 'tenantAddEdit.messages.loadFailed';
  }

  /** Tenant add/edit subsystem dropdown: call sys/system/getAllActiveSubSystemCodes; the result is the list of active subsystem codes */
  private async loadSubSystems(): Promise<void> {
    try {
      const result = await backendRequest({ url: 'sys/system/getAllActiveSubSystemCodes' });
      const payload = getApiResponseData<unknown[]>(result);
      const codes = Array.isArray(payload) ? payload.map((x) => String(x ?? '')) : [];
      (this.state as Record<string, unknown>).subSystemCodesOptions = codes.filter((c) => c !== '');
    } catch {
      (this.state as Record<string, unknown>).subSystemCodesOptions = [];
    }
  }

  /**
   * Back-fill the form from the loaded row object.
   * The backend may return either an array (`subSystemCodes`) or a legacy
   * single-value field (`subSystemCode`) — both are normalised to string[].
   */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const fm = this.state.formModel as FormModel;
    if (Array.isArray(rowObject.subSystemCodes)) {
      fm.subSystemCodes = (rowObject.subSystemCodes as unknown[]).map((x) => String(x ?? '')).filter((c) => c !== '');
    } else if (rowObject.subSystemCode != null && rowObject.subSystemCode !== '') {
      // Legacy single-code field — wrap in array for the multi-select
      fm.subSystemCodes = [String(rowObject.subSystemCode)];
    }
  }
}

export default defineComponent({
  name: 'TenantFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new TenantFormPage(p, c),
      i18nKeyPrefix: 'tenantAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['name', 'remark'],
          arrayKeys: ['subSystemCodes'],
        });
      },
    });
  },
});
</script>

<style scoped>
/* Add tenant-specific overrides here; shared styles live in add-edit-dialog-common.css */
</style>
