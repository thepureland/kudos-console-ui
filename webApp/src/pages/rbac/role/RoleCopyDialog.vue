<!--
 * Copy an existing role into a new one.
 *
 * Loads the source role's detail and presents a small form for the unique fields (code/name); the
 * rest (subsystem, tenant, remark) are inherited from the source. On submit:
 *   1. POST rbac/role/save with the merged payload to create the new role.
 *   2. If "include resources" is checked, fetch the source role's listResourceIds and bind them
 *      to the new role via bindResources.
 *
 * User assignments are intentionally NOT copied — a freshly-created role is usually meant for a
 * different audience than the source. If that's needed later, expose another checkbox and reuse
 * the same fan-out pattern (listUserIds + bindUsers).
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog :title="t('roleCopy.title')" v-model="visible" width="520px" center @close="close" :close-on-click-modal="false">
    <el-form
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-width="140px"
      label-position="right"
      class="add-edit-dialog-form"
      v-loading="loading"
    >
      <el-form-item :label="t('roleCopy.fields.sourceRole')">
        <span>{{ sourceLabel }}</span>
      </el-form-item>
      <el-form-item :label="t('roleCopy.fields.newRoleCode')" prop="roleCode" class="is-required">
        <el-input v-model="formModel.roleCode" :placeholder="t('roleCopy.placeholders.newRoleCode')" clearable />
      </el-form-item>
      <el-form-item :label="t('roleCopy.fields.newRoleName')" prop="roleName" class="is-required">
        <el-input v-model="formModel.roleName" :placeholder="t('roleCopy.placeholders.newRoleName')" clearable />
      </el-form-item>
      <el-form-item :label="t('roleCopy.fields.options')">
        <el-checkbox v-model="includeResources">{{ t('roleCopy.options.includeResources') }}</el-checkbox>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="close">{{ t('roleCopy.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('roleCopy.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import { computed, defineComponent, reactive, ref, toRefs } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { normalizeIdSet } from '../_shared/assignmentTransferUtils';

interface FormModel {
  roleCode: string | null;
  roleName: string | null;
}

/** Extracted from BaseAddEditPage.getSavedIdFromResponse — same shape, kept local to avoid coupling to that base class. */
function extractSavedId(data: unknown): string | number | null {
  const payload = getApiResponseData(data);
  if (payload !== data) return extractSavedId(payload);
  if (data == null) return null;
  if (typeof data === 'string' || typeof data === 'number') return data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown> | undefined;
    return first != null && 'id' in first ? (first.id as string | number) : null;
  }
  if (typeof data === 'object' && data !== null) {
    const o = data as Record<string, unknown>;
    if ('id' in o && o.id != null) return o.id as string | number;
    const list = o.data as unknown[] | undefined;
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0] as Record<string, unknown> | undefined;
      return first != null && 'id' in first ? (first.id as string | number) : null;
    }
  }
  return null;
}

class RoleCopyDialog extends BaseDetailPage {
  /** Source role's detail, loaded in loadData. Used to fill the new role's non-edited fields. */
  public sourceDetail: Record<string, unknown> | null = null;

  constructor(props: any, context: any) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'rbac/role';
  }

  protected initState(): any {
    return {
      formModel: { roleCode: null, roleName: null } as FormModel,
      includeResources: true,
      submitting: false,
      loading: true,
      sourceLabel: '',
    };
  }

  protected postLoadDataSuccessfully(data: unknown): void {
    this.sourceDetail = (data && typeof data === 'object') ? data as Record<string, unknown> : null;
    const code = this.sourceDetail?.roleCode ?? this.sourceDetail?.code ?? '';
    const name = this.sourceDetail?.roleName ?? this.sourceDetail?.name ?? '';
    this.state.sourceLabel = `${name}${name && code ? ' / ' : ''}${code}`;
    // Pre-fill suggested code/name with a "_copy" suffix.
    const sm = this.state.formModel as FormModel;
    if (code) sm.roleCode = `${code}_copy`;
    if (name) sm.roleName = `${name} (copy)`;
    this.state.loading = false;
    super.postLoadDataSuccessfully(data);
  }
}

export default defineComponent({
  name: 'RoleCopyDialog',
  props: {
    modelValue: Boolean,
    /** Source role id to copy from. */
    rid: String,
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const dialog = reactive(new RoleCopyDialog(props, context));
    const formRef = ref<FormInstance | null>(null);

    const rules = computed(() => ({
      roleCode: [{ required: true, message: t('roleCopy.validation.requiredRoleCode'), trigger: 'blur' }],
      roleName: [{ required: true, message: t('roleCopy.validation.requiredRoleName'), trigger: 'blur' }],
    }));

    async function doSubmit(): Promise<void> {
      const inst = formRef.value;
      if (!inst) return;
      const valid = await inst.validate().catch(() => false);
      if (!valid) return;
      const source = dialog.sourceDetail;
      if (!source) {
        ElMessage.error(t('roleCopy.messages.sourceMissing'));
        return;
      }
      dialog.state.submitting = true;
      try {
        // Map detail (DetailPage fields are roleCode/roleName/subSystemCode/tenantId/...) to the
        // form-create VO (code/name/subsysCode/tenantId/remark) the backend expects.
        const fm = dialog.state.formModel as FormModel;
        const payload: Record<string, unknown> = {
          code: fm.roleCode,
          name: fm.roleName,
          remark: source.remark ?? null,
          subsysCode: source.subSystemCode ?? source.subsysCode ?? null,
          tenantId: source.tenantId ?? null,
        };
        const saveResult = await backendRequest({ url: 'rbac/role/save', method: 'post', params: payload });
        if (!isApiSuccessResponse(saveResult)) {
          ElMessage.error(await resolveApiResponseMessage(saveResult) || getApiResponseMessage(saveResult) || t('roleCopy.messages.createFailed'));
          return;
        }
        const newId = extractSavedId(saveResult);
        if (!newId) {
          ElMessage.error(t('roleCopy.messages.idMissing'));
          return;
        }

        if (dialog.state.includeResources) {
          const sourceIdsResult = await backendRequest({
            url: 'rbac/role/listResourceIds',
            method: 'get',
            params: { roleId: props.rid },
          });
          if (isApiSuccessResponse(sourceIdsResult)) {
            const ids = normalizeIdSet(getApiResponseData<unknown>(sourceIdsResult));
            if (ids.length > 0) {
              const bindUrl = `rbac/role/bindResources?roleId=${encodeURIComponent(String(newId))}`;
              const bindResult = await backendRequest({ url: bindUrl, method: 'post', params: ids as unknown as Record<string, unknown> });
              if (!isApiSuccessResponse(bindResult)) {
                // New role exists but resources didn't copy — warn instead of erroring out.
                ElMessage.warning(t('roleCopy.messages.resourcesPartial'));
                context.emit('response', { id: newId });
                context.emit('update:modelValue', false);
                return;
              }
            }
          }
        }

        ElMessage.success(t('roleCopy.messages.success'));
        context.emit('response', { id: newId });
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error(String(err));
      } finally {
        dialog.state.submitting = false;
      }
    }

    return {
      t,
      formRef,
      rules,
      submit: doSubmit,
      ...toRefs(dialog),
      ...toRefs(dialog.state),
    };
  },
});
</script>

<style lang='css' scoped>
@import '../../../styles/add-edit-dialog-common.css';
</style>
