<!-- 缓存新增/编辑 -->
<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="520px"
    center
    class="add-edit-dialog cache-add-edit-dialog"
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
        <div class="form-section__title">{{ t('cacheAddEdit.sections.basicInfo') }}</div>
        <el-form-item :label="t('cacheAddEdit.labels.name')" prop="name" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input
                v-model="formModel.name"
                :placeholder="t('cacheAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
          <div v-if="isEdit" class="form-tip-below">
            <span class="form-tip form-tip--warn">
              <el-icon><WarningFilled /></el-icon>
              {{ t('cacheAddEdit.tips.restartRequired') }}
            </span>
          </div>
        </el-form-item>
        <el-form-item :label="t('cacheAddEdit.labels.atomicService')" prop="atomicServiceCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.atomicServiceCode"
                :placeholder="t('cacheAddEdit.placeholders.atomicService')"
                clearable
                filterable
                class="form-select-full"
              >
                <el-option
                  v-for="item in atomicServiceList"
                  :key="item.code"
                  :value="item.code"
                  :label="item.name"
                />
              </el-select>
            </el-col>
          </el-row>
        </el-form-item>
        <el-form-item :label="t('cacheAddEdit.labels.strategy')" prop="strategyDictCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-select
                v-model="formModel.strategyDictCode"
                :placeholder="t('cacheAddEdit.placeholders.strategy')"
                clearable
                class="form-select-full"
              >
                <el-option
                  v-for="item in strategyOptions"
                  :key="item.first"
                  :value="item.first"
                  :label="t('cache_strategy.' + item.first) || item.second"
                />
              </el-select>
            </el-col>
          </el-row>
          <div v-if="isEdit" class="form-tip-below">
            <span class="form-tip form-tip--warn">
              <el-icon><WarningFilled /></el-icon>
              {{ t('cacheAddEdit.tips.restartRequired') }}
            </span>
          </div>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('cacheAddEdit.sections.writeAndTtl') }}</div>
        <div class="switch-row">
          <el-form-item :label="t('cacheAddEdit.labels.writeOnBoot')" prop="writeOnBoot" class="form-item--inline">
            <el-switch
              v-model="formModel.writeOnBoot"
              :active-value="true"
              :inactive-value="false"
              inline-prompt
              :active-text="t('cacheAddEdit.switch.on')"
              :inactive-text="t('cacheAddEdit.switch.off')"
            />
          </el-form-item>
          <el-form-item :label="t('cacheAddEdit.labels.writeInTime')" prop="writeInTime" class="form-item--inline">
            <el-switch
              v-model="formModel.writeInTime"
              :active-value="true"
              :inactive-value="false"
              inline-prompt
              :active-text="t('cacheAddEdit.switch.on')"
              :inactive-text="t('cacheAddEdit.switch.off')"
            />
          </el-form-item>
        </div>
        <el-form-item :label="t('cacheAddEdit.labels.ttl')" prop="ttl">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-input-number
                v-model="formModel.ttl"
                :min="0"
                :max="2147483647"
                :placeholder="t('cacheAddEdit.placeholders.ttl')"
                controls-position="right"
                class="form-input-number-full"
              />
            </el-col>
          </el-row>
          <div v-if="isEdit" class="form-tip-below">
            <span class="form-tip form-tip--warn">
              <el-icon><WarningFilled /></el-icon>
              {{ t('cacheAddEdit.tips.restartAndReload') }}
            </span>
          </div>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="form-section__title">{{ t('cacheAddEdit.sections.other') }}</div>
        <el-form-item :label="t('cacheAddEdit.labels.hash')" prop="hash" class="form-item--inline">
          <el-switch
            v-model="formModel.hash"
            :active-value="true"
            :inactive-value="false"
            inline-prompt
            :active-text="t('cacheAddEdit.switch.on')"
            :inactive-text="t('cacheAddEdit.switch.off')"
          />
        </el-form-item>
        <el-form-item :label="t('cacheAddEdit.labels.remark')" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('cacheAddEdit.placeholders.remark')"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </section>
    </el-form>
    <template #footer>
      <div class="add-edit-dialog-footer">
        <el-button @click="handleCloseRequest">{{ t('cacheAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('cacheAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { WarningFilled } from '@element-plus/icons-vue';
import { BaseAddEditPage } from '../../../components/pages/BaseAddEditPage';
import { Pair } from '../../../components/model/Pair';
import { useAddEditDialogSetup } from '../../../components/pages/useAddEditDialogSetup';
import '../../../styles/add-edit-dialog-common.css';

interface FormModel {
  name: string | null;
  atomicServiceCode: string | null;
  strategyDictCode: string | null;
  hash: boolean;
  writeOnBoot: boolean;
  writeInTime: boolean;
  ttl: number | null;
  managementBeanName: string | null;
  remark: string | null;
}

/** 缓存策略选项：first=code, second=label */
type StrategyOption = { first: string; second: string };

class CacheAddEditPage extends BaseAddEditPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadAtomicServices();
    this.loadDicts(['cache_strategy'], 'sys').then(() => {
      this.state.strategyOptions = this.getDictItems('sys', 'cache_strategy').map(
        (p) => ({ first: p.first, second: p.second })
      ) as StrategyOption[];
    });
  }

  protected initState(): Record<string, unknown> {
    return {
      formModel: {
        name: null,
        atomicServiceCode: null,
        strategyDictCode: null,
        hash: false,
        writeOnBoot: false,
        writeInTime: false,
        ttl: null,
        managementBeanName: null,
        remark: null,
      } as FormModel,
      strategyOptions: [] as StrategyOption[],
    };
  }

  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  /** 与详情页一致：使用 getDetail 接口按 id 拉取单条，Mock/后端均只处理此路径 */
  protected getRowObjectLoadUrl(): string {
    return this.getRootActionPath() + '/getDetail';
  }

  protected getLoadFailedMessageKey(): string {
    return 'cacheAddEdit.messages.loadFailed';
  }

  /** 回填时保证 ttl 为 number | null，兼容 el-input-number */
  protected fillForm(rowObject: Record<string, unknown>): void {
    super.fillForm(rowObject);
    const ttl = this.state.formModel?.ttl;
    if (ttl !== undefined && ttl !== null && typeof ttl !== 'number') {
      const n = Number(ttl);
      this.state.formModel.ttl = Number.isNaN(n) ? null : n;
    }
  }
}

export default defineComponent({
  name: 'CacheAddEdit',
  components: { WarningFilled },
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
    return useAddEditDialogSetup(props, context, {
      createPage: (p, c) => new CacheAddEditPage(p, c),
      i18nKeyPrefix: 'cacheAddEdit',
      formHasContent(model: Record<string, unknown>) {
        if (!model) return false;
        if (model.name != null && String(model.name).trim() !== '') return true;
        if (model.atomicServiceCode != null && model.atomicServiceCode !== '') return true;
        if (model.strategyDictCode != null && model.strategyDictCode !== '') return true;
        if (model.remark != null && String(model.remark).trim() !== '') return true;
        if (model.ttl != null && model.ttl !== '') return true;
        if (model.writeOnBoot === true || model.writeInTime === true) return true;
        return false;
      },
    });
  },
});
</script>

<style scoped>
/* 仅缓存页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
</style>
