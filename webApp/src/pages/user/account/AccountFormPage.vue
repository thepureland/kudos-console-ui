<!-- 账号新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog account-add-edit-dialog"
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
        <div class="form-section__title">{{ t('accountAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('accountAddEdit.labels.username')" prop="username" class="is-required">
          <el-input v-model="formModel.username" :placeholder="t('accountAddEdit.placeholders.username')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('accountAddEdit.labels.subSysOrTenant')" prop="subSysOrTenant" class="is-required">
          <el-cascader
            ref="subSysOrTenantCascaderRef"
            v-model="formModel.subSysOrTenant"
            :options="subSysOrTenants || []"
            :props="subSysOrTenantCascaderProps"
            :placeholder="t('accountAddEdit.placeholders.subSysOrTenant')"
            clearable
            class="form-select-full"
            @change="(val) => onSubSysOrTenantChange(val)"
          />
        </el-form-item>
        <el-form-item :label="t('accountAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-cascader
            ref="parentCascaderRef"
            v-model="formModel.parent"
            :options="organizationTree || []"
            :props="cascaderProps"
            :placeholder="t('accountAddEdit.placeholders.parent')"
            clearable
            class="form-select-full"
            @change="onParentChange"
          />
        </el-form-item>
        <el-form-item :label="t('accountAddEdit.labels.userTypeDictCode')" prop="userTypeDictCode" class="is-required">
          <el-select v-model="formModel.userTypeDictCode" :placeholder="t('accountAddEdit.placeholders.userTypeDictCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in getDictItems('user', 'user_type')" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('accountAddEdit.sections.other') }}</div>
        <el-form-item :label="t('accountAddEdit.labels.remark')" prop="remark">
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('formCommon.remarkPlaceholderWithMax', { max: remarkMaxLength })" :maxlength="remarkMaxLength" show-word-limit resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('accountAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('accountAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Pair } from '../../../components/model/Pair';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent, useCloseDropdownOnChange } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';
import { OrgSupportAddEditPage } from '../../../components/pages/support';

class AccountFormPage extends OrgSupportAddEditPage {
  constructor(
    props: Record<string, unknown>,
    context: { emit: (event: string, ...args: unknown[]) => void },
    parentCascader: { value?: { getCheckedNodes: () => unknown[] } }
  ) {
    super(props, context, parentCascader);
    this.loadDicts(['user_type'], 'user');
  }

  /** 租户级联与列表页一致：非严格模式，选叶子节点后自动收起 */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initVars(): void {
    super.initVars();
    // 所属组织级联：非懒加载，用 organizationTree（根据 subSysOrTenant 调 loadTree 与列表页一致）
    this.state.cascaderProps = {
      value: 'id',
      label: 'name',
      children: 'children',
      multiple: false,
      checkStrictly: true,
      expandTrigger: 'hover',
    };
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        username: null as string | null,
        userTypeDictCode: null as string | null,
        remark: null as string | null,
      },
      subSysOrTenantCascaderProps: {
        value: 'value',
        label: 'label',
        multiple: false,
        checkStrictly: false,
        expandTrigger: 'hover',
      },
      organizationTree: [] as unknown[],
    };
  }

  protected getRootActionPath(): string {
    return 'user/account';
  }

  /** 用户类型字典项译文从后端取 */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['user_type', 'user_status'], atomicServiceCode: 'user' }];
  }

  protected getLoadFailedMessageKey(): string {
    return 'accountAddEdit.messages.loadFailed';
  }

  /** 子系统/租户变更时重新加载组织树并清空所属组织（可由 @change 传入选中值，避免 v-model 未同步时读不到） */
  onSubSysOrTenantChange(selectionFromChange?: string[]): void {
    this.loadOrganizationTree(selectionFromChange);
  }

  /** 根据当前所选子系统/租户加载组织机构树（与列表页 loadTree 一致）。可选传入选中的值，避免 change 时 formModel 尚未更新。 */
  async loadOrganizationTree(selectionOverride?: string[]): Promise<void> {
    const arr = (selectionOverride ?? this.state.formModel?.subSysOrTenant) as string[] | undefined;
    if (!arr?.length) {
      this.state.organizationTree = [];
      this.state.formModel.parent = [];
      return;
    }
    const subSystemCode = arr[0];
    const tenantId = arr.length > 1 ? arr[1] : null;
    const params = { subSystemCode, tenantId } as { subSystemCode: string; tenantId: string | null };
    const result = await backendRequest({ url: 'user/organization/loadTree', params });
    const payload = getApiResponseData<Record<string, unknown>[]>(result);
    if (Array.isArray(payload)) {
      this.state.organizationTree = payload;
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '加载组织机构树失败！');
      this.state.organizationTree = [];
    }
    this.state.formModel.parent = [];
  }

  /** 编辑时根据回填的 subSystemCode/tenantId 加载组织树（供 fillForm 后调用） */
  async loadOrganizationTreeForEdit(subSystemCode: string, tenantId: string | null): Promise<void> {
    const params = { subSystemCode, tenantId };
    const result = await backendRequest({ url: 'user/organization/loadTree', params });
    const payload = getApiResponseData<Record<string, unknown>[]>(result);
    if (Array.isArray(payload)) {
      this.state.organizationTree = payload;
    } else {
      this.state.organizationTree = [];
    }
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    let parentIds = (rowObject.parentIds as string[] | undefined) ?? [];
    if (parentIds.length === 0 && rowObject.organizationId) {
      parentIds = [String(rowObject.organizationId)];
    }
    const subSys = rowObject.subSystemCode as string | undefined;
    const tenantId = (rowObject.tenantId as string | undefined) ?? null;
    this.state.formModel.parent = parentIds;
    if (subSys) {
      this.loadOrganizationTreeForEdit(subSys, tenantId ?? null).then(() => {
        setTimeout(() => {
          this.state.formModel.parent = [...parentIds];
        }, 0);
      });
    }
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const fm = this.state.formModel as { subSysOrTenant?: string[]; parent?: string[] };
    const subSysOrTenant = fm.subSysOrTenant;
    if (subSysOrTenant?.length) {
      params.subSystemCode = subSysOrTenant[0];
      params.tenantId = subSysOrTenant.length > 1 ? subSysOrTenant[1] : null;
    }
    const parent = fm.parent;
    if (parent?.length) {
      params.parentId = parent[parent.length - 1];
    }
    return params;
  }
}

export default defineComponent({
  name: 'AccountFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const parentCascaderRef = ref<{ getCheckedNodes: () => unknown[] } | null>(null);
    const subSysOrTenantCascaderRef = ref(null);
    const addEditPageRef = ref<{ loadOrganizationTree?: (v?: string[]) => Promise<void> } | null>(null);
    const { closeDropdown } = useCloseDropdownOnChange();
    const result = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => {
        const page = new AccountFormPage(p, c, parentCascaderRef as { value?: { getCheckedNodes: () => unknown[] } });
        addEditPageRef.value = page;
        return page;
      },
      i18nKeyPrefix: 'accountAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['username', 'remark'],
          arrayKeys: ['subSysOrTenant', 'parent'],
          valueKeys: ['userTypeDictCode'],
        });
      },
    });
    return {
      ...result,
      parentCascaderRef,
      subSysOrTenantCascaderRef,
      onSubSysOrTenantChange(val?: string[]) {
        addEditPageRef.value?.loadOrganizationTree?.(val);
        closeDropdown(subSysOrTenantCascaderRef);
      },
      onParentChange() {
        closeDropdown(parentCascaderRef);
      },
    };
  },
});
</script>

