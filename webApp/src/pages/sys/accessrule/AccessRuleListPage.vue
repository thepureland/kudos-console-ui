<!--
 * 访问规则 + IP 规则统一列表：查询关联视图明细行；树形分组下子系统 / 租户 / 规则类型在同一列内缩进展示。
 *
 * @author K
 * @author AI: Cursor
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
        <div class="access-rule-list-toolbar-rows">
          <div class="toolbar-row toolbar-row--primary">
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
                  v-for="item in (ruleTypeOptions || [])"
                  :key="item.first"
                  :value="item.first"
                  :label="t(item.second)"
                />
              </el-select>
            </div>
            <div class="toolbar-cell toolbar-ip-type">
              <el-select
                v-model="searchParams.ipTypeDictCode"
                :placeholder="t('accessRuleList.placeholders.ipTypeDictCode')"
                clearable
                filterable
                class="search-select-input"
                @change="search"
              >
                <el-option
                  v-for="item in (ipTypeOptions || [])"
                  :key="item.first"
                  :value="item.first"
                  :label="t(item.second)"
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
          </div>
          <div
            v-if="['ipv4', 'ipv6'].includes(String(searchParams.ipTypeDictCode ?? '').toLowerCase())"
            class="toolbar-row toolbar-row--ip"
          >
            <template v-if="String(searchParams.ipTypeDictCode ?? '').toLowerCase() === 'ipv4'">
              <div class="toolbar-cell toolbar-ip-range toolbar-ip-range--inline">
                <span class="toolbar-ip-label">{{ t('accessRuleList.searchToolbar.ipRange') }}</span>
                <IpSegmentedAddressInput v-model="searchParams.ipv4SearchStartStr" protocol="ipv4" compact />
              </div>
              <div class="toolbar-cell toolbar-ip-range toolbar-ip-range--inline">
                <span class="toolbar-ip-label">{{ t('accessRuleList.searchToolbar.through') }}</span>
                <IpSegmentedAddressInput v-model="searchParams.ipv4SearchEndStr" protocol="ipv4" compact />
              </div>
            </template>
            <template v-else-if="String(searchParams.ipTypeDictCode ?? '').toLowerCase() === 'ipv6'">
              <div class="toolbar-cell toolbar-ip-range toolbar-ip-range--inline">
                <span class="toolbar-ip-label">{{ t('accessRuleList.searchToolbar.ipRange') }}</span>
                <IpSegmentedAddressInput v-model="searchParams.ipv6SearchStartStr" protocol="ipv6" compact />
              </div>
              <div class="toolbar-cell toolbar-ip-range toolbar-ip-range--inline">
                <span class="toolbar-ip-label">{{ t('accessRuleList.searchToolbar.through') }}</span>
                <IpSegmentedAddressInput v-model="searchParams.ipv6SearchEndStr" protocol="ipv6" compact />
              </div>
            </template>
          </div>
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
          :data="treeTableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          :row-key="accessRuleTreeRowKey"
          :tree-props="{ children: 'children' }"
          default-expand-all
          :row-class-name="accessRuleTreeRowClassName"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column
            type="selection"
            width="39"
            fixed="left"
            class-name="col-fixed-selection"
            :selectable="accessRuleRowSelectable"
          />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            v-if="isColumnVisible('treeScope')"
            :label="t('accessRuleList.columns.treeScope')"
            prop="systemCode"
            min-width="168"
            sortable="custom"
            fixed="left"
            class-name="col-fixed-name access-rule-tree-scope-col"
            show-overflow-tooltip
          >
            <template #default="scope">
              <template v-if="scope.row._treeGroup">
                <span
                  v-if="scope.row._groupLevel === 0"
                  :class="['access-rule-tree-group-label', treeScopeIndentClass(scope.row)]"
                >{{ formatTreeSubsystem(scope.row.systemCode) }}</span>
                <span
                  v-else-if="scope.row._groupLevel === 1"
                  :class="['access-rule-tree-group-label', treeScopeIndentClass(scope.row)]"
                >{{ formatTreeTenant(scope.row.tenantId, scope.row.tenantName) }}</span>
                <span
                  v-else-if="scope.row._groupLevel === 2"
                  :class="['access-rule-tree-group-label', treeScopeIndentClass(scope.row)]"
                >{{ formatTreeRuleType(scope.row.accessRuleTypeDictCode) }}</span>
                <span v-else class="access-rule-tree-group-placeholder">—</span>
              </template>
              <span v-else :class="treeScopeIndentClass(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('ipStart')"
            :label="t('accessRuleList.columns.ipStart')"
            prop="ipStartStr"
            min-width="100"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="isColumnVisible('ipEnd')"
            :label="t('accessRuleList.columns.ipEnd')"
            prop="ipEndStr"
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
            min-width="88"
            align="center"
          >
            <template #default="scope">
              <template v-if="scope.row.ipId">
                <el-switch
                  v-model="scope.row.active"
                  :active-value="true"
                  :inactive-value="false"
                  @change="listPage.updateActive(scope.row)"
                />
              </template>
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
              <div v-if="!scope.row._treeGroup" class="operation-column-hover-area">
                <el-tooltip
                  :content="scope.row.ipId ? t('accessRuleList.actions.editIp') : t('accessRuleList.actions.editRule')"
                  placement="top"
                  :enterable="false"
                >
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip
                  :content="scope.row.ipId ? t('accessRuleList.actions.deleteIp') : t('accessRuleList.actions.deleteRule')"
                  placement="top"
                  :enterable="false"
                >
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip
                  :content="scope.row.ipId ? t('accessRuleList.actions.detailIp') : t('accessRuleList.actions.detailRule')"
                  placement="top"
                  :enterable="false"
                >
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
import AccessRuleIpFormPage from './AccessRuleIpFormPage.vue';
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
import { uint32ToIpv4Padded } from '../../../utils/ipAddressNumeric';
import IpSegmentedAddressInput from './IpSegmentedAddressInput.vue';

const IPV6_ZERO = '0000:0000:0000:0000:0000:0000:0000:0000';

function isDefaultIpv4SearchRange(start: unknown, end: unknown): boolean {
  const z = uint32ToIpv4Padded(0);
  return String(start ?? '').trim() === z && String(end ?? '').trim() === z;
}

function isDefaultIpv6SearchRange(start: unknown, end: unknown): boolean {
  return String(start ?? '').trim() === IPV6_ZERO && String(end ?? '').trim() === IPV6_ZERO;
}

type AccessRuleTableRow = Record<string, unknown>;

/** 将当前页扁平明细行按 子系统 → 租户 → 规则类型 三级分组为 el-table 树形数据 */
function buildAccessRuleTree(rows: AccessRuleTableRow[]): AccessRuleTableRow[] {
  if (!rows?.length) return [];
  const bySys = new Map<string, AccessRuleTableRow[]>();
  for (const row of rows) {
    const sc = row.systemCode != null && String(row.systemCode).trim() !== '' ? String(row.systemCode) : '__empty__';
    const list = bySys.get(sc);
    if (list) list.push(row);
    else bySys.set(sc, [row]);
  }
  const roots: AccessRuleTableRow[] = [];
  for (const [systemKey, sysRows] of bySys) {
    const byTenant = new Map<string, AccessRuleTableRow[]>();
    for (const r of sysRows) {
      const tid =
        r.tenantId == null || String(r.tenantId).trim() === '' ? '__platform__' : String(r.tenantId);
      const list = byTenant.get(tid);
      if (list) list.push(r);
      else byTenant.set(tid, [r]);
    }
    const tenantNodes: AccessRuleTableRow[] = [];
    for (const [tenantKey, tenantRows] of byTenant) {
      const tenantNameForGroup =
        tenantKey === '__platform__'
          ? null
          : (() => {
              const n = tenantRows[0]?.tenantName;
              return n != null && String(n).trim() !== '' ? String(n).trim() : null;
            })();
      const byType = new Map<string, AccessRuleTableRow[]>();
      for (const r of tenantRows) {
        const tc =
          r.accessRuleTypeDictCode != null && String(r.accessRuleTypeDictCode).trim() !== ''
            ? String(r.accessRuleTypeDictCode)
            : '__unknown__';
        const list = byType.get(tc);
        if (list) list.push(r);
        else byType.set(tc, [r]);
      }
      const typeNodes: AccessRuleTableRow[] = [];
      for (const [typeCode, leafRows] of byType) {
        typeNodes.push({
          _treeGroup: true,
          _groupLevel: 2,
          treeRowKey: `g:${systemKey}:${tenantKey}:type:${typeCode}`,
          systemCode: systemKey === '__empty__' ? null : systemKey,
          tenantId: tenantKey === '__platform__' ? null : tenantKey,
          tenantName: tenantNameForGroup,
          accessRuleTypeDictCode: typeCode === '__unknown__' ? null : typeCode,
          children: leafRows.map((r) => ({
            ...r,
            treeRowKey: String(r.id ?? ''),
          })),
        });
      }
      tenantNodes.push({
        _treeGroup: true,
        _groupLevel: 1,
        treeRowKey: `g:${systemKey}:${tenantKey}`,
        systemCode: systemKey === '__empty__' ? null : systemKey,
        tenantId: tenantKey === '__platform__' ? null : tenantKey,
        tenantName: tenantNameForGroup,
        children: typeNodes,
      });
    }
    roots.push({
      _treeGroup: true,
      _groupLevel: 0,
      treeRowKey: `g:${systemKey}`,
      systemCode: systemKey === '__empty__' ? null : systemKey,
      children: tenantNodes,
    });
  }
  return roots;
}

/**
 * 主从合一列表：查询 v_sys_access_rule_with_ip；有 ipId 行为 IP 子行，无 ipId 为仅主规则占位行。
 */
class AccessRuleListPage extends TenantSupportListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['access_rule_type', 'ip_type'], 'sys').then(() => {
      const s = this.state as Record<string, unknown>;
      s.ruleTypeOptions = this.getDictItems('sys', 'access_rule_type');
      s.ipTypeOptions = this.getDictItems('sys', 'ip_type');
    });
    this.convertThis();
    this.loadAtomicServices();
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['access_rule_type', 'ip_type'], atomicServiceCode: 'sys' }];
  }

  protected getFirstLevelApiUrl(): string | null {
    return 'sys/system/getAllActiveSubSystemCodes';
  }

  protected isCheckStrictly(): boolean {
    return true;
  }

  protected initState(): Record<string, unknown> {
    return {
      ruleTypeOptions: [] as Array<{ first: string; second: string }>,
      ipTypeOptions: [] as Array<{ first: string; second: string }>,
      ipFormVisible: false,
      ipFormRid: '',
      ipFormDefaultParentRuleId: '',
      searchParams: {
        systemCode: null as string | null,
        accessRuleTypeDictCode: null as string | null,
        parentActive: true,
        ipTypeDictCode: null as string | null,
        ipv4SearchStartStr: uint32ToIpv4Padded(0),
        ipv4SearchEndStr: uint32ToIpv4Padded(0),
        ipv6SearchStartStr: IPV6_ZERO,
        ipv6SearchEndStr: IPV6_ZERO,
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

    const ipTypeRaw = sp.ipTypeDictCode;
    const ipType =
      ipTypeRaw != null && String(ipTypeRaw).trim() !== '' ? String(ipTypeRaw).trim() : null;
    if (ipType) {
      base.ipTypeDictCode = ipType;
      const t = ipType.toLowerCase();
      if (t === 'ipv4') {
        if (isDefaultIpv4SearchRange(sp.ipv4SearchStartStr, sp.ipv4SearchEndStr)) {
          delete (base as Record<string, unknown>).ipStartStr;
          delete (base as Record<string, unknown>).ipEndStr;
        } else {
          base.ipStartStr = String(sp.ipv4SearchStartStr ?? '');
          base.ipEndStr = String(sp.ipv4SearchEndStr ?? '');
        }
      } else if (t === 'ipv6') {
        if (isDefaultIpv6SearchRange(sp.ipv6SearchStartStr, sp.ipv6SearchEndStr)) {
          delete (base as Record<string, unknown>).ipStartStr;
          delete (base as Record<string, unknown>).ipEndStr;
        } else {
          base.ipStartStr = String(sp.ipv6SearchStartStr ?? '');
          base.ipEndStr = String(sp.ipv6SearchEndStr ?? '');
        }
      } else {
        delete (base as Record<string, unknown>).ipStartStr;
        delete (base as Record<string, unknown>).ipEndStr;
      }
    } else {
      delete (base as Record<string, unknown>).ipTypeDictCode;
      delete (base as Record<string, unknown>).ipStartStr;
      delete (base as Record<string, unknown>).ipEndStr;
    }

    delete (base as Record<string, unknown>).subSysOrTenant;
    delete (base as Record<string, unknown>).subSystemCode;
    delete (base as Record<string, unknown>).active;
    delete (base as Record<string, unknown>).ipv4SearchStartStr;
    delete (base as Record<string, unknown>).ipv4SearchEndStr;
    delete (base as Record<string, unknown>).ipv6SearchStartStr;
    delete (base as Record<string, unknown>).ipv6SearchEndStr;
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
    self.handleDetail = (row: Record<string, unknown>) => {
      if (row._treeGroup) return;
      const s = self.state as Record<string, unknown>;
      s.rid = self.getRowId(row);
      s.detailDialogVisible = true;
    };
    self.multiDelete = () => {
      void self.doMultiDeleteUnified();
    };
  }

  /** 有 IP 子行则编辑 IP 表单；否则编辑主规则 */
  protected doHandleEditUnified(row: Record<string, unknown>): void {
    if (row._treeGroup) return;
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
    if (row._treeGroup) return '';
    return row.ipId
      ? (t('accessRuleList.messages.deleteIpConfirm') as string)
      : (t('accessRuleList.messages.deleteRuleConfirm') as string);
  }

  protected async doHandleDeleteUnified(row: Record<string, unknown>): Promise<void> {
    if (row._treeGroup) return;
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
    const rows = ((this.state.selectedItems as Record<string, unknown>[]) ?? []).filter((r) => !r._treeGroup);
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
    if (row._treeGroup) return;
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
/** v2：合并子系统/租户/规则类型为 treeScope 列后更换 key，避免沿用旧列 key 导致新列被隐藏 */
const COLUMN_VISIBILITY_STORAGE_KEY = 'accessRuleList.visibleColumns.v2';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig([
  'treeScope',
  'ipStart',
  'ipEnd',
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
    IpSegmentedAddressInput,
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
          if (key === 'treeScope') return t('accessRuleList.columns.treeScope');
          return t('accessRuleList.columns.' + key);
        },
      },
    });

    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);

    /** 与 CacheListPage 缓存策略一致：字典项 second 为 i18n key，用 t(item.second)；表格内按 first 查找选项 */
    type DictPairOpt = { first: string; second: string };
    function dictLabelFromOptions(code: unknown, options: DictPairOpt[] | null | undefined): string {
      const c = code != null && String(code).trim() !== '' ? String(code).trim() : '';
      if (!c) return '—';
      const opts = options ?? [];
      const item = opts.find((o) => o.first === c);
      return item ? (t(item.second) as string) : c;
    }

    function formatDateCell(v: unknown): string {
      return v == null || v === '' ? '—' : listPage.formatDate(v);
    }

    /** 有 IP 子行时展示 IP 规则 remark；仅主规则占位行展示父规则 parentRemark */
    function formatRemarkCell(row: Record<string, unknown>): string {
      if (row._treeGroup) return '—';
      if (row.ipId) {
        const v = row.remark;
        return v == null || v === '' ? '—' : String(v);
      }
      const v = row.parentRemark;
      return v == null || v === '' ? '—' : String(v);
    }

    const treeTableData = computed(() => buildAccessRuleTree((state.tableData as AccessRuleTableRow[]) ?? []));

    function accessRuleTreeRowKey(row: AccessRuleTableRow): string {
      const k = row.treeRowKey;
      if (k != null && String(k) !== '') return String(k);
      const id = row.id;
      if (id != null && String(id) !== '') return String(id);
      return `row-${String(row.parentId ?? '')}-${String(row.ipId ?? '')}-${String(row.systemCode ?? '')}`;
    }

    function accessRuleRowSelectable(row: AccessRuleTableRow): boolean {
      return !row._treeGroup;
    }

    /** 分组行高亮；明细行仍区分 IP 段与主规则占位（样式） */
    function accessRuleTreeRowClassName({ row }: { row: AccessRuleTableRow }): string {
      if (row._treeGroup) return 'access-rule-list-row--tree-group';
      return row.ipId ? 'access-rule-list-row--ip' : 'access-rule-list-row--rule';
    }

    function treeScopeIndentClass(row: AccessRuleTableRow): string {
      if (row._treeGroup) {
        const lv = row._groupLevel;
        if (lv === 0) return 'access-rule-tree-scope-indent--0';
        if (lv === 1) return 'access-rule-tree-scope-indent--1';
        if (lv === 2) return 'access-rule-tree-scope-indent--2';
      }
      return 'access-rule-tree-scope-indent--leaf';
    }

    function formatTreeSubsystem(code: unknown): string {
      if (code == null || String(code).trim() === '') return '—';
      return listPage.transAtomicService(code);
    }

    function formatTreeTenant(tenantId: unknown, tenantName?: unknown): string {
      if (tenantId == null || String(tenantId).trim() === '') {
        return t('accessRuleList.treeGroup.platformTenant') as string;
      }
      if (tenantName != null && String(tenantName).trim() !== '') {
        return String(tenantName).trim();
      }
      return String(tenantId);
    }

    function formatTreeRuleType(code: unknown): string {
      return dictLabelFromOptions(code, state.ruleTypeOptions as DictPairOpt[] | undefined);
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
      formatDateCell,
      formatRemarkCell,
      treeTableData,
      accessRuleTreeRowKey,
      accessRuleRowSelectable,
      accessRuleTreeRowClassName,
      treeScopeIndentClass,
      formatTreeSubsystem,
      formatTreeTenant,
      formatTreeRuleType,
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
  align-items: stretch;
  flex-wrap: wrap;
  width: 100%;
  gap: 0;
  justify-content: flex-start;
}
.access-rule-list-page .access-rule-list-toolbar-rows {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.access-rule-list-page .toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
/** 与筛选项同一行；避免 search/reset 被单独换到下一行 */
.access-rule-list-page .toolbar-row--primary {
  flex-wrap: nowrap;
}
.access-rule-list-page .toolbar-row--primary .toolbar-buttons {
  flex: 0 0 auto;
}
.access-rule-list-page .toolbar-row--ip {
  align-items: center;
}
.access-rule-list-page .toolbar-ip-range--inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.access-rule-list-page .toolbar-ip-range--inline .toolbar-ip-label {
  font-size: var(--el-font-size-base, 14px);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  line-height: var(--el-component-line-height, 1.4);
}
.access-rule-list-page .toolbar-cell.toolbar-ip-type {
  flex: 0 0 140px;
  width: 140px;
  min-width: 120px;
  max-width: 160px;
}
.access-rule-list-page :deep(.list-page-toolbar .toolbar-cell),
.access-rule-list-page :deep(.list-page-toolbar .toolbar-extra),
.access-rule-list-page :deep(.list-page-toolbar .toolbar-buttons) {
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

/* 树形分组行 */
.access-rule-list-page :deep(tr.access-rule-list-row--tree-group > td.el-table__cell) {
  background-color: var(--el-fill-color-light) !important;
  font-weight: 500;
}
.access-rule-list-page :deep(tr.access-rule-list-row--tree-group:hover > td.el-table__cell) {
  background-color: var(--el-table-row-hover-bg-color) !important;
}
.access-rule-list-page .access-rule-tree-group-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.access-rule-list-page .access-rule-tree-group-placeholder {
  color: var(--el-text-color-placeholder);
}

/* 树形分组：子系统 / 租户 / 规则类型 同列缩进 */
.access-rule-list-page .access-rule-tree-scope-col .access-rule-tree-scope-indent--0 {
  display: inline-block;
  padding-left: 0;
}
.access-rule-list-page .access-rule-tree-scope-col .access-rule-tree-scope-indent--1 {
  display: inline-block;
  padding-left: 1.25rem;
}
.access-rule-list-page .access-rule-tree-scope-col .access-rule-tree-scope-indent--2 {
  display: inline-block;
  padding-left: 2.5rem;
}
.access-rule-list-page .access-rule-tree-scope-col .access-rule-tree-scope-indent--leaf {
  display: inline-block;
  min-height: 1em;
  padding-left: 3.75rem;
}

/* IP 明细行相对主规则占位行略作层级区分 */
.access-rule-list-page :deep(.el-table__body tr.access-rule-list-row--ip > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 var(--el-color-primary-light-5);
}
.access-rule-list-page :deep(tr.access-rule-list-row--ip.el-table__row--striped),
.access-rule-list-page :deep(tr.access-rule-list-row--ip:not(.el-table__row--striped)) {
  background-color: var(--el-fill-color-lighter) !important;
}
.access-rule-list-page :deep(tr.access-rule-list-row--ip:hover > td.el-table__cell) {
  background-color: var(--el-table-row-hover-bg-color) !important;
}
.access-rule-list-page .access-rule-list-cell--ip-indent {
  padding-left: 12px;
}
</style>
