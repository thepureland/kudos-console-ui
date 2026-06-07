<!--
 * Contact way (phone / email) list: filter by user id / contact value / contact way dict code.
 *
 * @author: K
 * @author: AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="contact-way-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('contactWayList.actions.showColumnPanel')"
      :column-panel-hide-text="t('contactWayList.actions.hideColumnPanel')"
      :operation-column-show-text="t('contactWayList.actions.showOperationColumn')"
      :operation-column-hide-text="t('contactWayList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-user-id">
          <el-input v-model="searchParams.userId" :placeholder="t('contactWayList.placeholders.userId')" clearable class="search-name-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-cell toolbar-contact-value">
          <el-input v-model="searchParams.contactWayValue" :placeholder="t('contactWayList.placeholders.contactWayValue')" clearable class="search-name-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-cell toolbar-contact-type">
          <el-input v-model="searchParams.contactWayDictCode" :placeholder="t('contactWayList.placeholders.contactWayDictCode')" clearable class="search-name-input" @keyup="(e) => e.key === 'Enter' && search()" @change="search" />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">{{ t('contactWayList.actions.activeOnly') }}</el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search"><el-icon><Search /></el-icon>{{ t('contactWayList.actions.search') }}</el-button>
          <el-button type="primary" round @click="resetSearchFields"><el-icon><RefreshLeft /></el-icon>{{ t('contactWayList.actions.reset') }}</el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="danger" @click="multiDelete"><el-icon><Delete /></el-icon>{{ t('contactWayList.actions.delete') }}</el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('contactWayList.actions.columnVisibility') }}</div>
        <el-checkbox-group v-model="visibleColumnKeys" class="column-visibility-checkboxes">
          <el-checkbox v-for="item in columnVisibilityOptions" :key="item.key" :value="item.key">{{ item.label }}</el-checkbox>
        </el-checkbox-group>
      </template>
      <div class="table-drag-drop-zone">
        <el-table ref="tableRef" border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" @selection-change="handleSelectionChange" @sort-change="handleSortChange">
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column :label="t('contactWayList.columns.userId')" prop="userId" min-width="160" sortable="custom" fixed="left" class-name="col-fixed-name" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('contactWayDictCode')" :label="t('contactWayList.columns.contactWayDictCode')" prop="contactWayDictCode" :min-width="columnWidths['contactWayDictCode'] ?? 120" sortable="custom" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('contactWayValue')" :label="t('contactWayList.columns.contactWayValue')" prop="contactWayValue" :min-width="columnWidths['contactWayValue'] ?? 200" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('contactWayStatusDictCode')" :label="t('contactWayList.columns.contactWayStatusDictCode')" prop="contactWayStatusDictCode" :min-width="columnWidths['contactWayStatusDictCode'] ?? 120" sortable="custom" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('priority')" :label="t('contactWayList.columns.priority')" prop="priority" :min-width="columnWidths['priority'] ?? 80" sortable="custom" show-overflow-tooltip />
          <el-table-column v-if="isColumnVisible('createTime')" :label="t('contactWayList.columns.createTime')" prop="createTime" :min-width="columnWidths['createTime'] ?? 160" sortable="custom" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.createTime) }}</template>
          </el-table-column>
          <el-table-column v-if="isColumnVisible('active')" :label="t('contactWayList.columns.active')" prop="active" :min-width="columnWidths['active'] ?? 80" show-overflow-tooltip>
            <template #default="scope">
              <el-switch v-model="scope.row.active" :active-value="true" :inactive-value="false" @change="updateActive(scope.row)" />
            </template>
          </el-table-column>
          <el-table-column v-if="showOperationColumn" :label="t('contactWayList.columns.operation')" align="center" fixed="right" min-width="68" class-name="operation-column" label-class-name="operation-column">
            <template #header><div class="operation-column-hover-area">{{ t('contactWayList.columns.operation') }}</div></template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('contactWayList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)"><Delete /></el-icon>
                </el-tooltip>
                <el-tooltip :content="t('contactWayList.actions.detail')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDetail(scope.row)"><Tickets /></el-icon>
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

    <contact-way-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { Delete, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import ContactWayDetailPage from './ContactWayDetailPage.vue';
import { createColumnVisibilityConfig } from '../../../components/pages/list';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useValidationI18nCacheProvider, useTableAutoWidthContext, useFixedLeftTableWidth, useFixedLeftRelayoutWatcher, useListPageVisibilityState } from '../../../components/pages/list';
import { ListPageLayout } from '../../../components/pages/ui';

class ContactWayListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        userId: null as string | null,
        contactWayDictCode: null as string | null,
        contactWayValue: null as string | null,
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/contactWay';
  }

  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (params && this.state.searchParams) {
      const sp = this.state.searchParams as Record<string, unknown>;
      // Send `true` when the "active only" checkbox is checked; send `null` (no filter) otherwise.
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }
}

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'contactWayList.operationColumnPinned';
const COLUMN_VISIBILITY_STORAGE_KEY = 'contactWayList.visibleColumns';
const {
  indexColumnKey: INDEX_COLUMN_KEY,
  columnVisibilityKeys: COLUMN_VISIBILITY_KEYS,
  defaultVisibleColumnKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
} = createColumnVisibilityConfig(['contactWayDictCode', 'contactWayValue', 'contactWayStatusDictCode', 'priority', 'createTime', 'active']);
// 39 = selection column, 50 = index column, 160 = userId column
const FIXED_LEFT_TOTAL_WIDTH = 39 + 50 + 160;

export default defineComponent({
  name: 'ContactWayListPage',
  components: { ContactWayDetailPage, ListPageLayout, Delete, Tickets, Search, RefreshLeft },
  setup(props: ListPageProps, context: ListPageContext) {
    useValidationI18nCacheProvider();
    const { t } = useI18n();
    const listPage = reactive(new ContactWayListPage(props, context)) as ContactWayListPage & { state: Record<string, unknown> };
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted, visibleColumnKeys, columnVisibilityOptions } = useListPageLayout(listPage, {
      columnVisibility: {
        storageKey: COLUMN_VISIBILITY_STORAGE_KEY,
        columnKeys: COLUMN_VISIBILITY_KEYS,
        defaultVisibleKeys: DEFAULT_VISIBLE_COLUMN_KEYS,
        getColumnLabel: (key) => (key === INDEX_COLUMN_KEY ? t('contactWayList.columns.index') : t('contactWayList.columns.' + key)),
      },
    });
    const tableRef = ref<{ doLayout: () => void; $el?: HTMLElement } | null>(null);
    const forceFixedLeftWidth = useFixedLeftTableWidth(tableRef, FIXED_LEFT_TOTAL_WIDTH);
    const { isColumnVisible, onTableWrapMounted } = useListPageVisibilityState(listPage, layoutOnTableWrapMounted);
    useFixedLeftRelayoutWatcher(listPage, forceFixedLeftWidth);

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 249,
      reservedWidthRight: 140,
      createAutoWidthColumns: () => [
        { key: 'contactWayDictCode', getLabel: () => t('contactWayList.columns.contactWayDictCode'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.contactWayDictCode ?? '') },
        { key: 'contactWayValue', getLabel: () => t('contactWayList.columns.contactWayValue'), sortable: false, getCellText: (row: Record<string, unknown>) => String(row.contactWayValue ?? '') },
        { key: 'contactWayStatusDictCode', getLabel: () => t('contactWayList.columns.contactWayStatusDictCode'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.contactWayStatusDictCode ?? '') },
        { key: 'priority', getLabel: () => t('contactWayList.columns.priority'), sortable: true, getCellText: (row: Record<string, unknown>) => String(row.priority ?? '') },
        { key: 'createTime', getLabel: () => t('contactWayList.columns.createTime'), sortable: true, getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.createTime) },
        { key: 'active', getLabel: () => t('contactWayList.columns.active'), sortable: false, getCellText: () => '' },
      ],
    });

    return {
      listPage, OPERATION_COLUMN_PINNED_STORAGE_KEY,
      ...toRefs(listPage.state), ...toRefs(listPage),
      t, listLayoutRefs, tableRef, onTableWrapMounted,
      visibleColumnKeys, columnVisibilityOptions, isColumnVisible, columnWidths,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.contact-way-list-page .list-page-toolbar .toolbar-user-id,
.contact-way-list-page .list-page-toolbar .toolbar-contact-value,
.contact-way-list-page .list-page-toolbar .toolbar-contact-type { margin-right: 8px; }
.contact-way-list-page .list-page-toolbar .toolbar-user-id .search-name-input,
.contact-way-list-page .list-page-toolbar .toolbar-contact-value .search-name-input,
.contact-way-list-page .list-page-toolbar .toolbar-contact-type .search-name-input { width: 100%; min-width: 0; box-sizing: border-box; }
.contact-way-list-page .list-page-toolbar .toolbar-user-id :deep(.el-input__wrapper),
.contact-way-list-page .list-page-toolbar .toolbar-contact-value :deep(.el-input__wrapper),
.contact-way-list-page .list-page-toolbar .toolbar-contact-type :deep(.el-input__wrapper) { min-width: 0; }
.table-drag-drop-zone { flex: 1; min-height: 0; }
:deep(.el-table .cell) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
:deep(.el-table__row) { height: 32px; }
:deep(.el-table__fixed-left) { width: 249px !important; max-width: 249px !important; }
:deep(.el-table th.col-fixed-selection), :deep(.el-table td.col-fixed-selection) { width: 39px !important; min-width: 39px !important; max-width: 39px !important; }
:deep(.el-table th.col-fixed-index), :deep(.el-table td.col-fixed-index) { width: 50px !important; min-width: 50px !important; max-width: 50px !important; }
:deep(.el-table th.col-fixed-name), :deep(.el-table td.col-fixed-name) { width: 160px !important; min-width: 160px !important; max-width: 160px !important; }
:deep(.pagination-right) { margin-top: 8px; justify-content: flex-end; flex-shrink: 0; }
</style>
