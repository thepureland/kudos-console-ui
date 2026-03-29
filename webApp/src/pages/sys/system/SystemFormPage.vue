<!-- 系统新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog system-add-edit-dialog"
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
        <div class="form-section__title">{{ t('systemAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('systemAddEdit.labels.code')" prop="code" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.code"
                :placeholder="t('systemAddEdit.placeholders.code')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('systemAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.parentCode')" prop="parentCode">
          <el-row :gutter="8" class="form-item-row system-parent-code-row">
            <el-col :span="18">
              <el-select
                v-model="formModel.parentCode"
                :placeholder="t('systemAddEdit.placeholders.parentCode')"
                clearable
                filterable
                class="form-select-full"
                size="default"
              >
                <el-option
                  v-for="code in parentCodeOptions || []"
                  :key="code"
                  :value="code"
                  :label="code"
                />
              </el-select>
            </el-col>
            <el-col :span="6" class="system-parent-code-row__btn">
              <el-tooltip :content="t('systemAddEdit.tooltips.refreshParentCodes')" placement="top" :enterable="false">
                <el-button
                  type="default"
                  size="default"
                  :loading="parentCodeOptionsLoading"
                  :aria-label="t('systemAddEdit.buttons.refreshParentCodes')"
                  @click="reloadParentSystemCodes"
                >
                  <el-icon><Refresh /></el-icon>
                  <span class="system-parent-code-row__btn-text">{{ t('systemAddEdit.buttons.refreshParentCodes') }}</span>
                </el-button>
              </el-tooltip>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('systemAddEdit.labels.subSystem')" prop="subSystem" class="form-item--inline">
          <el-switch
            v-model="formModel.subSystem"
            :active-value="true"
            :inactive-value="false"
            inline-prompt
            :active-text="t('systemAddEdit.switch.yes')"
            :inactive-text="t('systemAddEdit.switch.no')"
          />
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('systemAddEdit.sections.other') }}</div>
        <el-form-item :label="t('systemAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('systemAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('systemAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  code: string | null;
  name: string | null;
  parentCode: string | null;
  subSystem: boolean;
  remark: string | null;
}

class SystemFormPage extends BaseAddEditPage {
  /** 接口返回的启用非子系统编码（未排除当前行 code） */
  private parentCodeOptionsRaw: string[] = [];

  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadParentSystemCodes();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        code: null,
        name: null,
        parentCode: null,
        subSystem: true,
        remark: null,
      } as FormModel,
      /** 父级下拉：可选项（排除自身编码，且含回填父级） */
      parentCodeOptions: [] as string[],
      parentCodeOptionsLoading: false,
    };
  }

  /** 重新拉取父级编码列表（新增系统后点刷新避免缓存未更新） */
  public reloadParentSystemCodes(): Promise<void> {
    return this.loadParentSystemCodes();
  }

  /** 下拉：sys/system/getAllActiveSystemCodes */
  private async loadParentSystemCodes(): Promise<void> {
    (this.state as Record<string, unknown>).parentCodeOptionsLoading = true;
    try {
      const result = await backendRequest({ url: 'sys/system/getAllActiveSystemCodes' });
      const payload = getApiResponseData<unknown[]>(result);
      this.parentCodeOptionsRaw = Array.isArray(payload)
        ? payload.map((x) => String(x ?? '')).filter((c) => c !== '')
        : [];
    } catch {
      this.parentCodeOptionsRaw = [];
    } finally {
      (this.state as Record<string, unknown>).parentCodeOptionsLoading = false;
    }
    this.syncParentCodeOptions();
  }

  /** 根据原始列表与当前表单 code/parentCode 生成下拉选项 */
  private syncParentCodeOptions(): void {
    const raw = this.parentCodeOptionsRaw;
    const selfCode = String((this.state.formModel as FormModel).code ?? '').trim();
    let list = selfCode ? raw.filter((c) => c !== selfCode) : [...raw];
    const pc = (this.state.formModel as FormModel).parentCode?.trim();
    if (pc && !list.includes(pc)) {
      list = [...list, pc];
    }
    (this.state as Record<string, unknown>).parentCodeOptions = list;
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    this.syncParentCodeOptions();
  }

  protected getRootActionPath(): string {
    return 'sys/system';
  }

  protected getLoadFailedMessageKey(): string {
    return 'systemAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'SystemFormPage',
  components: { Refresh },
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const pageHolder: { ref: SystemFormPage | null } = { ref: null };
    const base = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => {
        const page = new SystemFormPage(p, c);
        pageHolder.ref = page;
        return page;
      },
      i18nKeyPrefix: 'systemAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['code', 'name', 'parentCode', 'remark'],
          // 子系统默认 true，不计入 trueKeys；用户关为 false 视为有改动
          customChecks: [(m) => m.subSystem === false],
        });
      },
    });
    async function reloadParentSystemCodes(): Promise<void> {
      await pageHolder.ref?.reloadParentSystemCodes();
    }
    return { ...base, reloadParentSystemCodes };
  },
});
</script>

<style scoped>
.system-parent-code-row__btn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.system-parent-code-row__btn-text {
  margin-left: 4px;
}
</style>
