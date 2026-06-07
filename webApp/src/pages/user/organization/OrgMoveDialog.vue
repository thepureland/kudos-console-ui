<!--
 * Move an organization: reparent and/or reorder it within the tenant's org tree.
 *
 * Backend: POST user/organization/moveOrg?id=&newParentId=&newSortNum=
 * The new-parent picker loads the tenant's org tree (user/organization/loadTree) and prunes the moving
 * node's own subtree so it cannot be reparented under itself (which would create a cycle).
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="t('organizationMove.title')"
    width="480px"
    center
    align-center
    class="add-edit-dialog org-move-dialog"
    :append-to-body="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form label-width="110px" label-position="right" class="add-edit-dialog-form">
        <el-form-item :label="t('organizationMove.labels.newParent')">
          <el-tree-select
            v-model="newParentId"
            :data="orgTree"
            :props="treeProps"
            node-key="id"
            check-strictly
            :render-after-expand="false"
            clearable
            :placeholder="t('organizationMove.placeholders.newParent')"
            class="org-move-full"
          />
        </el-form-item>
        <el-form-item :label="t('organizationMove.labels.newSortNum')">
          <el-input-number v-model="newSortNum" :min="0" :max="999999999" controls-position="right" class="org-move-full" />
        </el-form-item>
        <el-alert :title="t('organizationMove.hint')" type="info" :closable="false" show-icon />
      </el-form>
    </div>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleClose">{{ t('organizationMove.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ t('organizationMove.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import '../../../styles/add-edit-dialog-common.css';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

type OrgNode = Record<string, unknown> & { id?: string; children?: OrgNode[] };

export default defineComponent({
  name: 'OrgMoveDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    rid: { type: String, required: true },
    subSystemCode: { type: String, default: null },
    tenantId: { type: String, default: null },
    currentParentId: { type: String, default: null },
    currentSortNum: { type: Number, default: 0 },
  },
  emits: ['update:modelValue', 'response'],
  setup(props, context) {
    const { t } = useI18n();
    const loading = ref(true);
    const submitting = ref(false);
    const orgTree = ref<OrgNode[]>([]);
    const newParentId = ref<string | null>(props.currentParentId || null);
    const newSortNum = ref<number>(props.currentSortNum ?? 0);
    const treeProps = { label: 'name', children: 'children' };

    /** Drop the moving node (and thus its whole subtree) so it can't become its own ancestor. */
    function prune(nodes: OrgNode[]): OrgNode[] {
      const out: OrgNode[] = [];
      for (const n of nodes) {
        if (String(n.id ?? '') === props.rid) continue;
        const copy: OrgNode = { ...n };
        if (Array.isArray(n.children) && n.children.length) copy.children = prune(n.children);
        out.push(copy);
      }
      return out;
    }

    async function load(): Promise<void> {
      loading.value = true;
      try {
        if (!props.subSystemCode) { orgTree.value = []; return; }
        const result = await backendRequest({ url: 'user/organization/loadTree', method: 'get', params: { subSystemCode: props.subSystemCode, tenantId: props.tenantId } });
        const payload = getApiResponseData<OrgNode[]>(result);
        orgTree.value = Array.isArray(payload) ? prune(payload) : [];
      } finally {
        loading.value = false;
      }
    }

    function handleClose(): void {
      context.emit('update:modelValue', false);
    }

    async function submit(): Promise<void> {
      submitting.value = true;
      try {
        const params: Record<string, unknown> = { id: props.rid };
        if (newParentId.value) params.newParentId = newParentId.value;
        if (newSortNum.value != null) params.newSortNum = newSortNum.value;
        const result = await backendRequest({ url: 'user/organization/moveOrg', method: 'post', params, paramsInQuery: true });
        if (!isApiSuccessResponse(result)) {
          ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || t('organizationMove.messages.failed'));
          return;
        }
        ElMessage.success(t('organizationMove.messages.success'));
        context.emit('response');
        context.emit('update:modelValue', false);
      } catch (err) {
        ElMessage.error((err instanceof Error ? err.message : String(err)) || t('organizationMove.messages.failed'));
      } finally {
        submitting.value = false;
      }
    }

    onMounted(load);

    return { props, t, loading, submitting, orgTree, newParentId, newSortNum, treeProps, handleClose, submit };
  },
});
</script>

<style scoped>
.org-move-dialog .org-move-full { width: 100%; }
.org-move-dialog :deep(.el-alert) { margin-top: 4px; }
</style>
