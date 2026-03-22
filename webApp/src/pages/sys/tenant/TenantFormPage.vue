<!-- 租户新增/编辑 -->
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
            :placeholder="t('tenantAddEdit.placeholders.remark')"
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
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  name: string | null;
  /** 选中的子系统编码（多选） */
  subSystemCodes: string[];
  remark: string | null;
}

class TenantFormPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
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
      /** 子系统下拉选项：启用子系统编码列表 */
      subSystemCodesOptions: [] as string[],
    };
  }

  protected getRootActionPath(): string {
    return 'sys/tenant';
  }

  /** 本模块编辑拉数仍使用 /get，非原 getDetail 路径 */
  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/get';
  }

  protected getLoadFailedMessageKey(): string {
    return 'tenantAddEdit.messages.loadFailed';
  }

  /** 租户新增/编辑子系统下拉：调用 sys/system/getAllActiveSubSystemCodes，结果为启用子系统编码列表 */
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

  /** 回填时兼容后端返回 subSystemCodes（数组）或 subSystemCode（单值） */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const fm = this.state.formModel as FormModel;
    if (Array.isArray(rowObject.subSystemCodes)) {
      fm.subSystemCodes = (rowObject.subSystemCodes as unknown[]).map((x) => String(x ?? '')).filter((c) => c !== '');
    } else if (rowObject.subSystemCode != null && rowObject.subSystemCode !== '') {
      fm.subSystemCodes = [String(rowObject.subSystemCode)];
    }
  }
}

export default defineComponent({
  name: 'TenantFormPage',
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
      createPage: (p, c) => new TenantFormPage(p, c),
      i18nKeyPrefix: 'tenantAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (Array.isArray(model.subSystemCodes) && model.subSystemCodes.length > 0) return true;
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
