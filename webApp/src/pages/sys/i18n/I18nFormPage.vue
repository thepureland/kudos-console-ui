<!-- 国际化新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog i18n-add-edit-dialog"
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
        <div class="form-section__title">{{ t('i18nAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('i18nAddEdit.labels.key')" prop="key" class="is-required">
          <el-input v-model="formModel.key" :placeholder="t('i18nAddEdit.placeholders.key')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.value')" prop="value" class="is-required">
          <el-input v-model="formModel.value" :placeholder="t('i18nAddEdit.placeholders.value')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.namespace')" prop="namespace" class="is-required">
          <el-input v-model="formModel.namespace" :placeholder="t('i18nAddEdit.placeholders.namespace')" clearable size="default" />
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.locale')" prop="locale" class="is-required">
          <el-select v-model="formModel.locale" :placeholder="t('i18nAddEdit.placeholders.locale')" clearable filterable class="form-select-full">
            <el-option v-for="item in (localeOptions || [])" :key="item.first" :value="item.first" :label="item.first" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.i18nTypeDictCode')" prop="i18nTypeDictCode" class="is-required">
          <el-select v-model="formModel.i18nTypeDictCode" :placeholder="t('i18nAddEdit.placeholders.i18nTypeDictCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in (i18nTypeDictOptions || [])" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.atomicServiceCode')" prop="atomicServiceCode" class="is-required">
          <el-select v-model="formModel.atomicServiceCode" :placeholder="t('i18nAddEdit.placeholders.atomicServiceCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in atomicServiceList" :key="item.code" :value="item.code" :label="item.name" />
          </el-select>
        </el-form-item>
      </section>
      <section class="form-section">
        <div class="form-section__title">{{ t('i18nAddEdit.sections.other') }}</div>
        <el-form-item :label="t('i18nAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('i18nAddEdit.placeholders.remark')"
            :maxlength="remarkMaxLength"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('i18nAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('i18nAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Pair } from '../../../components/model/Pair';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

interface FormModel {
  key: string | null;
  value: string | null;
  namespace: string | null;
  locale: string | null;
  i18nTypeDictCode: string | null;
  atomicServiceCode: string | null;
  remark: string | null;
}

class I18nFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadAtomicServices();
    this.loadDicts(['locale', 'i18n_type'], 'sys').then(() => {
      this.state.localeOptions = this.getDictItems('sys', 'locale');
      this.state.i18nTypeDictOptions = this.getDictItems('sys', 'i18n_type');
    });
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        key: null,
        value: null,
        namespace: null,
        locale: null,
        i18nTypeDictCode: null,
        atomicServiceCode: null,
        remark: null,
      } as FormModel,
      localeOptions: [] as Array<{ first: string; second: string }>,
      i18nTypeDictOptions: [] as Array<{ first: string; second: string }>,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/i18n';
  }

  /** 加载「国际化类型」「语言」字典项译文，供表单下拉 t(item.second) 显示，全部从后端取 */
  protected getI18nConfig() {
    return [
      { i18nTypeDictCode: 'dict-item', namespaces: ['i18n_type', 'locale'], atomicServiceCode: 'sys' },
    ];
  }

  protected getLoadFailedMessageKey(): string {
    return 'i18nAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'I18nFormPage',
  props: {
    ...commonAddEditDialogProps,
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new I18nFormPage(p, c),
      i18nKeyPrefix: 'i18nAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['key', 'value', 'namespace', 'remark'],
          valueKeys: ['locale', 'i18nTypeDictCode', 'atomicServiceCode'],
        });
      },
    });
  },
});
</script>

