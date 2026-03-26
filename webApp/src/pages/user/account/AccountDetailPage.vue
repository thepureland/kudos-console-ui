<!-- 账号详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accountDetail.title"
    empty-key="accountDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, watch } from 'vue';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';
import { Pair } from '../../../components/model/Pair';
import { i18n, loadMessagesForConfig } from '../../../i18n';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, useDetailDialogVisibility, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';

/** 与 CacheDetail 一致：每行最多 2 个字段，每行一条 detail-row 底部分隔线 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accountDetail.sections.basicInfo' },
  { start: 3, titleKey: 'accountDetail.sections.lockInfo' },
  { start: 4, titleKey: 'accountDetail.sections.loginInfo' },
  { start: 7, titleKey: 'accountDetail.sections.registerInfo' },
  { start: 8, titleKey: 'accountDetail.sections.audit' },
  { start: 10, titleKey: 'accountDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accountDetail.fields.id', key: 'id' },
    { labelKey: 'accountDetail.fields.username', key: 'username' },
  ],
  [
    { labelKey: 'accountDetail.fields.userStatusDictCode', key: 'userStatusDictCode', type: 'dict', dictModule: 'user', dictCode: 'user_status' },
    { labelKey: 'accountDetail.fields.userStatusReason', key: 'userStatusReason' },
  ],
  [
    { labelKey: 'accountDetail.fields.userTypeDictCode', key: 'userTypeDictCode', type: 'dict', dictModule: 'user', dictCode: 'user_type' },
    { labelKey: 'accountDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'accountDetail.fields.lockTimeStart', key: 'lockTimeStart', type: 'date' },
    { labelKey: 'accountDetail.fields.lockTimeEnd', key: 'lockTimeEnd', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.lastLoginTime', key: 'lastLoginTime', type: 'date' },
    { labelKey: 'accountDetail.fields.lastLogoutTime', key: 'lastLogoutTime', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.lastLoginIp', key: 'lastLoginIp' },
    { labelKey: 'accountDetail.fields.lastLoginTerminalDictCode', key: 'lastLoginTerminalDictCode', type: 'dict', dictModule: 'user', dictCode: 'user_terminal' },
  ],
  [
    { labelKey: 'accountDetail.fields.totalOnlineTime', key: 'totalOnlineTime' },
    { labelKey: 'accountDetail.fields.dynamicAuthKey', key: 'dynamicAuthKey' },
  ],
  [
    { labelKey: 'accountDetail.fields.registerIp', key: 'registerIp' },
    { labelKey: 'accountDetail.fields.registerUrl', key: 'registerUrl' },
  ],
  [
    { labelKey: 'accountDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'accountDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'accountDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'accountDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'accountDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'accountDetail.fields.tenantName', key: 'tenantName' },
    { labelKey: 'accountDetail.fields.remark', key: 'remark' },
  ],
];

class AccountDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/account';
  }

  /** 用户状态、用户类型等字典项译文从后端取 */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['user_status', 'user_type', 'user_terminal'], atomicServiceCode: 'user' }];
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
    await this.loadDictsBatch([
      { dictTypes: ['sys'], atomicServiceCode: 'sys' },
      { dictTypes: ['user_status', 'user_type', 'user_terminal'], atomicServiceCode: 'user' },
    ]);
  }
}

export default defineComponent({
  name: 'AccountDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    const page = reactive(new AccountDetailPage(props, context)) as AccountDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accountDetail.empty',
      yesNoKey: 'accountList.common',
    });

    useDetailPageRidSync(props, page);

    watch(
      () => i18n.global.locale.value,
      () => {
        const config = (page as { getI18nConfig?: () => { i18nTypeDictCode: string; namespaces: string[]; atomicServiceCode: string }[] }).getI18nConfig?.();
        if (config?.length) loadMessagesForConfig(config);
      },
      { immediate: false }
    );

    const { visible, close } = useDetailDialogVisibility(props, context);

    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
