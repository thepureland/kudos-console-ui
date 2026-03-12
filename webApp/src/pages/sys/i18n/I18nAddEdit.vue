<!-- 国际化新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
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
        <el-form-item :label="t('i18nAddEdit.labels.locale')" prop="locale">
          <el-select v-model="formModel.locale" :placeholder="t('i18nAddEdit.placeholders.locale')" clearable filterable class="form-select-full">
            <el-option v-for="item in (localeOptions || [])" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.i18nTypeDictCode')" prop="i18nTypeDictCode">
          <el-select v-model="formModel.i18nTypeDictCode" :placeholder="t('i18nAddEdit.placeholders.i18nTypeDictCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in (i18nTypeDictOptions || [])" :key="item.first" :value="item.first" :label="t(item.second)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('i18nAddEdit.labels.atomicServiceCode')" prop="atomicServiceCode">
          <el-select v-model="formModel.atomicServiceCode" :placeholder="t('i18nAddEdit.placeholders.atomicServiceCode')" clearable filterable class="form-select-full">
            <el-option v-for="item in atomicServiceList" :key="item.code" :value="item.code" :label="item.name" />
          </el-select>
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
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import { Pair } from '../../../components/model/Pair';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  key: string | null;
  value: string | null;
  locale: string | null;
  i18nTypeDictCode: string | null;
  atomicServiceCode: string | null;
}

class I18nAddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
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
        locale: null,
        i18nTypeDictCode: null,
        atomicServiceCode: null,
      } as FormModel,
      localeOptions: [] as Array<{ first: string; second: string }>,
      i18nTypeDictOptions: [] as Array<{ first: string; second: string }>,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/i18n';
  }

  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'i18nAddEdit.messages.loadFailed';
  }
}

export default defineComponent({
  name: 'I18NAddEdit',
  props: {
    modelValue: { type: Boolean, default: false },
    rid: { type: String, default: '' },
    onSaved: { type: Function as (params: Record<string, unknown>) => void, default: undefined },
  },
  emits: ['update:modelValue', 'response'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new I18nAddEditPage(p, c),
      i18nKeyPrefix: 'i18nAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.key != null && String(model.key).trim() !== '') return true;
        if (model.value != null && String(model.value).trim() !== '') return true;
        if (model.locale != null && model.locale !== '') return true;
        if (model.i18nTypeDictCode != null && model.i18nTypeDictCode !== '') return true;
        if (model.atomicServiceCode != null && model.atomicServiceCode !== '') return true;
        return false;
      },
    });
  },
});
</script>

<style scoped></style>
