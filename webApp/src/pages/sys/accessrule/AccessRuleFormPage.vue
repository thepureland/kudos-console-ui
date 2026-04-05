<!--
 * 访问规则新增/编辑：子系统/租户级联、规则类型（与访问规则列表一致；租户数据由列表页注入）。
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog access-rule-add-edit-dialog"
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
        <div class="form-section__title">{{ t('accessRuleAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accessRuleAddEdit.labels.subSysOrTenant')" prop="subSysOrTenant" class="is-required">
          <el-cascader
            v-model="formModel.subSysOrTenant"
            :options="cascaderOptionsList || []"
            :props="cascaderPropsMerged"
            :placeholder="t('accessRuleAddEdit.placeholders.subSysOrTenant')"
            clearable
            class="form-select-full"
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleAddEdit.labels.accessRuleTypeDictCode')" prop="accessRuleTypeDictCode" class="is-required">
          <el-select
            v-model="formModel.accessRuleTypeDictCode"
            :placeholder="t('accessRuleAddEdit.placeholders.accessRuleTypeDictCode')"
            clearable
            filterable
            class="form-select-full"
          >
            <el-option
              v-for="item in ruleTypeOptions"
              :key="item.first"
              :value="item.first"
              :label="getAccessRuleTypeLabel(item.first)"
            />
          </el-select>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accessRuleAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accessRuleAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('accessRuleAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accessRuleAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';
import { TenantSupportAddEditPage } from '../../../components/pages/support';

interface AccessRuleFormModel {
  subSysOrTenant: string[] | null;
  tenantId: string | null;
  subSystemCode: string | null;
  accessRuleTypeDictCode: string | null;
  remark: string | null;
}

class AccessRuleFormPage extends TenantSupportAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['access_rule_type'], 'sys').then(() => {
      (this.state as Record<string, unknown>).ruleTypeOptions = this.getDictItems('sys', 'access_rule_type');
    });
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['access_rule_type'], atomicServiceCode: 'sys' }];
  }

  /** 与访问规则列表一致：第一级为 getAllActiveSubSystemCodes，懒加载租户 */
  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  /** 与列表一致：须选到租户（第二级） */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      ruleTypeOptions: [] as Array<{ first: string; second: string }>,
      formModel: {
        subSysOrTenant: null,
        tenantId: null,
        subSystemCode: null,
        accessRuleTypeDictCode: null,
        remark: null,
      } as AccessRuleFormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/accessRule';
  }

  protected getLoadFailedMessageKey(): string {
    return 'accessRuleAddEdit.messages.loadFailed';
  }

  /** 后端编辑回显为 systemCode，父类 fillForm 依赖 subSystemCode，此处按 systemCode + tenantId 合并级联 */
  protected fillForm(rowObject: Record<string, unknown>): void {
    BaseAddEditPage.prototype.fillForm.call(this, rowObject);
    const fm = this.state.formModel as AccessRuleFormModel;
    const sys = rowObject.systemCode ?? rowObject.subSystemCode;
    if (sys == null || sys === '') return;
    const arr: string[] = [String(sys)];
    const tid = rowObject.tenantId;
    if (tid != null && tid !== '') arr.push(String(tid));
    fm.subSysOrTenant = arr;
  }

  public resetFormForAdd(): void {
    super.resetFormForAdd();
    const snap = this.props.listSearchSnapshot as Record<string, unknown> | undefined;
    if (!snap) return;
    const fm = this.state.formModel as AccessRuleFormModel;
    const sst = snap.subSysOrTenant;
    if (Array.isArray(sst) && sst.length > 0) {
      fm.subSysOrTenant = [...sst];
    }
    if (snap.accessRuleTypeDictCode != null && String(snap.accessRuleTypeDictCode).trim() !== '') {
      fm.accessRuleTypeDictCode = String(snap.accessRuleTypeDictCode);
    }
  }

  /** 提交字段与后端 ISysAccessRuleFormBase 一致；systemCode 来自级联第一级 */
  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    delete params.subSysOrTenant;
    delete params.subSystemCode;
    const fm = this.state.formModel as AccessRuleFormModel;
    params.systemCode = fm.subSystemCode ?? null;
    return params;
  }
}

export default defineComponent({
  name: 'AccessRuleFormPage',
  props: {
    ...commonAddEditDialogProps,
    /** 与列表页 state.subSysOrTenants 同源，避免表单重复请求 */
    listSubSysOrTenants: { type: Object, default: undefined },
    listCascaderProps: { type: Object, default: undefined },
    listAtomicServiceList: { type: Array, default: undefined },
    /** 新增时从列表当前筛选预填：subSysOrTenant、accessRuleTypeDictCode */
    listSearchSnapshot: { type: Object, default: undefined },
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const { t } = useI18n();
    const setupReturn = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new AccessRuleFormPage(p, c),
      i18nKeyPrefix: 'accessRuleAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['accessRuleTypeDictCode', 'tenantId', 'subSystemCode', 'remark'],
          arrayKeys: ['subSysOrTenant'],
        });
      },
    });
    const page = setupReturn.page as AccessRuleFormPage & { state: Record<string, unknown> };

    const cascaderOptionsList = computed(
      () => (props as Record<string, unknown>).listSubSysOrTenants ?? page.state.subSysOrTenants
    );
    const cascaderPropsMerged = computed(
      () => (props as Record<string, unknown>).listCascaderProps ?? page.state.cascaderProps
    );

    function getAccessRuleTypeLabel(code: unknown): string {
      const c = String(code ?? '').trim();
      if (!c) return '—';
      const i18nKey = 'access_rule_type.' + c;
      const translated = t(i18nKey);
      return translated !== i18nKey ? translated : page.transDict('sys', 'access_rule_type', c) || c;
    }

    return {
      ...setupReturn,
      cascaderOptionsList,
      cascaderPropsMerged,
      getAccessRuleTypeLabel,
    };
  },
});
</script>
