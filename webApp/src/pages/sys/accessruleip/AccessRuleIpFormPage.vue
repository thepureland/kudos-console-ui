<!--
 * IP 访问规则新增/编辑：子系统/租户（解析父访问规则 id）、IP 段等（sys/accessRuleIp）。
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="560px"
    center
    class="add-edit-dialog access-rule-ip-add-edit-dialog"
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
        <div class="form-section__title">{{ t('accessRuleIpAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.subSysOrTenant')" prop="subSysOrTenant" class="is-required">
          <el-cascader
            v-model="formModel.subSysOrTenant"
            :options="cascaderOptionsList || []"
            :props="cascaderPropsMerged"
            :placeholder="t('accessRuleIpAddEdit.placeholders.subSysOrTenant')"
            clearable
            class="form-select-full"
            :disabled="isEdit"
            @change="onSubSysOrTenantChange"
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.ipStart')" prop="ipStart">
          <el-input-number
            v-model="formModel.ipStart"
            :min="0"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.ipEnd')" prop="ipEnd">
          <el-input-number
            v-model="formModel.ipEnd"
            :min="0"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.ipType')" prop="ipType">
          <el-input-number
            v-model="formModel.ipType"
            :min="0"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.expirationDate')" prop="expirationDate">
          <el-date-picker
            v-model="formModel.expirationDate"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :placeholder="t('accessRuleIpAddEdit.placeholders.expirationDate')"
            class="form-select-full"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.active')" prop="active">
          <el-switch v-model="formModel.active" :active-value="true" :inactive-value="false" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accessRuleIpAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accessRuleIpAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('accessRuleIpAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accessRuleIpAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';
import { TenantSupportAddEditPage } from '../../../components/pages/support';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';

interface AccessRuleIpFormModel {
  subSysOrTenant: string[] | null;
  tenantId: string | null;
  subSystemCode: string | null;
  parentRuleId: string | null;
  ipStart: number | null;
  ipEnd: number | null;
  ipType: number | null;
  expirationDate: string | null;
  remark: string | null;
  active: boolean;
}

class AccessRuleIpFormPage extends TenantSupportAddEditPage {
  constructor(props: PageProps, context: PageContext) {
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
        subSysOrTenant: null,
        tenantId: null,
        subSystemCode: null,
        parentRuleId: null,
        ipStart: null,
        ipEnd: null,
        ipType: null,
        expirationDate: null,
        remark: null,
        active: true,
      } as AccessRuleIpFormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/accessRuleIp';
  }

  protected getLoadFailedMessageKey(): string {
    return 'accessRuleIpAddEdit.messages.loadFailed';
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const pid = rowObject.parentRuleId;
    if (pid != null && String(pid).trim() !== '') {
      void this.loadCascadeForParentRule(String(pid));
    }
    const m = this.state.formModel as AccessRuleIpFormModel;
    for (const k of ['ipStart', 'ipEnd', 'ipType'] as const) {
      const v = m[k];
      if (v !== undefined && v !== null && typeof v !== 'number') {
        const n = Number(v);
        m[k] = Number.isFinite(n) ? n : null;
      }
    }
  }

  /** 编辑回显：按父规则 id 拉取访问规则，拼子系统/租户级联 */
  public async loadCascadeForParentRule(parentRuleId: string): Promise<void> {
    if (!parentRuleId.trim()) return;
    try {
      const result = await backendRequest({ url: 'sys/accessRule/getEdit', params: { id: parentRuleId } });
      if (!isApiSuccessResponse(result)) return;
      const data = getApiResponseData<Record<string, unknown>>(result);
      if (data == null || typeof data !== 'object') return;
      const fm = this.state.formModel as AccessRuleIpFormModel;
      const sys = data.systemCode ?? data.subSystemCode;
      if (sys == null || sys === '') return;
      const arr: string[] = [String(sys)];
      const tid = data.tenantId;
      if (tid != null && String(tid).trim() !== '') arr.push(String(tid));
      fm.subSysOrTenant = arr;
      fm.parentRuleId = parentRuleId;
    } catch {
      /* 忽略，级联可手选 */
    }
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    delete params.subSysOrTenant;
    delete params.subSystemCode;
    delete params.tenantId;
    return params;
  }
}

export default defineComponent({
  name: 'AccessRuleIpFormPage',
  props: {
    ...commonAddEditDialogProps,
    /** 新增时预填父访问规则（与列表行一致时由列表传入，用于级联与 parentRuleId） */
    defaultParentRuleId: {
      type: String,
      default: '',
    },
    listSubSysOrTenants: { type: Object, default: undefined },
    listCascaderProps: { type: Object, default: undefined },
    listAtomicServiceList: { type: Array, default: undefined },
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps & { defaultParentRuleId?: string }, context: AddEditDialogContext) {
    const { t } = useI18n();
    const setupResult = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new AccessRuleIpFormPage(p, c),
      i18nKeyPrefix: 'accessRuleIpAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['parentRuleId', 'remark', 'expirationDate'],
          arrayKeys: ['subSysOrTenant'],
          valueKeys: ['ipStart', 'ipEnd', 'ipType'],
          customChecks: [(m) => m.active === false],
        });
      },
      onVisible: async (result, p) => {
        const rid = p.rid ? String(p.rid) : '';
        const defPid = (p as { defaultParentRuleId?: string }).defaultParentRuleId;
        if (rid) return;
        if (defPid != null && String(defPid).trim() !== '') {
          const page = result.page as AccessRuleIpFormPage;
          await page.loadCascadeForParentRule(String(defPid));
        }
      },
    });
    const page = setupResult.page as AccessRuleIpFormPage & { state: Record<string, unknown> };

    const cascaderOptionsList = computed(
      () => (props as Record<string, unknown>).listSubSysOrTenants ?? page.state.subSysOrTenants
    );
    const cascaderPropsMerged = computed(
      () => (props as Record<string, unknown>).listCascaderProps ?? page.state.cascaderProps
    );

    async function onSubSysOrTenantChange(): Promise<void> {
      const fm = page.state.formModel as AccessRuleIpFormModel;
      const arr = fm.subSysOrTenant;
      if (!arr || arr.length === 0) {
        fm.parentRuleId = null;
        return;
      }
      const systemCode = arr[0];
      const tenantId = arr.length > 1 ? arr[1] : null;
      try {
        const result = await backendRequest({
          url: 'sys/accessRuleIp/searchBySystemCodeAndTenantId',
          method: 'get',
          params:
            tenantId != null && String(tenantId).trim() !== ''
              ? { systemCode, tenantId: String(tenantId) }
              : { systemCode },
        });
        if (!isApiSuccessResponse(result)) {
          fm.parentRuleId = null;
          ElMessage.error(t('accessRuleIpAddEdit.messages.resolveParentFailed'));
          return;
        }
        const rows = getApiResponseData<unknown[]>(result);
        if (!Array.isArray(rows) || rows.length === 0) {
          fm.parentRuleId = null;
          ElMessage.warning(t('accessRuleIpAddEdit.messages.noParentRule'));
          return;
        }
        const first = rows[0] as Record<string, unknown>;
        const pid = first.parentId ?? first.id;
        fm.parentRuleId = pid != null && String(pid).trim() !== '' ? String(pid) : null;
        if (!fm.parentRuleId) {
          ElMessage.warning(t('accessRuleIpAddEdit.messages.noParentRule'));
        }
      } catch {
        fm.parentRuleId = null;
        ElMessage.error(t('accessRuleIpAddEdit.messages.resolveParentFailed'));
      }
    }

    return {
      ...setupResult,
      props,
      cascaderOptionsList,
      cascaderPropsMerged,
      onSubSysOrTenantChange,
    };
  },
});
</script>
