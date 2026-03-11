<!--
 * 资源添加/编辑
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog resource-add-edit-dialog"
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
        <div class="form-section__title">{{ t('resourceAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('resourceAddEdit.labels.parent')" prop="parent" class="is-required">
          <el-cascader
            v-model="formModel.parent"
            :options="parentCascaderOptions"
            :props="cascaderProps"
            class="form-select-full"
          />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.name')" prop="name" class="is-required">
          <el-input v-model="formModel.name" :placeholder="t('resourceAddEdit.placeholders.name')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.url')" prop="url">
          <el-input v-model="formModel.url" :placeholder="t('resourceAddEdit.placeholders.url')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.icon')" prop="icon">
          <el-input v-model="formModel.icon" :placeholder="t('resourceAddEdit.placeholders.icon')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('resourceAddEdit.labels.seqNo')" prop="seqNo">
          <el-input-number v-model="formModel.seqNo" :min="0" :max="99999" controls-position="right" class="form-input-number-full" />
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('resourceAddEdit.sections.other') }}</div>
        <el-form-item :label="t('resourceAddEdit.labels.remark')" prop="remark">
          <el-input v-model="formModel.remark" type="textarea" :rows="3" :placeholder="t('resourceAddEdit.placeholders.remark')" maxlength="200" show-word-limit resize="none" />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('resourceAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('resourceAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';

class ResourceAddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.buildParentCascaderOptions();
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        parent: [] as string[],
        name: null as string | null,
        url: null as string | null,
        icon: null as string | null,
        seqNo: undefined as number | undefined,
        remark: null as string | null,
      },
      /** 上级资源级联静态选项（前两级：资源类型 + 子系统），编辑回填可直接显示 */
      parentCascaderOptions: [] as Array<{ id: string; name: string; children?: Array<{ id: string; name: string }> }>,
      cascaderProps: {
        value: 'id',
        label: 'name',
        multiple: false,
        checkStrictly: true,
        expandTrigger: 'hover',
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/resource';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'resourceAddEdit.messages.loadFailed';
  }

  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    const parent = (this.state.formModel as { parent?: string[] }).parent ?? [];
    const length = parent.length;
    params.parentId = length <= 2 ? null : parent[length - 1];
    params.resourceTypeDictCode = parent[0] ?? null;
    params.subSystemCode = parent[1] ?? null;
    return params;
  }

  protected createRowObjectLoadParams(): any {
    const params = super.createRowObjectLoadParams()
    params["fetchAllParentIds"] = true
    return params
  }

  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    let parent: string[] = Array.isArray(rowObject.parentIds)
      ? (rowObject.parentIds as string[]).slice()
      : [];
    if (parent.length === 0) {
      const rt = rowObject.resourceTypeDictCode as string | undefined;
      const sub = rowObject.subSystemCode as string | undefined;
      const pid = rowObject.parentId as string | undefined;
      if (rt && sub) parent = pid ? [rt, sub, pid] : [rt, sub];
    }
    const formModel = this.state.formModel as { parent?: string[] };
    formModel.parent = parent.length > 0 ? parent.slice() : [];
    if (parent.length > 0) {
      nextTick(() => {
        formModel.parent = parent.slice();
      });
    }
  }

  /** 编辑加载：先拉取级联前两级构建静态 options，再拉详情并 fillForm，使 Parent 能回填显示 */
  protected async loadRowObject(): Promise<void> {
    await this.buildParentCascaderOptions();
    const params = this.createRowObjectLoadParams();
    const result = await backendRequest({ url: this.getRowObjectLoadUrl(), params });
    const rowData = result != null && typeof result === 'object' && !Array.isArray(result) && 'id' in result ? result : null;
    if (rowData != null) {
      this.fillForm(rowData);
      super.render();
      this.onEditFormLoaded?.();
    } else {
      const i18n = (await import('../../../i18n')).i18n;
      ElMessage.error(i18n.global.t(this.getLoadFailedMessageKey()) as string);
    }
  }

  /** 构建上级级联静态选项（资源类型 + 子系统），新增时也会在首次打开时加载 */
  private async buildParentCascaderOptions(): Promise<void> {
    const opts = this.state.parentCascaderOptions as Array<{ id: string; name: string; children?: Array<{ id: string; name: string }> }>;
    if (opts.length > 0) return;
    const res0 = await backendRequest({ url: 'sys/resource/getSimpleMenus', method: 'get', params: { level: 0, parentId: null, active: true } });
    const res1 = await backendRequest({ url: 'sys/resource/getSimpleMenus', method: 'get', params: { level: 1, parentId: null, active: true } });
    const level0 = Array.isArray(res0) ? res0 : (res0 != null && typeof res0 === 'object' && Array.isArray((res0 as { data?: unknown }).data) ? (res0 as { data: Array<{ id: string; name: string }> }).data : []);
    const level1 = Array.isArray(res1) ? res1 : (res1 != null && typeof res1 === 'object' && Array.isArray((res1 as { data?: unknown }).data) ? (res1 as { data: Array<{ id: string; name: string }> }).data : []);
    const options = level0.map((item) => ({
      id: item.id,
      name: item.name,
      children: level1.map((c) => ({ id: c.id, name: c.name })),
    }));
    (this.state as Record<string, unknown>).parentCascaderOptions = options;
  }

}

export default defineComponent({
  name: 'ResourceAddEdit',
  props: {
    modelValue: { type: Boolean, default: false },
    rid: { type: String, default: '' },
    onSaved: { type: Function as (params: Record<string, unknown>) => void, default: undefined },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new ResourceAddEditPage(p, c),
      i18nKeyPrefix: 'resourceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        const parent = model.parent as unknown[] | undefined;
        if (parent != null && parent.length > 0) return true;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.url != null && String(model.url).trim() !== '') return true;
        if (model.icon != null && String(model.icon).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.seqNo != null && model.seqNo !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped></style>