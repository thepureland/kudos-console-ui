<!-- 缓存新增/编辑 -->
<template>
  <el-dialog
    :model-value="props.modelValue"
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
      @focus.capture="onFormInteraction?.()"
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
              <el-tooltip v-if="isEdit" :content="t('cacheAddEdit.tips.readonly')" placement="top" :enterable="false">
                <div>
                  <el-input
                    v-model="formModel.name"
                    :placeholder="t('cacheAddEdit.placeholders.name')"
                    :disabled="true"
                    clearable
                    size="default"
                  />
                </div>
              </el-tooltip>
              <el-input
                v-else
                v-model="formModel.name"
                :placeholder="t('cacheAddEdit.placeholders.name')"
                clearable
                size="default"
              />
            </el-col>
          </el-row>
          <div v-if="!isEdit" class="form-tip-below" style="margin-top: 1px;">
            <span class="form-tip form-tip--warn">
              <el-icon><WarningFilled /></el-icon>
              {{ t('cacheAddEdit.tips.immutableAfterSave') }}
            </span>
          </div>
        </el-form-item>
        <el-form-item :label="t('cacheAddEdit.labels.atomicService')" prop="atomicServiceCode" class="is-required">
          <el-row :gutter="12" class="form-item-row">
            <el-col :span="24">
              <el-tooltip v-if="isEdit" :content="t('cacheAddEdit.tips.readonly')" placement="top" :enterable="false">
                <div>
                  <el-select
                    v-model="formModel.atomicServiceCode"
                    :placeholder="t('cacheAddEdit.placeholders.atomicService')"
                    :disabled="true"
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
                </div>
              </el-tooltip>
              <el-select
                v-else
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
          <div v-if="!isEdit" class="form-tip-below" style="margin-top: 1px;">
            <span class="form-tip form-tip--warn">
              <el-icon><WarningFilled /></el-icon>
              {{ t('cacheAddEdit.tips.immutableAfterSave') }}
            </span>
          </div>
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
              :active-text="t('cacheAddEdit.switch.yes')"
              :inactive-text="t('cacheAddEdit.switch.no')"
            />
          </el-form-item>
          <el-form-item :label="t('cacheAddEdit.labels.writeInTime')" prop="writeInTime" class="form-item--inline">
            <el-switch
              v-model="formModel.writeInTime"
              :active-value="true"
              :inactive-value="false"
              inline-prompt
              :active-text="t('cacheAddEdit.switch.yes')"
              :inactive-text="t('cacheAddEdit.switch.no')"
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
          <el-tooltip v-if="isEdit" :content="t('cacheAddEdit.tips.readonly')" placement="top" :enterable="false">
            <div>
              <el-switch
                v-model="formModel.hash"
                :disabled="true"
                :active-value="true"
                :inactive-value="false"
                inline-prompt
                :active-text="t('cacheAddEdit.switch.yes')"
                :inactive-text="t('cacheAddEdit.switch.no')"
              />
            </div>
          </el-tooltip>
          <el-switch
            v-else
            v-model="formModel.hash"
            :active-value="true"
            :inactive-value="false"
            inline-prompt
            :active-text="t('cacheAddEdit.switch.yes')"
            :inactive-text="t('cacheAddEdit.switch.no')"
          />
          <span v-if="!isEdit" class="form-tip form-tip--warn hash-immutable-tip">
            <el-icon><WarningFilled /></el-icon>
            {{ t('cacheAddEdit.tips.immutableAfterSave') }}
          </span>
        </el-form-item>
        <el-form-item :label="t('cacheAddEdit.labels.remark')" prop="remark">
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
        <el-button @click="handleCloseRequest">{{ t('cacheAddEdit.buttons.cancel') }}</el-button>
        <el-button type="primary" @click.prevent="handleSubmit">{{ t('cacheAddEdit.buttons.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { WarningFilled } from '@element-plus/icons-vue';
import { Pair } from '../../../components/model/Pair';
import '../../../styles/add-edit-dialog-common.css';
import { BaseAddEditPage } from '../../../components/pages/core';
import type { PageContext, PageProps, SysMicroServiceCacheItem } from '../../../components/pages/core';
import { useAddEditDialogSetupWithVisible, commonAddEditDialogEmits, commonAddEditDialogProps, hasAnyFormContent } from '../../../components/pages/form';
import type { AddEditDialogContext, AddEditDialogProps } from '../../../components/pages/form';

/** 新增表单 TTL 默认值（秒），与关闭守卫「是否改动」判断一致 */
const DEFAULT_CACHE_TTL = 999999999;

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

class CacheFormPage extends BaseAddEditPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    const list = (props as { atomicServiceList?: SysMicroServiceCacheItem[] }).atomicServiceList;
    if (Array.isArray(list) && list.length > 0) {
      this.atomicServiceList = list;
      this.state.atomicServiceList = list;
    } else {
      this.loadAtomicServices();
    }
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
        hash: true,
        writeOnBoot: true,
        writeInTime: true,
        ttl: DEFAULT_CACHE_TTL,
        managementBeanName: null,
        remark: null,
      } as FormModel,
      strategyOptions: [] as StrategyOption[],
    };
  }

  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  /**
   * 校验提示仅使用 valid-msg（default + 模块名 cache），不依赖后端 view 类型下的 sys.cache 命名空间。
   * 不重写时会多一次 batchGetI18ns({ view: ['sys.cache'] })，与当前页无关。
   */
  protected getValidationI18nNamespace(): string | undefined {
    return undefined;
  }

  /** 缓存策略字典项译文从后端取 */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['cache_strategy'], atomicServiceCode: 'sys' }];
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
  name: 'CacheFormPage',
  components: { WarningFilled },
  props: {
    ...commonAddEditDialogProps,
    /** 原子服务下拉列表，由列表页传入时与搜索栏共用数据，不单独加载 */
    atomicServiceList: {
      type: Array as () => { code: string; name: string }[],
      default: () => [],
    },
  },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new CacheFormPage(p, c),
      i18nKeyPrefix: 'cacheAddEdit',
      formHasContent(model: Record<string, unknown>) {
        return hasAnyFormContent(model, {
          stringKeys: ['name', 'remark'],
          valueKeys: ['atomicServiceCode', 'strategyDictCode'],
          // 三者默认 true；TTL 默认 DEFAULT_CACHE_TTL，仅偏离时视为有改动
          customChecks: [
            (m) => m.writeOnBoot === false,
            (m) => m.writeInTime === false,
            (m) => m.hash === false,
            (m) => {
              const t = m.ttl;
              if (t === null || t === undefined) return true;
              const n = Number(t);
              return Number.isNaN(n) ? true : n !== DEFAULT_CACHE_TTL;
            },
          ],
        });
      },
    });
  },
});
</script>

<style scoped>
/* 仅缓存页特有覆盖时可在此添加，共用样式见 add-edit-dialog-common.css */
.hash-immutable-tip {
  margin-left: 10px;
}
</style>
