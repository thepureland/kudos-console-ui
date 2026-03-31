<!-- 微服务新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog microservice-add-edit-dialog"
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
        <div class="form-section__title">{{ t('microServiceAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('microServiceAddEdit.labels.code')" prop="code" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.code"
                :placeholder="t('microServiceAddEdit.placeholders.code')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('microServiceAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('microServiceAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('microServiceAddEdit.labels.context')" prop="context" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.context"
                :placeholder="t('microServiceAddEdit.placeholders.context')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('microServiceAddEdit.labels.parentCode')" prop="parentCode">
          <el-row :gutter="8" class="form-item-row microservice-parent-code-row">
            <el-col :span="18">
              <el-select
                v-model="formModel.parentCode"
                :placeholder="t('microServiceAddEdit.placeholders.parentCode')"
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
            <el-col :span="6" class="microservice-parent-code-row__btn">
              <el-tooltip :content="t('microServiceAddEdit.tooltips.refreshParentCodes')" placement="top" :enterable="false">
                <el-button
                  type="default"
                  size="default"
                  :loading="parentCodeOptionsLoading"
                  :aria-label="t('microServiceAddEdit.buttons.refreshParentCodes')"
                  @click="reloadParentMicroServiceCodes"
                >
                  <el-icon><Refresh /></el-icon>
                  <span class="microservice-parent-code-row__btn-text">{{ t('microServiceAddEdit.buttons.refreshParentCodes') }}</span>
                </el-button>
              </el-tooltip>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('microServiceAddEdit.labels.atomicService')" prop="atomicService" class="form-item--inline">
          <el-switch
            v-model="formModel.atomicService"
            :active-value="true"
            :inactive-value="false"
            inline-prompt
            :active-text="t('microServiceAddEdit.switch.yes')"
            :inactive-text="t('microServiceAddEdit.switch.no')"
          />
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('microServiceAddEdit.sections.other') }}</div>
        <el-form-item :label="t('microServiceAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('microServiceAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('microServiceAddEdit.buttons.confirm') }}</el-button>
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
  context: string | null;
  atomicService: boolean;
  remark: string | null;
}

class MicroServiceFormPage extends BaseAddEditPage {
  /** 接口返回的启用非原子微服务编码（未排除当前行 code） */
  private parentCodeOptionsRaw: string[] = [];

  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadParentMicroServiceCodes();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        code: null,
        name: null,
        parentCode: null,
        context: null,
        atomicService: true,
        remark: null,
      } as FormModel,
      parentCodeOptions: [] as string[],
      parentCodeOptionsLoading: false,
    };
  }

  public reloadParentMicroServiceCodes(): Promise<void> {
    return this.loadParentMicroServiceCodes();
  }

  /** sys/microService/getAllActiveMicroServiceCodes */
  private async loadParentMicroServiceCodes(): Promise<void> {
    (this.state as Record<string, unknown>).parentCodeOptionsLoading = true;
    try {
      const result = await backendRequest({ url: 'sys/microService/getAllActiveMicroServiceCodes' });
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
    return 'sys/microService';
  }

  protected getLoadFailedMessageKey(): string {
    return 'microServiceAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'MicroServiceFormPage',
  components: { Refresh },
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const pageHolder: { ref: MicroServiceFormPage | null } = { ref: null };
    const base = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => {
        const page = new MicroServiceFormPage(p, c);
        pageHolder.ref = page;
        return page;
      },
      i18nKeyPrefix: 'microServiceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['code', 'name', 'parentCode', 'context', 'remark'],
          // 原子服务默认 true；关为否视为有改动
          customChecks: [(m) => m.atomicService === false],
        });
      },
    });
    async function reloadParentMicroServiceCodes(): Promise<void> {
      await pageHolder.ref?.reloadParentMicroServiceCodes();
    }
    return { ...base, reloadParentMicroServiceCodes };
  },
});
</script>

<style scoped>
.microservice-parent-code-row__btn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.microservice-parent-code-row__btn-text {
  margin-left: 4px;
}
</style>
