<!-- Account detail -->
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
import { backendRequest, getApiResponseData, isApiSuccessResponse } from '../../../utils/backendRequest';

/** Mirrors CacheDetail: up to 2 fields per row, one detail-row bottom divider per row */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accountDetail.sections.basicInfo' },
  { start: 3, titleKey: 'accountDetail.sections.lockInfo' },
  { start: 4, titleKey: 'accountDetail.sections.loginInfo' },
  { start: 7, titleKey: 'accountDetail.sections.registerInfo' },
  { start: 8, titleKey: 'accountDetail.sections.audit' },
  { start: 10, titleKey: 'accountDetail.sections.otherInfo' },
  { start: 12, titleKey: 'accountDetail.sections.permissions' },
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
  [
    { labelKey: 'accountDetail.fields.currentRoles', key: '_rolesText' },
  ],
  [
    { labelKey: 'accountDetail.fields.currentGroups', key: '_groupsText' },
  ],
];

class AccountDetailPage extends BaseDetailPage {
  protected getRootActionPath(): string {
    return 'user/account';
  }

  /** User-status, user-type, and similar dict-item translations are fetched from the backend */
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

  /** After the main detail loads, fan out to fetch the user's roles + groups and patch the detail object so the new sections render. */
  protected postLoadDataSuccessfully(data: unknown): void {
    super.postLoadDataSuccessfully(data);
    const userId = String(this.props.rid ?? this.state.rid ?? '');
    if (!userId) return;
    void this.loadRolesAndGroups(userId);
  }

  private async loadRolesAndGroups(userId: string): Promise<void> {
    const [roleNames, groupNames] = await Promise.all([
      this.fetchRoleNames(userId),
      this.fetchGroupNames(userId),
    ]);
    // Detail is reactive; assigning new keys triggers the new sections to render.
    if (this.state.detail && typeof this.state.detail === 'object') {
      (this.state.detail as Record<string, unknown>)._rolesText = roleNames.length ? roleNames.join(', ') : '—';
      (this.state.detail as Record<string, unknown>)._groupsText = groupNames.length ? groupNames.join(', ') : '—';
    }
  }

  private async fetchRoleNames(userId: string): Promise<string[]> {
    const idsResult = await backendRequest({ url: 'auth/role/listRoleIdsByUser', method: 'get', params: { userId } });
    if (!isApiSuccessResponse(idsResult)) return [];
    const idsPayload = getApiResponseData<unknown>(idsResult);
    const ids: string[] = Array.isArray(idsPayload)
      ? idsPayload.map(String)
      : (idsPayload && typeof idsPayload === 'object'
          ? Array.from(Object.values(idsPayload as Record<string, unknown>)).map(String)
          : []);
    if (ids.length === 0) return [];
    const rows = await this.resolveByIds('auth/role/pagingSearch', ids);
    return rows.map(r => String((r as Record<string, unknown>).roleName ?? (r as Record<string, unknown>).name ?? (r as Record<string, unknown>).roleCode ?? (r as Record<string, unknown>).id ?? ''));
  }

  private async fetchGroupNames(userId: string): Promise<string[]> {
    const idsResult = await backendRequest({ url: 'auth/group/listGroupIdsByUser', method: 'get', params: { userId } });
    if (!isApiSuccessResponse(idsResult)) return [];
    const idsPayload = getApiResponseData<unknown>(idsResult);
    const ids: string[] = Array.isArray(idsPayload)
      ? idsPayload.map(String)
      : (idsPayload && typeof idsPayload === 'object'
          ? Array.from(Object.values(idsPayload as Record<string, unknown>)).map(String)
          : []);
    if (ids.length === 0) return [];
    const rows = await this.resolveByIds('auth/group/pagingSearch', ids);
    return rows.map(r => String((r as Record<string, unknown>).groupName ?? (r as Record<string, unknown>).name ?? (r as Record<string, unknown>).groupCode ?? (r as Record<string, unknown>).id ?? ''));
  }

  private async resolveByIds(url: string, ids: string[]): Promise<unknown[]> {
    const params: Record<string, unknown> = { pageNo: 1, pageSize: Math.max(ids.length, 50), ids };
    const result = await backendRequest({ url, method: 'post', params });
    if (!isApiSuccessResponse(result)) return [];
    const payload = getApiResponseData<{ data?: unknown[] } | unknown[]>(result);
    const rows: unknown[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
    const idSet = new Set(ids.map(String));
    return rows.filter(r => idSet.has(String((r as Record<string, unknown>).id ?? '')));
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
