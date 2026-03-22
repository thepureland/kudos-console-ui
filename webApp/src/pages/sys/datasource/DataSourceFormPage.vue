<!-- 数据源新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog datasource-add-edit-dialog"
    align-center
    :append-to-body="false"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
  >
    <el-form
      ref="form"
      :model="formModel"
      :rules="rules"
      label-width="180px"
      label-position="right"
      :validate-on-rule-change="false"
      class="add-edit-dialog-form"
    >
      <section class="form-section">
        <div class="form-section__title">{{ t('dataSourceAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('dataSourceAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('dataSourceAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.tenant')" prop="subSysOrTenant" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-cascader
                v-model="formModel.subSysOrTenant"
                :options="subSysOrTenants"
                :props="cascaderProps"
                :placeholder="t('dataSourceAddEdit.placeholders.tenant')"
                clearable
                class="form-select-full"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.microservice')" prop="microServiceCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-tree-select
                v-model="formModel.microServiceCode"
                :data="microserviceTree"
                :placeholder="t('dataSourceAddEdit.placeholders.microservice')"
                clearable
                filterable
                :render-after-expand="false"
                default-expand-all
                class="form-select-full"
                style="width: 100%"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.url')" prop="url" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.url"
                :placeholder="t('dataSourceAddEdit.placeholders.url')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.username')" prop="username" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.username"
                :placeholder="t('dataSourceAddEdit.placeholders.username')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.password')" prop="password">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.password"
                type="password"
                :placeholder="t('dataSourceAddEdit.placeholders.password')"
                clearable
                show-password
                size="default"
              />
            </el-col>
          </el-row>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('dataSourceAddEdit.sections.connection') }}</div>
        <el-form-item :label="t('dataSourceAddEdit.labels.initialSize')" prop="initialSize">
          <el-input-number
            v-model="formModel.initialSize"
            :min="0"
            :max="9999"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.maxActive')" prop="maxActive">
          <el-input-number
            v-model="formModel.maxActive"
            :min="0"
            :max="99999"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.maxIdle')" prop="maxIdle">
          <el-input-number
            v-model="formModel.maxIdle"
            :min="0"
            :max="99999"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.minIdle')" prop="minIdle">
          <el-input-number
            v-model="formModel.minIdle"
            :min="0"
            :max="99999"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.maxWait')" prop="maxWait">
          <el-input-number
            v-model="formModel.maxWait"
            :min="0"
            :max="2147483647"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
        <el-form-item :label="t('dataSourceAddEdit.labels.maxAge')" prop="maxAge">
          <el-input-number
            v-model="formModel.maxAge"
            :min="0"
            :max="2147483647"
            controls-position="right"
            class="form-input-number-full"
          />
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('dataSourceAddEdit.sections.other') }}</div>
        <el-form-item :label="t('dataSourceAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('dataSourceAddEdit.placeholders.remark')"
            :maxlength="remarkMaxLength"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('dataSourceAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('dataSourceAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { TenantSupportAddEditPage } from '../../../components/pages/TenantSupportAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { backendRequest, getApiResponseData } from '../../../utils/backendRequest';
import '../../../styles/add-edit-dialog-common.css';

type MicroServiceTreeNode = { id: string; name: string; parentId?: string | null; orderNum?: number | null; children?: MicroServiceTreeNode[] };
type TreeSelectNode = { value: string; label: string; children?: TreeSelectNode[] };
function toTreeSelectNode(node: MicroServiceTreeNode): TreeSelectNode {
  const children = Array.isArray(node.children) && node.children.length > 0 ? node.children.map(toTreeSelectNode) : undefined;
  return { value: String(node.id), label: node.name ?? String(node.id), ...(children ? { children } : {}) };
}

interface FormModel {
  name: string | null;
  subSysOrTenant: string[] | null;
  microServiceCode: string | null;
  url: string | null;
  username: string | null;
  password: string | null;
  initialSize: number | undefined;
  maxActive: number | undefined;
  maxIdle: number | undefined;
  minIdle: number | undefined;
  maxWait: number | undefined;
  maxAge: number | undefined;
  remark: string | null;
}

/** 将 value 转为 number 或 undefined，供 el-input-number */
function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

class DataSourceFormPage extends TenantSupportAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  /** 第一级使用子系统接口，第二级租户；与列表页一致 */
  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  /** 仅允许选第二级（租户），与列表页一致 */
  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        name: null,
        subSysOrTenant: null,
        microServiceCode: null,
        url: null,
        username: null,
        password: null,
        initialSize: undefined,
        maxActive: undefined,
        maxIdle: undefined,
        minIdle: undefined,
        maxWait: undefined,
        maxAge: undefined,
        remark: null,
      } as FormModel,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/dataSource';
  }

  protected getLoadFailedMessageKey(): string {
    return 'dataSourceAddEdit.messages.loadFailed';
  }

  /** 提交时排除 subSysOrTenant（仅级联用），只提交 subSystemCode、tenantId 及后端所需字段 */
  protected createSubmitParams(): Record<string, unknown> {
    const params = super.createSubmitParams() as Record<string, unknown>;
    delete params.subSysOrTenant;
    return params;
  }

  /** 回填时保证数字字段为 number | undefined，并兼容 microservice 对象；password 由 base fillForm 从 rowObject 回填 */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const m = this.state.formModel as FormModel;
    if (m) {
      m.initialSize = toNumberOrUndefined(m.initialSize ?? rowObject.initialSize);
      m.maxActive = toNumberOrUndefined(m.maxActive ?? rowObject.maxActive);
      m.maxIdle = toNumberOrUndefined(m.maxIdle ?? rowObject.maxIdle);
      m.minIdle = toNumberOrUndefined(m.minIdle ?? rowObject.minIdle);
      m.maxWait = toNumberOrUndefined(m.maxWait ?? rowObject.maxWait);
      m.maxAge = toNumberOrUndefined(m.maxAge ?? rowObject.maxAge);
      const micro = rowObject.microservice ?? rowObject.microServiceCode ?? rowObject.microserviceCode;
      if (m.microServiceCode == null && micro != null) {
        m.microServiceCode = typeof micro === 'string' ? micro : (micro && typeof micro === 'object' && 'code' in micro ? (micro as { code: string }).code : null) ?? null;
      }
    }
  }
}

export default defineComponent({
  name: 'DataSourceFormPage',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
      type: String,
      default: '',
    },
    onSaved: {
      type: Function as (params: Record<string, unknown>) => void,
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const microserviceTree = ref<TreeSelectNode[]>([]);
    onMounted(() => {
      backendRequest({ url: 'sys/microService/getFullMicroServiceTree', method: 'get' })
        .then((result) => {
          const payload = getApiResponseData<MicroServiceTreeNode[]>(result);
          const raw = (Array.isArray(payload) ? payload : []) as MicroServiceTreeNode[];
          microserviceTree.value = raw.map(toTreeSelectNode);
        })
        .catch(() => { microserviceTree.value = []; });
    });
    const setupReturn = useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new DataSourceFormPage(p, c),
      i18nKeyPrefix: 'dataSourceAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.subSysOrTenant != null && Array.isArray(model.subSysOrTenant) && model.subSysOrTenant.length > 0) return true;
        if (model.microServiceCode != null && String(model.microServiceCode).trim() !== '') return true;
        if (model.url != null && String(model.url).trim() !== '') return true;
        if (model.username != null && String(model.username).trim() !== '') return true;
        if (model.password != null && String(model.password).trim() !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.initialSize != null && model.initialSize !== '') return true;
        if (model.maxActive != null && model.maxActive !== '') return true;
        if (model.maxIdle != null || model.minIdle != null || model.maxWait != null || model.maxAge != null) return true;
        return false;
      },
    });
    return { ...setupReturn, microserviceTree };
  },
});
</script>

<style scoped>
/* 仅数据源页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
