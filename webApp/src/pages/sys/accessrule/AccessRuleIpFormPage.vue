<!--
 * IP 访问规则新增/编辑：级联仅可选租户（叶子），解析父访问规则 id；提交字段与 ISysAccessRuleIpFormBase 一致（ipv4/ipv6 字符串）。
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="720px"
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
      :rules="mergedRules"
      label-width="140px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('accessRuleIpAddEdit.sections.basicInfo') }}</div>
        <el-form-item
          :label="t('accessRuleIpAddEdit.labels.subSysOrTenant')"
          prop="subSysOrTenant"
          class="is-required"
          :rules="tenantCascaderRules"
        >
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
        <el-form-item :label="t('accessRuleIpAddEdit.labels.ipTypeDictCode')" prop="ipTypeDictCode" class="is-required">
          <el-select
            v-model="formModel.ipTypeDictCode"
            :placeholder="t('accessRuleIpAddEdit.placeholders.ipTypeDictCode')"
            clearable
            filterable
            class="form-select-full"
            @change="onIpTypeDictCodeChange"
          >
            <el-option
              v-for="item in (ipTypeOptions || [])"
              :key="item.first"
              :value="item.first"
              :label="t(item.second)"
            />
          </el-select>
        </el-form-item>
        <template v-if="String(formModel.ipTypeDictCode ?? '').toLowerCase() === 'ipv4'">
          <el-form-item :label="t('accessRuleIpAddEdit.labels.ipStart')" prop="ipv4StartStr">
            <IpSegmentedAddressInput v-model="formModel.ipv4StartStr" protocol="ipv4" />
          </el-form-item>
          <el-form-item :label="t('accessRuleIpAddEdit.labels.ipEnd')" prop="ipv4EndStr">
            <IpSegmentedAddressInput v-model="formModel.ipv4EndStr" protocol="ipv4" />
          </el-form-item>
        </template>
        <template v-else-if="String(formModel.ipTypeDictCode ?? '').toLowerCase() === 'ipv6'">
          <el-form-item :label="t('accessRuleIpAddEdit.labels.ipStart')" prop="ipv6StartStr">
            <IpSegmentedAddressInput v-model="formModel.ipv6StartStr" protocol="ipv6" />
          </el-form-item>
          <el-form-item :label="t('accessRuleIpAddEdit.labels.ipEnd')" prop="ipv6EndStr">
            <IpSegmentedAddressInput v-model="formModel.ipv6EndStr" protocol="ipv6" />
          </el-form-item>
        </template>
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
import { defineComponent, computed, type ComputedRef } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';
import { TenantSupportAddEditPage } from '../../../components/pages/support';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';
import {
  decimal128LikeToIpv6Full,
  ipv4PaddedToUint32,
  ipv6FullToBigUint128,
  isWellFormedIpv6Full,
  normalizeIpv6Full,
  uint32ToIpv4Padded,
} from '../../../utils/ipAddressNumeric';
import IpSegmentedAddressInput from './IpSegmentedAddressInput.vue';

const IPV6_ZERO = '0000:0000:0000:0000:0000:0000:0000:0000';

interface AccessRuleIpFormModel {
  subSysOrTenant: string[] | null;
  tenantId: string | null;
  subSystemCode: string | null;
  parentRuleId: string | null;
  /** 与 ISysAccessRuleIpFormBase / getEdit 一致 */
  ipTypeDictCode: string | null;
  ipv4StartStr: string;
  ipv4EndStr: string;
  ipv6StartStr: string;
  ipv6EndStr: string;
  expirationDate: string | null;
  remark: string | null;
  active: boolean;
}

class AccessRuleIpFormPage extends TenantSupportAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['ip_type'], 'sys').then(() => {
      (this.state as Record<string, unknown>).ipTypeOptions = this.getDictItems('sys', 'ip_type');
    });
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['ip_type'], atomicServiceCode: 'sys' }];
  }

  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  protected initState(): Record<string, unknown> {
    return {
      ipTypeOptions: [] as Array<{ first: string; second: string }>,
      formModel: {
        subSysOrTenant: null,
        tenantId: null,
        subSystemCode: null,
        parentRuleId: null,
        ipTypeDictCode: null,
        ipv4StartStr: uint32ToIpv4Padded(0),
        ipv4EndStr: uint32ToIpv4Padded(0),
        ipv6StartStr: IPV6_ZERO,
        ipv6EndStr: IPV6_ZERO,
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
    const typeCode = String(m.ipTypeDictCode ?? '').toLowerCase();
    const v4s = rowObject.ipv4StartStr;
    const v4e = rowObject.ipv4EndStr;
    const v6s = rowObject.ipv6StartStr;
    const v6e = rowObject.ipv6EndStr;

    if (typeCode === 'ipv4') {
      if (typeof v4s === 'string' && v4s.trim() !== '') {
        m.ipv4StartStr = uint32ToIpv4Padded(ipv4PaddedToUint32(v4s));
      } else {
        const a = parseNumericLike(rowObject.ipStart);
        m.ipv4StartStr = uint32ToIpv4Padded(Number.isFinite(a) ? (a >>> 0) : 0);
      }
      if (typeof v4e === 'string' && v4e.trim() !== '') {
        m.ipv4EndStr = uint32ToIpv4Padded(ipv4PaddedToUint32(v4e));
      } else {
        const b = parseNumericLike(rowObject.ipEnd);
        m.ipv4EndStr = uint32ToIpv4Padded(Number.isFinite(b) ? (b >>> 0) : 0);
      }
      m.ipv6StartStr = IPV6_ZERO;
      m.ipv6EndStr = IPV6_ZERO;
    } else if (typeCode === 'ipv6') {
      if (typeof v6s === 'string' && isWellFormedIpv6Full(v6s)) {
        m.ipv6StartStr = normalizeIpv6Full(v6s);
      } else {
        m.ipv6StartStr = decimal128LikeToIpv6Full(rowObject.ipStart);
      }
      if (typeof v6e === 'string' && isWellFormedIpv6Full(v6e)) {
        m.ipv6EndStr = normalizeIpv6Full(v6e);
      } else {
        m.ipv6EndStr = decimal128LikeToIpv6Full(rowObject.ipEnd);
      }
      m.ipv4StartStr = uint32ToIpv4Padded(0);
      m.ipv4EndStr = uint32ToIpv4Padded(0);
    } else {
      m.ipv4StartStr = uint32ToIpv4Padded(0);
      m.ipv4EndStr = uint32ToIpv4Padded(0);
      m.ipv6StartStr = IPV6_ZERO;
      m.ipv6EndStr = IPV6_ZERO;
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
      const tid = data.tenantId;
      if (tid != null && String(tid).trim() !== '') {
        fm.subSysOrTenant = [String(sys), String(tid)];
      } else {
        fm.subSysOrTenant = null;
      }
      fm.parentRuleId = parentRuleId;
    } catch {
      /* 忽略，级联可手选 */
    }
  }

  protected beforeValidate(): void {
    const fm = this.state.formModel as AccessRuleIpFormModel;
    const subSysOrTenant = fm.subSysOrTenant;
    if (!subSysOrTenant || subSysOrTenant.length === 0) {
      fm.subSystemCode = null;
      fm.tenantId = null;
    } else {
      fm.subSystemCode = subSysOrTenant[0];
      fm.tenantId = subSysOrTenant.length > 1 ? subSysOrTenant[1] : null;
    }
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    delete params.subSysOrTenant;
    delete params.ipStart;
    delete params.ipEnd;
    const fm = this.state.formModel as AccessRuleIpFormModel;
    if (!this.isEditMode()) {
      params.systemCode = fm.subSystemCode ?? null;
      params.tenantId = fm.tenantId ?? null;
    }
    delete params.subSystemCode;
    delete params.ipType;
    const code = String(fm.ipTypeDictCode ?? '').trim().toLowerCase();
    params.ipTypeDictCode =
      fm.ipTypeDictCode != null && String(fm.ipTypeDictCode).trim() !== ''
        ? String(fm.ipTypeDictCode).trim()
        : null;
    if (code === 'ipv4') {
      params.ipv4StartStr = fm.ipv4StartStr;
      params.ipv4EndStr = fm.ipv4EndStr;
      params.ipv6StartStr = null;
      params.ipv6EndStr = null;
    } else if (code === 'ipv6') {
      params.ipv4StartStr = null;
      params.ipv4EndStr = null;
      params.ipv6StartStr = fm.ipv6StartStr;
      params.ipv6EndStr = fm.ipv6EndStr;
    } else {
      params.ipv4StartStr = null;
      params.ipv4EndStr = null;
      params.ipv6StartStr = null;
      params.ipv6EndStr = null;
    }
    return params;
  }
}

function parseNumericLike(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

export default defineComponent({
  name: 'AccessRuleIpFormPage',
  components: { IpSegmentedAddressInput },
  props: {
    ...commonAddEditDialogProps,
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
          stringKeys: ['parentRuleId', 'remark', 'expirationDate', 'ipTypeDictCode'],
          arrayKeys: ['subSysOrTenant'],
          customChecks: [
            (m) => {
              const code = String(m.ipTypeDictCode ?? '').toLowerCase();
              if (code === 'ipv4') {
                const a = ipv4PaddedToUint32(String(m.ipv4StartStr));
                const b = ipv4PaddedToUint32(String(m.ipv4EndStr));
                return a !== 0 || b !== 0;
              }
              if (code === 'ipv6') {
                const z = IPV6_ZERO;
                const s = normalizeIpv6Full(String(m.ipv6StartStr));
                const e = normalizeIpv6Full(String(m.ipv6EndStr));
                return (s !== '' && String(m.ipv6StartStr) !== z) || (e !== '' && String(m.ipv6EndStr) !== z);
              }
              return false;
            },
          ],
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

    function getFm(): AccessRuleIpFormModel {
      return page.state.formModel as AccessRuleIpFormModel;
    }

    function onIpTypeDictCodeChange(): void {
      const fm = getFm();
      const c = String(fm.ipTypeDictCode ?? '').toLowerCase();
      if (c === 'ipv4') {
        fm.ipv6StartStr = IPV6_ZERO;
        fm.ipv6EndStr = IPV6_ZERO;
      } else if (c === 'ipv6') {
        fm.ipv4StartStr = uint32ToIpv4Padded(0);
        fm.ipv4EndStr = uint32ToIpv4Padded(0);
      }
    }

    /** 与后端注解 message / initValidationRule 拉取的 valid-msg 一致（非 accessRuleIpAddEdit 下重复文案） */
    const validMsgGeIpStart = () => t('valid-msg.accessrule.ge-ip-start') as string;
    const validMsgIpv6FullPattern = () => t('valid-msg.default.Pattern::ipv6-full') as string;
    const validMsgNotBlank = () => t('valid-msg.default.NotBlank') as string;

    const mergedRules = computed(() => {
      const raw = page.state.rules as Record<string, unknown> | null | undefined;
      const base =
        raw != null && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
      const ipv4EndRules = [...(Array.isArray(base.ipv4EndStr) ? (base.ipv4EndStr as unknown[]) : [])];
      ipv4EndRules.push({
        validator(_r: unknown, _v: unknown, cb: (e?: Error) => void) {
          const fm = getFm();
          if (String(fm.ipTypeDictCode ?? '').toLowerCase() !== 'ipv4') {
            cb();
            return;
          }
          const a = ipv4PaddedToUint32(fm.ipv4StartStr);
          const b = ipv4PaddedToUint32(fm.ipv4EndStr);
          if (a > b) cb(new Error(validMsgGeIpStart()));
          else cb();
        },
        trigger: 'change',
      });
      const ipv6EndRules = [...(Array.isArray(base.ipv6EndStr) ? (base.ipv6EndStr as unknown[]) : [])];
      ipv6EndRules.push({
        validator(_r: unknown, _v: unknown, cb: (e?: Error) => void) {
          const fm = getFm();
          if (String(fm.ipTypeDictCode ?? '').toLowerCase() !== 'ipv6') {
            cb();
            return;
          }
          const s = normalizeIpv6Full(fm.ipv6StartStr);
          const e = normalizeIpv6Full(fm.ipv6EndStr);
          if (!isWellFormedIpv6Full(s) || !isWellFormedIpv6Full(e)) {
            cb(new Error(validMsgIpv6FullPattern()));
            return;
          }
          if (ipv6FullToBigUint128(e) < ipv6FullToBigUint128(s)) {
            cb(new Error(validMsgGeIpStart()));
            return;
          }
          cb();
        },
        trigger: 'change',
      });
      return { ...base, ipv4EndStr: ipv4EndRules, ipv6EndStr: ipv6EndRules };
    });

    const tenantCascaderRules: ComputedRef<
      Array<{ required: boolean; trigger: string; validator: (rule: unknown, value: unknown, callback: (e?: Error) => void) => void }>
    > = computed(() => [
      {
        required: true,
        trigger: 'change',
        validator: (_rule: unknown, value: unknown, callback: (e?: Error) => void) => {
          if (value == null || !Array.isArray(value) || value.length < 2) {
            callback(new Error(validMsgNotBlank()));
            return;
          }
          callback();
        },
      },
    ]);

    const cascaderOptionsList = computed(
      () => (props as Record<string, unknown>).listSubSysOrTenants ?? page.state.subSysOrTenants
    );
    const cascaderPropsMerged = computed(() => {
      const base =
        ((props as Record<string, unknown>).listCascaderProps as Record<string, unknown> | undefined) ??
        (page.state.cascaderProps as Record<string, unknown> | undefined);
      return { ...base, checkStrictly: false };
    });

    async function onSubSysOrTenantChange(): Promise<void> {
      const fm = page.state.formModel as AccessRuleIpFormModel;
      const arr = fm.subSysOrTenant;
      if (!arr || arr.length < 2) {
        fm.parentRuleId = null;
        return;
      }
      const systemCode = arr[0];
      const tenantId = arr[1];
      try {
        const result = await backendRequest({
          url: 'sys/accessRuleIp/searchBySystemCodeAndTenantId',
          method: 'get',
          params: { systemCode, tenantId: String(tenantId) },
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
      mergedRules,
      tenantCascaderRules,
      cascaderOptionsList,
      cascaderPropsMerged,
      onSubSysOrTenantChange,
      onIpTypeDictCodeChange,
    };
  },
});
</script>
