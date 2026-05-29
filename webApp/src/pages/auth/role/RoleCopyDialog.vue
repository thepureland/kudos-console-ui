<!--
 * Copy an existing role into a new one.
 *
 * Loads the source role's detail to show the operator what they're cloning and pre-fill the
 * code/name suggestions. Submit issues a single POST to auth/role/copyRole which on the backend
 * atomically (a) inserts a new role with the supplied code/name plus the source's other fields,
 * and (b) — when "include resources" is checked — copies the source's resource grants in the
 * same transaction. There's no save+listResourceIds+bindResources sequence to fall halfway
 * through anymore.
 *
 * User assignments are intentionally NOT copied — a freshly-created role is usually meant for a
 * different audience than the source.
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
    return 'auth/role';
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
      dialog.state.submitting = true;
      try {
        // Single atomic POST replaces the old save + listResourceIds + bindResources sequence.
        // The backend reads the source role itself, so we don't need to ship its fields here —
        // only the override fields (code / name) and the copyResources flag.
        const fm = dialog.state.formModel as FormModel;
        const payload: Record<string, unknown> = {
          sourceId: props.rid,
          code: fm.roleCode,
          name: fm.roleName,
          copyResources: dialog.state.includeResources === true,
        };
        const result = await backendRequest({ url: 'auth/role/copyRole', method: 'post', params: payload });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('roleCopy.messages.createFailed'));
          return;
        }
        // Endpoint returns the new role id as a plain string (or wrapped in the standard envelope).
        const newId = extractSavedId(result);
        if (!newId) {
          ElMessage.error(t('roleCopy.messages.idMissing'));
          return;
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
