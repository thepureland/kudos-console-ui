<!--
 * System audit log list: read-only viewer over sys_audit_log (kudos-ability-log-audit).
 *
 * Filters: operator (LIKE), moduleCode, operateType, date range.
 * No add/edit/delete — audit logs are append-only and immutable by design.
 *
 * Backend dependency (TODO if not present): a SysAuditLogAdminController exposing
 *   POST /api/admin/sys/auditLog/pagingSearch  → page of SysAuditLogVo
 *   GET  /api/admin/sys/auditLog/getDetail     → SysAuditDetailLogVo (joined main + detail)
 * VOs already exist in kudos-ability-log-audit-common.
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <div class="audit-log-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('auditLogList.actions.showColumnPanel')"
      :column-panel-hide-text="t('auditLogList.actions.hideColumnPanel')"
      :operation-column-show-text="t('auditLogList.actions.showOperationColumn')"
      :operation-column-hide-text="t('auditLogList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell">
          <el-input
            v-model="searchParams.operator"
            :placeholder="t('auditLogList.placeholders.operator')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell">
          <el-input
            v-model="searchParams.moduleCode"
            :placeholder="t('auditLogList.placeholders.moduleCode')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell">
          <el-input
            v-model="searchParams.operateType"
            :placeholder="t('auditLogList.placeholders.operateType')"
            clearable
            class="search-name-input"
            @keyup="(e) => (e as KeyboardEvent).key === 'Enter' && search()"
            @change="search"
          />
        </div>
        <div class="toolbar-cell">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            :range-separator="t('auditLogList.placeholders.dateRangeSep')"
            :start-placeholder="t('auditLogList.placeholders.dateRangeStart')"
            :end-placeholder="t('auditLogList.placeholders.dateRangeEnd')"
            value-format="YYYY-MM-DD HH:mm:ss"
            @change="onDateRangeChange"
          />
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('auditLogList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('auditLogList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <div class="table-drag-drop-zone">
        <el-table
          ref="tableRef"
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          :header-cell-style="{ textAlign: 'center' }"
          @sort-change="handleSortChange"
        >
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('auditLogList.columns.operateTime')" prop="operateTime" min-width="160" sortable="custom" fixed="left" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.operateTime) }}</template>
          </el-table-column>
          <el-table-column :label="t('auditLogList.columns.operator')" prop="operator" min-width="120" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.moduleName')" prop="moduleName" min-width="140" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.operateType')" prop="operateType" min-width="100" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.description')" prop="description" min-width="200" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.entityId')" prop="entityId" min-width="120" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.operateIp')" prop="operateIp" min-width="120" show-overflow-tooltip>
            <template #default="scope">{{ formatIp(scope.row.operateIp) }}</template>
          </el-table-column>
          <el-table-column :label="t('auditLogList.columns.requestType')" prop="requestType" min-width="80" show-overflow-tooltip />
          <el-table-column :label="t('auditLogList.columns.subSysCode')" prop="subSysCode" min-width="100" show-overflow-tooltip>
            <template #default="scope">{{ transAtomicService(scope.row.subSysCode) }}</template>
          </el-table-column>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('auditLogList.columns.operation')"
            align="center"
            fixed="right"
            min-width="68"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #default="scope">
              <el-tooltip :content="t('auditLogList.actions.detail')" placement="top" :enterable="false">
                <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)">
                  <Tickets />
                </el-icon>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #pagination>
        <el-pagination
          :ref="(el: unknown) => { listLayoutRefs.paginationRef.value = el as HTMLElement | null; }"
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

    <audit-log-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import AuditLogDetailPage from './AuditLogDetailPage.vue';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useListPageVisibilityState, useOperationColumnVisible } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'auditLogList.operationColumnPinned';

class AuditLogListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
    this.loadAtomicServices();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        operator: null as string | null,
        moduleCode: null as string | null,
        operateType: null as string | null,
        operateTimeStart: null as string | null,
        operateTimeEnd: null as string | null,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'sys/auditLog';
  }
}

/** Render a long-encoded IPv4/IPv6 (BIGINT) back to dotted-decimal; legacy ipv4-only fallback. */
function formatIpAddress(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return String(raw);
  // 32-bit IPv4
  if (n <= 0xffffffff) {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
  }
  return String(raw);
}

export default defineComponent({
  name: 'AuditLogListPage',
  components: { AuditLogDetailPage, ListPageLayout, Tickets, Search, RefreshLeft },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new AuditLogListPage(props, context)) as AuditLogListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {});
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    const showOperationColumn = useOperationColumnVisible(listPage);
    const tableRef = ref<{ doLayout?: () => void } | null>(null);
    const dateRange = ref<[string, string] | null>(null);

    function onDateRangeChange(value: [string, string] | null): void {
      const sp = listPage.state.searchParams as Record<string, unknown>;
      sp.operateTimeStart = value?.[0] ?? null;
      sp.operateTimeEnd = value?.[1] ?? null;
      listPage.search();
    }

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      listLayoutRefs,
      tableRef,
      isColumnVisible,
      onTableWrapMounted,
      showOperationColumn,
      dateRange,
      onDateRangeChange,
      formatIp: formatIpAddress,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.audit-log-list-page {
  height: 100%;
}
.audit-log-list-page :deep(.list-page-card) {
  margin-top: 3px;
}
.audit-log-list-page .list-page-toolbar .toolbar-cell {
  margin-right: 8px;
}
.audit-log-list-page .list-page-toolbar .search-name-input {
  min-width: 140px;
}
.audit-log-list-page :deep(.pagination-right) {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  flex-shrink: 0;
}
</style>
