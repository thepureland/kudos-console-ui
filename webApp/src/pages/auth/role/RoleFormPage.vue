<!-- Role add/edit -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog role-add-edit-dialog"
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
        <div class="form-section__title">{{ t('roleAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('roleAddEdit.labels.roleCode')" prop="roleCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.roleCode"
                :placeholder="t('roleAddEdit.placeholders.roleCode')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('roleAddEdit.labels.roleName')" prop="roleName" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.roleName"
                :placeholder="t('roleAddEdit.placeholders.roleName')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('roleAddEdit.labels.subSysOrTenant')" prop="subSysOrTenant" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-cascader
                v-model="formModel.subSysOrTenant"
                :options="subSysOrTenants"
                :props="cascaderProps"
                :placeholder="t('roleAddEdit.placeholders.subSysOrTenant')"
                clearable
                class="form-select-full"
                @change="onSubSysOrTenantChange"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('roleAddEdit.labels.parentRole')" prop="parentId">
          <el-select
            v-model="formModel.parentId"
            :placeholder="formModel.subSysOrTenant?.length ? t('roleAddEdit.placeholders.parentRole') : t('roleAddEdit.placeholders.parentRoleLocked')"
            :disabled="!formModel.subSysOrTenant?.length"
            filterable
            remote
            clearable
            :remote-method="searchParentRoles"
            :loading="parentRoleLoading"
            class="form-select-full"
          >
            <el-option
              v-for="r in parentRoleCandidates"
              :key="r.id"
              :value="r.id"
              :label="r.label"
            />
          </el-select>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('roleAddEdit.sections.other') }}</div>
        <el-form-item :label="t('roleAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('roleAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('roleAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import '../../../styles/add-edit-dialog-common.css';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';
import { TenantSupportAddEditPage } from '../../../components/pages/support';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';

interface ParentOption {
  id: string;
  label: string;
}

interface FormModel {
  roleCode: string | null;
  roleName: string | null;
  /** Parent role id (NULL = root role; service validates same tenant + subsystem + no cycle). */
  parentId: string | null;
  remark: string | null;
  subSysOrTenant?: string[] | null;
}

const roleLabel = (row: Record<string, unknown>) =>
  String(row.name ?? row.code ?? row.id ?? '');

class RoleFormPage extends TenantSupportAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
  }

  /** Tenant cascader can only select the second level (must pick a specific tenant); consistent with the role list. */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        roleCode: null,
        roleName: null,
        parentId: null,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'auth/role';
  }

  protected getLoadFailedMessageKey(): string {
    return 'roleAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'RoleFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    const parentRoleCandidates = ref<ParentOption[]>([]);
    const parentRoleLoading = ref(false);

    const result = useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new RoleFormPage(p, c),
      i18nKeyPrefix: 'roleAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['roleCode', 'roleName', 'remark'],
          arrayKeys: ['subSysOrTenant'],
        });
      },
      /** When the dialog opens in edit mode, pre-load the current parent's label so the select shows it. */
      async onVisible(setupResult, p) {
        if (!p.rid) return;
        const fm = setupResult.page.state.formModel as FormModel | undefined;
        if (fm?.parentId) {
          await loadParentCandidates(fm.subSysOrTenant ?? null, '', fm.parentId);
        }
      },
    });

    /**
     * Search for eligible parent roles. The query is scoped to the same subsystem+tenant so the
     * backend's same-scope constraint is never violated from the UI. Excludes the role being edited
     * by filtering it out client-side (the backend also rejects self-parent on save).
     */
    async function loadParentCandidates(
      subSysOrTenant: string[] | null | undefined,
      keyword: string,
      currentParentId?: string,
    ): Promise<void> {
      if (!subSysOrTenant?.length) {
        parentRoleCandidates.value = [];
        return;
      }
      parentRoleLoading.value = true;
      try {
        const params: Record<string, unknown> = { pageNo: 1, pageSize: 50, active: true };
        params.subsysCode = subSysOrTenant[0];
        if (subSysOrTenant.length > 1) params.tenantId = subSysOrTenant[1];
        if (keyword?.trim()) params.name = keyword.trim();
        const res = await backendRequest({ url: 'auth/role/pagingSearch', method: 'post', params });
        if (!isApiSuccessResponse(res)) { parentRoleCandidates.value = []; return; }
        const payload = getApiResponseData<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(res);
        const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? []);
        // Filter out the role being edited so a role can't set itself as its own parent.
        const selfId = props.rid ? String(props.rid) : null;
        const candidates = rows
          .filter(r => String(r.id ?? '') !== selfId && String(r.id ?? '') !== '')
          .map(r => ({ id: String(r.id ?? ''), label: roleLabel(r) }));
        // When pre-loading for edit mode, ensure the current parent is in the list even if it
        // doesn't appear on the first page of results.
        if (currentParentId && !candidates.some(c => c.id === currentParentId)) {
          const parentRes = await backendRequest({ url: 'auth/role/getDetail', method: 'get', params: { id: currentParentId } });
          const detail = getApiResponseData<Record<string, unknown>>(parentRes);
          if (detail?.id) candidates.unshift({ id: String(detail.id), label: roleLabel(detail) });
        }
        parentRoleCandidates.value = candidates;
      } finally {
        parentRoleLoading.value = false;
      }
    }

    /** Called by the el-select remote search; keeps the selection in sync. */
    function searchParentRoles(keyword: string): void {
      const fm = result.page.state.formModel as FormModel | undefined;
      void loadParentCandidates(fm?.subSysOrTenant ?? null, keyword);
    }

    /** Called by the tenant cascader's @change event; clears the parent selection since scope changed. */
    function onSubSysOrTenantChange(val: string[] | null | undefined): void {
      const fm = result.page.state.formModel as FormModel | undefined;
      if (fm) fm.parentId = null;
      parentRoleCandidates.value = [];
      // Pre-load the first page so options appear immediately after tenant is selected.
      void loadParentCandidates(val ?? null, '');
    }

    // Pre-load parent candidates whenever the dialog opens in create mode (subSysOrTenant already set).
    watch(
      () => (result.page.state.formModel as FormModel | undefined)?.subSysOrTenant,
      (val) => {
        if (val?.length) void loadParentCandidates(val, '');
      },
    );

    return {
      ...result,
      parentRoleCandidates,
      parentRoleLoading,
      searchParentRoles,
      onSubSysOrTenantChange,
    };
  },
});
</script>

<style lang="css" scoped>
.form-select-full {
  width: 100%;
}
</style>

