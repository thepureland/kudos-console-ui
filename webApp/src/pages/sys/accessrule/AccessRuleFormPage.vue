<!--
 * Access rule add/edit: cascader allows only tenant (leaf) selection; rule type; tenant data is injected by the list page.
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
        <el-form-item
          :label="t('accessRuleAddEdit.labels.subSysOrTenant')"
          prop="subSysOrTenant"
          class="is-required"
          :rules="tenantCascaderRules"
        >
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
              v-for="item in (ruleTypeOptions || [])"
              :key="item.first"
              :value="item.first"
              :label="t(item.second)"
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
import { defineComponent, computed, type ComputedRef } from 'vue';
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

  /** Consistent with the access-rule list: level 1 is getAllActiveSubSystemCodes; tenants are lazy-loaded. */
  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  /** Before validation, split the cascader value into subSystemCode + tenantId.
   *  A tenant (leaf, depth 2) must be selected — checkStrictly is false so intermediate
   *  nodes are not selectable anyway, but this guard handles a cleared/null cascader. */
  protected beforeValidate(): void {
    const fm = this.state.formModel as AccessRuleFormModel;
    const sst = fm.subSysOrTenant;
    if (!sst || sst.length === 0) {
      fm.subSystemCode = null;
      fm.tenantId = null;
      return;
    }
    fm.subSystemCode = sst[0];
    // sst[1] is the tenant segment; absent when only the sub-system node is set (edge case)
    fm.tenantId = sst.length > 1 ? sst[1] : null;
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

  /** Back-fill on edit: reconstruct the cascader array from the loaded record.
   *  Platform-level rules (no tenantId) leave the cascader null so the user must
   *  explicitly pick a tenant — preventing an accidental save without a scope. */
  protected fillForm(rowObject: Record<string, unknown>): void {
    BaseAddEditPage.prototype.fillForm.call(this, rowObject);
    const fm = this.state.formModel as AccessRuleFormModel;
    // Backend may return either "systemCode" or "subSystemCode" depending on API version
    const sys = rowObject.systemCode ?? rowObject.subSystemCode;
    if (sys == null || sys === '') return;
    const tid = rowObject.tenantId;
    // Only populate the cascader when a tenant is present; coerce to string for type safety
    fm.subSysOrTenant =
      tid != null && String(tid).trim() !== '' ? [String(sys), String(tid)] : null;
  }

  public resetFormForAdd(): void {
    super.resetFormForAdd();
    const snap = this.props.listSearchSnapshot as Record<string, unknown> | undefined;
    if (!snap) return;
    const fm = this.state.formModel as AccessRuleFormModel;
    const sst = snap.subSysOrTenant;
    if (Array.isArray(sst) && sst.length >= 2) {
      fm.subSysOrTenant = [...sst];
    }
    if (snap.accessRuleTypeDictCode != null && String(snap.accessRuleTypeDictCode).trim() !== '') {
      fm.accessRuleTypeDictCode = String(snap.accessRuleTypeDictCode);
    }
  }

  /** Submission fields match the backend ISysAccessRuleFormBase; systemCode comes from the cascader's first level. */
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
    /** Same source as the list page's state.subSysOrTenants to avoid redundant form requests. */
    listSubSysOrTenants: { type: Object, default: undefined },
    listCascaderProps: { type: Object, default: undefined },
    listAtomicServiceList: { type: Array, default: undefined },
    /** On add, prefill from the list's current filters: subSysOrTenant and accessRuleTypeDictCode. */
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

    const tenantCascaderRules: ComputedRef<
      Array<{ required: boolean; trigger: string; validator: (rule: unknown, value: unknown, callback: (e?: Error) => void) => void }>
    > = computed(() => [
      {
        required: true,
        trigger: 'change',
        validator: (_rule: unknown, value: unknown, callback: (e?: Error) => void) => {
          // Require exactly two segments [subSystemCode, tenantId]; a single-level
          // selection (sub-system only) is not a valid scope for an access rule.
          if (value == null || !Array.isArray(value) || value.length < 2) {
            callback(new Error(t('accessRuleAddEdit.validation.tenantRequired')));
            return;
          }
          callback();
        },
      },
    ]);

    // Props are widened to Record<string, unknown> because the extra list-page props are not
    // part of the shared AddEditDialogProps type but are passed through at runtime.
    const cascaderOptionsList = computed(
      () => (props as Record<string, unknown>).listSubSysOrTenants ?? page.state.subSysOrTenants
    );
    const cascaderPropsMerged = computed(() => {
      const base =
        ((props as Record<string, unknown>).listCascaderProps as Record<string, unknown> | undefined) ??
        (page.state.cascaderProps as Record<string, unknown> | undefined);
      // Enforce leaf-only selection: checkStrictly: false prevents picking an intermediate node
      return { ...base, checkStrictly: false };
    });

    return {
      ...setupReturn,
      tenantCascaderRules,
      cascaderOptionsList,
      cascaderPropsMerged,
    };
  },
});
</script>
