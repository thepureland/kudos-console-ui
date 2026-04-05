<!--
 * 访问规则 + IP 规则统一列表：主从同一页查询、展示、新增/编辑/删除（视图 v_sys_access_rule_with_ip + pagingSearchAccessRuleWithIp）。
 *
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="access-rule-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('accessRuleList.actions.showColumnPanel')"
      :column-panel-hide-text="t('accessRuleList.actions.hideColumnPanel')"
      :operation-column-show-text="t('accessRuleList.actions.showOperationColumn')"
      :operation-column-hide-text="t('accessRuleList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-system">
          <el-select
            v-model="searchParams.systemCode"
            :placeholder="t('accessRuleList.placeholders.systemCode')"
            clearable
            filterable
            class="search-name-input"
            @change="search"
          >
            <el-option
              v-for="item in getAtomicServices()"
              :key="item.code"
              :value="item.code"
              :label="item.name"
            />
          </el-select>
        </div>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants"
            :props="cascaderProps"
            :placeholder="t('dataSourceList.placeholders.subSysOrTenant')"
            clearable
            class="subsys-tenant-cascader"
            @change="search"
          />
        </div>
        <div class="toolbar-cell toolbar-rule-type">
          <el-select
            v-model="searchParams.accessRuleTypeDictCode"
            :placeholder="t('accessRuleList.placeholders.ruleType')"
            clearable
            filterable
            class="search-select-input"
            @change="search"
          >
            <el-option
              v-for="item in ruleTypeOptions"
              :key="item.first"
              :value="item.first"
              :label="getAccessRuleTypeLabel(item.first)"
            />
          </el-select>
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.parentActive" class="active-only-checkbox" @change="search">
            {{ t('accessRuleList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('accessRuleList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('accessRuleList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('accessRuleList.actions.addRule') }}
        </el-button>
        <el-button type="success" plain @click="openAddIpDialog">
          <el-icon><Plus /></el-icon>
          {{ t('accessRuleList.actions.addIp') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('accessRuleList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('accessRuleList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox
            v-for="item in columnVisibilityOptions"
            :key="item.key"
            :value="item.key"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table
          ref="tableRef"
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('accessRuleList.columns.systemCode')"
            prop="systemCode"
            min-width="100"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ transAtomicService(scope.row.systemCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('tenantId')"
            :label="t('accessRuleList.columns.tenantId')"
            prop="tenantId"
            min-width="100"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('accessRuleTypeDictCode')"
            :label="t('accessRuleList.columns.ruleType')"
            prop="accessRuleTypeDictCode"
            min-width="100"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ getAccessRuleTypeLabel(scope.row.accessRuleTypeDictCode) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('parentActive')"
            :label="t('accessRuleList.columns.parentActive')"
            prop="parentActive"
            min-width="96"
          >
            <template #default="scope">
              <el-tag :type="scope.row.parentActive ? 'success' : 'info'" size="small">
                {{ scope.row.parentActive ? t('accessRuleList.common.yes') : t('accessRuleList.common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('ipStart')"
            :label="t('accessRuleList.columns.ipStart')"
            prop="ipStart"
            min-width="100"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('ipEnd')"
            :label="t('accessRuleList.columns.ipEnd')"
            prop="ipEnd"
            min-width="100"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('ipTypeDictCode')"
            :label="t('accessRuleList.columns.ipTypeDictCode')"
            prop="ipTypeDictCode"
            min-width="100"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('expirationTime')"
            :label="t('accessRuleList.columns.expirationTime')"
            prop="expirationTime"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ formatDateCell(scope.row.expirationTime) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('ipActive')"
            :label="t('accessRuleList.columns.ipActive')"
            prop="active"
            min-width="80"
          >
            <template #default="scope">
              <el-tag v-if="scope.row.ipId" :type="scope.row.active ? 'success' : 'info'" size="small">
                {{ scope.row.active ? t('accessRuleList.common.yes') : t('accessRuleList.common.no') }}
              </el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('remark')"
            :label="t('accessRuleList.columns.remark')"
            prop="remark"
            min-width="140"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ formatRemarkCell(scope.row) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('accessRuleList.columns.operation')"
            align="center"
            fixed="right"
            min-width="100"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('accessRuleList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('accessRuleList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('accessRuleList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('accessRuleList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                    <Tickets />
                  </el-icon>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #pagination>
        <el-pagination
          :ref="(el: unknown) => { listLayoutRefs.paginationRef.value = (el as { $el?: HTMLElement } | HTMLElement | null) ?? null; }"
          class="pagination-right"
          :current-page="pagination.pageNo"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </template>
    </list-page-layout>

    <div v-if="hasFormEverOpened" v-show="formVisible">
      <access-rule-form-page
        :model-value="formVisible"
        :rid="formRid"
        :list-sub-sys-or-tenants="subSysOrTenants"
        :list-cascader-props="cascaderProps"
        :list-atomic-service-list="atomicServiceList"
        :list-search-snapshot="listSearchSnapshotForForm"
        :on-saved="handleFormSaved"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <div v-if="hasIpFormEverOpened" v-show="ipFormVisible">
      <access-rule-ip-form-page
        :model-value="ipFormVisible"
        :rid="ipFormRid"
        :default-parent-rule-id="ipFormDefaultParentRuleId"
        :list-sub-sys-or-tenants="subSysOrTenants"
        :list-cascader-props="cascaderProps"
        :list-atomic-service-list="atomicServiceList"
        :on-saved="onIpFormSaved"
        @update:modelValue="onIpFormClose"
      />
    </div>
    <access-rule-with-ip-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AccessRuleFormPage from './AccessRuleFormPage.vue';
import AccessRuleIpFormPage from '../accessruleip/AccessRuleIpFormPage.vue';
import AccessRuleWithIpDetailPage from '../accessrulewithip/AccessRuleWithIpDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageFormSetup, useListPageVisibilityState } from '../../../components/pages/list';
import { TenantSupportListPage } from '../../../components/pages/support';
import { ListPageLayout } from '../../../components/pages/ui';
import { i18n } from '../../../i18n';
import {
  backendRequest,
  getApiFailureMessage,
  getApiResponseMessage,
  isApiSuccessResponse,
  resolveApiFailureMessage,
} from '../../../utils/backendRequest';

/**
 * 主从合一列表：查询 v_sys_access_rule_with_ip；有 ipId 行为 IP 子行，无 ipId 为仅主规则占位行。
 */
class AccessRuleListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['access_rule_type'], 'sys').then(() => {
      (this.state as Record<string, unknown>).ruleTypeOptions = this.getDictItems('sys', 'access_rule_type');
    });
    this.convertThis();
    this.loadAtomicServices();
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['access_rule_type'], atomicServiceCode: 'sys' }];
  }

  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  protected initState(): Record<string, unknown> {
    return {
      ruleTypeOptions: [] as Array<{ first: string; second: string }>,
      ipFormVisible: false,
      ipFormRid: '',
      ipFormDefaultParentRuleId: '',
      searchParams: {
        systemCode: null as string | null,
        accessRuleTypeDictCode: null as string | null,
        parentActive: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/accessRuleIp';
  }

  protected getSearchUrl(): string {
    return 'sys/accessRuleIp/pagingSearchAccessRuleWithIp';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const pair = this.parseSubSysOrTenant();
    if (pair == null) {
      return null;
    }
    const base = BaseListPage.prototype.createSearchParams.call(this) as Record<string, unknown> | null;
    if (!base) {
      return null;
    }
    const sp = this.state.searchParams as Record<string, unknown>;
    const fromSelect = sp.systemCode != null && String(sp.systemCode).trim() !== '' ? String(sp.systemCode) : null;
    base.systemCode = fromSelect ?? pair.first;
    base.tenantId = pair.second;
    base.accessRuleTypeDictCode = sp.accessRuleTypeDictCode ?? null;
    base.parentActive = sp.parentActive === true ? true : null;
    delete (base as Record<string, unknown>).subSysOrTenant;
    delete (base as Record<string, unknown>).subSystemCode;
    delete (base as Record<string, unknown>).active;
    return base;
  }

  protected doAfterAdd(params: Record<string, unknown>): void {
    const subSystemCode = (params.subSystemCode ?? params.systemCode) as string | null | undefined;
    const tenantId = params.tenantId as string | null | undefined;
    super.doAfterAdd({ ...params, subSystemCode, tenantId });
  }

  protected getAfterAddSearchParamKeys(): string[] {
    return ['systemCode', 'accessRuleTypeDictCode'];
  }

  public openAddIpDialog(): void {
    const s = this.state as Record<string, unknown>;
    s.ipFormRid = '';
    s.ipFormDefaultParentRuleId = '';
    s.ipFormVisible = true;
  }

  protected convertThis(): void {
    super.convertThis();
    const self = this as AccessRuleListPage;
    self.handleEdit = (row: Record<string, unknown>) => self.doHandleEditUnified(row);
    self.handleDelete = (row: Record<string, unknown>) => {
      void self.doHandleDeleteUnified(row);
    };
    self.multiDelete = () => {
      void self.doMultiDeleteUnified();
    };
  }

  /** 有 IP 子行则编辑 IP 表单；否则编辑主规则 */
  protected doHandleEditUnified(row: Record<string, unknown>): void {
    const s = this.state as Record<string, unknown>;
    if (row.ipId) {
      s.ipFormRid = String(row.ipId);
      s.ipFormDefaultParentRuleId = '';
      s.ipFormVisible = true;
    } else {
      s.rid = String(row.parentId ?? row.id);
      s.editDialogVisible = true;
    }
  }

  protected getDeleteMessage(row: Record<string, unknown>): string {
    const t = i18n.global.t.bind(i18n.global);
    return row.ipId
      ? (t('accessRuleList.messages.deleteIpConfirm') as string)
      : (t('accessRuleList.messages.deleteRuleConfirm') as string);
  }

  protected async doHandleDeleteUnified(row: Record<string, unknown>): Promise<void> {
    const t = i18n.global.t.bind(i18n.global);
    const confirmResult = await ElMessageBox.confirm(this.getDeleteMessage(row), t('listPage.confirmTitle') as string, {
      confirmButtonText: t('listPage.confirmButton') as string,
      cancelButtonText: t('listPage.cancelButton') as string,
      type: 'warning',
    }).catch(() => 'cancel');
    if (confirmResult !== 'confirm') return;
    try {
      await this.deleteOneRowApi(row);
      ElMessage.success(t('listPage.deleteSuccess') as string);
      this.doAfterDelete([this.getRowId(row)]);
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : (t('listPage.deleteFailed') as string));
    }
  }

  protected getBatchDeleteMessage(rows: Array<unknown>): string {
    return i18n.global.t('accessRuleList.messages.batchDeleteMixed', { n: rows.length }) as string;
  }

  protected async doMultiDeleteUnified(): Promise<void> {
    const t = i18n.global.t.bind(i18n.global);
    const rows = (this.state.selectedItems as Record<string, unknown>[]) ?? [];
    if (!rows.length) {
      ElMessage.info(t('listPage.selectDataFirst') as string);
      return;
    }
    const confirmResult = await ElMessageBox.confirm(this.getBatchDeleteMessage(rows), t('listPage.confirmTitle') as string, {
      confirmButtonText: t('listPage.confirmButton') as string,
      cancelButtonText: t('listPage.cancelButton') as string,
      type: 'warning',
    }).catch(() => 'cancel');
    if (confirmResult !== 'confirm') return;
    for (const row of rows) {
      try {
        await this.deleteOneRowApi(row);
      } catch (e) {
        ElMessage.error(e instanceof Error ? e.message : (t('listPage.deleteFailed') as string));
        return;
      }
    }
    ElMessage.success(t('listPage.deleteSuccess') as string);
    this.doAfterDelete(rows.map((r) => this.getRowId(r)));
  }

  private async deleteOneRowApi(row: Record<string, unknown>): Promise<void> {
    const ipId = row.ipId;
    const url = ipId ? 'sys/accessRuleIp/delete' : 'sys/accessRule/delete';
    const id = ipId ? String(ipId) : String(row.parentId ?? row.id);
    const result = await backendRequest({ url, method: 'delete', params: { id } });
    if (!isApiSuccessResponse(result)) {
      const msg =
        (await resolveApiFailureMessage(result)) ||
        getApiFailureMessage(result) ||
        getApiResponseMessage(result) ||
        'delete failed';
      throw new Error(msg);
    }
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'accessRuleList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'accessRuleList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig([
  'tenantId',
  'accessRuleTypeDictCode',
  'parentActive',
  'ipStart',
  'ipEnd',
  'ipTypeDictCode',
  'expirationTime',
  'ipActive',
  'remark',
]);

export default defineComponent({
  name: 'AccessRuleListPage',
  components: {
    AccessRuleFormPage,
    AccessRuleIpFormPage,
    AccessRuleWithIpDetailPage,
    ListPageLayout,
    Edit,
    Delete,
    Tickets,
    Search,
    RefreshLeft,
    Plus,
  },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new AccessRuleListPage(props, context)) as AccessRuleListPage & { state: Record<string, unknown> };
    const state = listPage.state as Record<string, unknown>;
    const {
      formVisible,
      formRid,
      hasFormEverOpened,
      currentFormMode,
      onFormClose,
      onFormResponse,
    } = useListPageFormSetup({ state, listPage, addHandlerName: 'doAfterAdd', editHandlerName: 'doAfterEdit' });
    function handleFormSaved(params: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.doAfterAdd : listPage.doAfterEdit).call(listPage, params);
    }

    const hasIpFormEverOpened = ref(false);
    watch(
      () => state.ipFormVisible,
      (v) => {
        if (v) hasIpFormEverOpened.value = true;
      }
    );
    function onIpFormClose(v: boolean): void {
      state.ipFormVisible = v;
      if (!v) {
        state.ipFormRid = '';
        state.ipFormDefaultParentRuleId = '';
      }
    }
    function onIpFormSaved(): void {
      state.ipFormVisible = false;
      state.ipFormRid = '';
      state.ipFormDefaultParentRuleId = '';
      listPage.search();
    }

    const listSearchSnapshotForForm = computed(() => {
      const sp = state.searchParams as Record<string, unknown>;
      return {
        subSysOrTenant: sp.subSysOrTenant,
        systemCode: sp.systemCode,
        accessRuleTypeDictCode: sp.accessRuleTypeDictCode,
      };
    });

    const {
      listLayoutRefs,
      onTableWrapMounted: layoutOnTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
    } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => {
          if (key === INDEX_COLUMN_KEY) return t('accessRuleList.columns.index');
          if (key === 'accessRuleTypeDictCode') return t('accessRuleList.columns.ruleType');
          return t('accessRuleList.columns.' + key);
        },
      },
    });

    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);

    function getAccessRuleTypeLabel(code: unknown): string {
      const c = String(code ?? '').trim();
      if (!c) return '—';
      const i18nKey = 'access_rule_type.' + c;
      const translated = t(i18nKey);
      return translated !== i18nKey ? translated : listPage.transDict('sys', 'access_rule_type', c) || c;
    }

    function formatDateCell(v: unknown): string {
      return v == null || v === '' ? '—' : listPage.formatDate(v);
    }

    /** 有 IP 子行时展示 IP 规则 remark；仅主规则占位行展示父规则 parentRemark */
    function formatRemarkCell(row: Record<string, unknown>): string {
      if (row.ipId) {
        const v = row.remark;
        return v == null || v === '' ? '—' : String(v);
      }
      const v = row.parentRemark;
      return v == null || v === '' ? '—' : String(v);
    }

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      listLayoutRefs,
      tableRef,
      onTableWrapMounted,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
      handleFormSaved,
      getAccessRuleTypeLabel,
      formatDateCell,
      formatRemarkCell,
      hasIpFormEverOpened,
      onIpFormClose,
      onIpFormSaved,
      openAddIpDialog: () => listPage.openAddIpDialog(),
      listSearchSnapshotForForm,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.access-rule-list-page :deep(.list-page-toolbar) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: flex-start;
}
.access-rule-list-page :deep(.list-page-toolbar > .toolbar-cell),
.access-rule-list-page :deep(.list-page-toolbar > .toolbar-extra),
.access-rule-list-page :deep(.list-page-toolbar > .toolbar-buttons) {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.access-rule-list-page :deep(.list-page-toolbar .toolbar-cell) {
  flex: 0 0 auto !important;
  max-width: none !important;
}
.access-rule-list-page :deep(.list-page-toolbar .toolbar-cascader) {
  min-width: 0;
  flex: 0 0 200px;
  width: 200px;
  max-width: min(200px, 42vw);
  box-sizing: border-box;
}
.access-rule-list-page :deep(.list-page-toolbar .toolbar-cascader .subsys-tenant-cascader) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100%;
}
.access-rule-list-page .list-page-toolbar .toolbar-system .search-name-input {
  min-width: 140px;
  box-sizing: border-box;
}
.access-rule-list-page .list-page-toolbar .toolbar-rule-type {
  min-width: 0;
  flex: 0 0 160px;
  max-width: min(200px, 36vw);
}
.access-rule-list-page .list-page-toolbar .toolbar-rule-type .search-select-input {
  width: 100% !important;
  min-width: 0;
  box-sizing: border-box;
}
.table-drag-drop-zone {
  flex: 1;
  min-height: 0;
}
:deep(.pagination-right) {
  margin-top: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
</style>
