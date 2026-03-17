<!--
 * 组织列表：支持按子系统与租户、仅启用筛选，表格支持列可见性、操作列折角，多语言。
 *
 * @author: K
 * @author: AI: Cursor
 * @since 1.0.0
 -->
<template>
  <div class="organization-list-page list-page-common">
    <list-page-layout
      :table-wrap-ref="listLayoutRefs.tableWrapRef"
      :list-page="listPage"
      :operation-column-storage-key="OPERATION_COLUMN_PINNED_STORAGE_KEY"
      :column-panel-show-text="t('organizationList.actions.showColumnPanel')"
      :column-panel-hide-text="t('organizationList.actions.hideColumnPanel')"
      :operation-column-show-text="t('organizationList.actions.showOperationColumn')"
      :operation-column-hide-text="t('organizationList.actions.hideOperationColumn')"
      @table-wrap-mounted="onTableWrapMounted"
    >
      <template #toolbar>
        <div class="toolbar-cell toolbar-cascader">
          <el-cascader
            v-model="searchParams.subSysOrTenant"
            :options="subSysOrTenants || []"
            :props="cascaderProps"
            :placeholder="t('organizationList.placeholders.subSysTenant')"
            clearable
            class="search-cascader-input"
            @change="search"
          />
        </div>
        <div class="toolbar-extra">
          <el-checkbox v-model="searchParams.active" class="active-only-checkbox" @change="search">
            {{ t('organizationList.actions.activeOnly') }}
          </el-checkbox>
        </div>
        <div class="toolbar-buttons">
          <el-button type="primary" round @click="search">
            <el-icon><Search /></el-icon>
            {{ t('organizationList.actions.search') }}
          </el-button>
          <el-button type="primary" round @click="resetSearchFields">
            <el-icon><RefreshLeft /></el-icon>
            {{ t('organizationList.actions.reset') }}
          </el-button>
        </div>
      </template>
      <template #tableToolbar>
        <el-button type="success" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          {{ t('organizationList.actions.add') }}
        </el-button>
        <el-button type="danger" @click="multiDelete">
          <el-icon><Delete /></el-icon>
          {{ t('organizationList.actions.delete') }}
        </el-button>
      </template>
      <template #columnVisibilityPanel>
        <div class="column-visibility-title">{{ t('organizationList.actions.columnVisibility') }}</div>
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
      <div
        class="table-drag-drop-zone"
        @dragover="onTableDragOver"
        @drop="onTableDrop"
      >
        <el-table
          ref="tableRef"
          border
          stripe
          :data="tableData"
          :max-height="tableMaxHeight"
          default-expand-all
          row-key="id"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="39" fixed="left" class-name="col-fixed-selection" />
          <el-table-column v-if="isColumnVisible('index')" type="index" min-width="50" fixed="left" class-name="col-fixed-index" />
          <el-table-column
            :label="t('organizationList.columns.name')"
            prop="name"
            min-width="120"
            fixed="left"
            class-name="col-fixed-name"
          />
          <template v-for="key in orderedColumnKeys" :key="key">
            <el-table-column
              v-if="key === 'abbrName' && isColumnVisible('abbrName')"
              prop="abbrName"
              :min-width="columnWidths['abbrName'] ?? 100"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="abbrName"
                  :class="{ 'is-dragging': columnDragKey === 'abbrName', 'is-drop-target': columnDropTargetKey === 'abbrName' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'abbrName')"
                  @dragover="onHeaderDragOver($event, 'abbrName')"
                  @drop="onHeaderDrop($event, 'abbrName')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.abbrName') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'orgTypeDictCode' && isColumnVisible('orgTypeDictCode')"
              prop="orgTypeDictCode"
              :min-width="columnWidths['orgTypeDictCode'] ?? 100"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="orgTypeDictCode"
                  :class="{ 'is-dragging': columnDragKey === 'orgTypeDictCode', 'is-drop-target': columnDropTargetKey === 'orgTypeDictCode' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'orgTypeDictCode')"
                  @dragover="onHeaderDragOver($event, 'orgTypeDictCode')"
                  @drop="onHeaderDrop($event, 'orgTypeDictCode')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.orgType') }}</div>
              </template>
              <template #default="scope">
                {{ formatOrgTypeLabel(scope.row.orgTypeDictCode) }}
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'seqNo' && isColumnVisible('seqNo')"
              prop="seqNo"
              :min-width="columnWidths['seqNo'] ?? 80"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="seqNo"
                  :class="{ 'is-dragging': columnDragKey === 'seqNo', 'is-drop-target': columnDropTargetKey === 'seqNo' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'seqNo')"
                  @dragover="onHeaderDragOver($event, 'seqNo')"
                  @drop="onHeaderDrop($event, 'seqNo')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.seqNo') }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'active' && isColumnVisible('active')"
              :min-width="columnWidths['active'] ?? 80"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="active"
                  :class="{ 'is-dragging': columnDragKey === 'active', 'is-drop-target': columnDropTargetKey === 'active' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'active')"
                  @dragover="onHeaderDragOver($event, 'active')"
                  @drop="onHeaderDrop($event, 'active')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.active') }}</div>
              </template>
              <template #default="scope">
                <el-switch
                  v-model="scope.row.active"
                  :active-value="true"
                  :inactive-value="false"
                  @change="updateActive(scope.row)"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-else-if="key === 'createTime' && isColumnVisible('createTime')"
              :min-width="columnWidths['createTime'] ?? 160"
            >
              <template #header>
                <div
                  class="column-header-draggable"
                  data-column-key="createTime"
                  :class="{ 'is-dragging': columnDragKey === 'createTime', 'is-drop-target': columnDropTargetKey === 'createTime' }"
                  draggable="true"
                  @dragstart="onHeaderDragStart($event, 'createTime')"
                  @dragover="onHeaderDragOver($event, 'createTime')"
                  @drop="onHeaderDrop($event, 'createTime')"
                  @dragend="onHeaderDragEnd"
                >{{ t('organizationList.columns.createTime') }}</div>
              </template>
              <template #default="scope">
                {{ formatDate(scope.row.createTime) }}
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="showOperationColumn"
            :label="t('organizationList.columns.operation')"
            align="center"
            min-width="160"
            class-name="operation-column"
            label-class-name="operation-column"
          >
            <template #header>
              <div class="operation-column-hover-area">{{ t('organizationList.columns.operation') }}</div>
            </template>
            <template #default="scope">
              <div class="operation-column-hover-area">
                <el-tooltip :content="t('organizationList.actions.edit')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleEdit(scope.row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('organizationList.actions.delete')" placement="top" :enterable="false">
                  <el-icon :size="20" class="operate-column-icon" @click="handleDelete(scope.row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
                <el-tooltip :content="t('organizationList.actions.detail')" placement="top" :enterable="false">
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
        <!-- 组织树无分页 -->
      </template>
    </list-page-layout>

    <!-- 添加/编辑共用一个表单，首次打开任一时挂载；v-if/v-show 挂在原生 div 上避免 ElDialog 非元素根节点指令警告 -->
    <div v-if="hasFormEverOpened" v-show="formVisible">
      <organization-form-page
        :model-value="formVisible"
        :rid="formRid"
        @update:modelValue="onFormClose"
        @response="onFormResponse"
      />
    </div>
    <OrganizationDetailPage v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, nextTick, watch, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Delete, Edit, Plus, RefreshLeft, Search, Tickets } from '@element-plus/icons-vue';
import OrganizationFormPage from './OrganizationFormPage.vue';
import OrganizationDetailPage from './OrganizationDetailPage.vue';
import ListPageLayout from '../../../components/pages/ListPageLayout.vue';
import { TenantSupportListPage } from '../../../components/pages/TenantSupportListPage';
import { useListPageLayout } from '../../../components/pages/useListPageLayout';
import { useColumnOrderDrag } from '../../../components/pages/useColumnOrderDrag';
import { useTableColumnAutoWidth } from '../../../components/pages/useTableColumnAutoWidth';
import { ValidationI18nCacheKey } from '../../../components/pages/useAddEditDialogSetup';
import { Pair } from '../../../components/model/Pair';

const OPERATION_COLUMN_PINNED_STORAGE_KEY = 'organizationList.operationColumnPinned';
const ORGANIZATION_LIST_STATE_STORAGE_KEY = 'organizationList.queryState';
const COLUMN_VISIBILITY_STORAGE_KEY = 'organizationList.visibleColumns';
const COLUMN_ORDER_STORAGE_KEY = 'organizationList.columnOrder';
const INDEX_COLUMN_KEY = 'index';
const ALL_COLUMN_KEYS = ['abbrName', 'orgTypeDictCode', 'seqNo', 'active', 'createTime'];
const COLUMN_VISIBILITY_KEYS = [INDEX_COLUMN_KEY, ...ALL_COLUMN_KEYS];
const DEFAULT_VISIBLE_COLUMN_KEYS = [...ALL_COLUMN_KEYS];

/** 列 key 到 i18n key 的映射（orgTypeDictCode -> orgType）；名称列固定左侧，不参与可见性配置 */
const COLUMN_KEY_TO_I18N: Record<string, string> = {
  abbrName: 'abbrName',
  orgTypeDictCode: 'orgType',
  seqNo: 'seqNo',
  active: 'active',
  createTime: 'createTime',
};

class OrganizationListPage extends TenantSupportListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.convertThis();
    this.loadDicts(['organization_type'], 'user');
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        subSysOrTenant: null as string[] | null,
        active: true,
      },
    };
  }

  protected getRootActionPath(): string {
    return 'user/organization';
  }

  /** 组织类型字典项译文从后端取（表格列 transDict） */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['organization_type'], atomicServiceCode: 'user' }];
  }

  protected getSearchUrl(): string {
    return this.getRootActionPath() + '/searchTree';
  }

  /** 与角色列表一致：只覆盖 createSearchParams，doSearch 用基类，保证 tenantId 随 params 一起发到 searchTree */
  protected createSearchParams(): Record<string, unknown> | null {
    const params = super.createSearchParams();
    if (!params) return null;
    const sp = this.state.searchParams as { active?: boolean; subSysOrTenant?: string[] | null } | undefined;
    if (sp) {
      (params as Record<string, unknown>).active = sp.active === true ? true : null;
    }
    return params;
  }

  protected getDeleteMessage(_row: unknown): string {
    return '将级联删除所有孩子结点（如果有的话），依然进行删除操作吗？';
  }

  protected getBatchDeleteMessage(rows: Array<unknown>): string {
    return '将级联删除所有孩子结点（如果有的话），' + super.getBatchDeleteMessage(rows);
  }

  protected isCheckStrictly(): boolean {
    return false;
  }

  /** 必须先选择子系统/租户再搜索，按所选租户请求组织树 */
  protected isRequireSubSysOrTenantForSearch(): boolean {
    return true;
  }
}

export default defineComponent({
  name: 'OrganizationListPage',
  components: { OrganizationFormPage, OrganizationDetailPage, ListPageLayout, Edit, Delete, Tickets, Search, RefreshLeft, Plus },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    provide(ValidationI18nCacheKey, ref(new Set<string>()));
    const { t } = useI18n();
    const listPage = reactive(new OrganizationListPage(props, context)) as OrganizationListPage & { state: Record<string, unknown> };
    listPage.configureColumnVisibility(COLUMN_VISIBILITY_STORAGE_KEY, COLUMN_VISIBILITY_KEYS, DEFAULT_VISIBLE_COLUMN_KEYS);
    const state = listPage.state as Record<string, unknown>;
    const formVisible = computed(() => !!(state.addDialogVisible || state.editDialogVisible));
    const formRid = computed(() => (state.editDialogVisible ? String(state.rid ?? '') : ''));
    const hasFormEverOpened = ref(false);
    watch(formVisible, (v) => { if (v) hasFormEverOpened.value = true; }, { immediate: true });
    const currentFormMode = ref<'add' | 'edit'>('add');
    watch(() => state.addDialogVisible, (v) => { if (v) currentFormMode.value = 'add'; }, { immediate: true });
    watch(() => state.editDialogVisible, (v) => { if (v) currentFormMode.value = 'edit'; }, { immediate: true });
    function onFormClose(v: boolean) {
      if (!v) { state.addDialogVisible = false; state.editDialogVisible = false; }
    }
    function onFormResponse(payload: Record<string, unknown>) {
      (currentFormMode.value === 'add' ? listPage.afterAdd : listPage.afterEdit).call(listPage, payload);
    }
    const { listLayoutRefs, onTableWrapMounted: layoutOnTableWrapMounted } = useListPageLayout(listPage, {
    });
    const tableRef = ref<{ doLayout?: () => void } | null>(null);
    const {
      orderedColumnKeys,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
    } = useColumnOrderDrag(COLUMN_ORDER_STORAGE_KEY, ALL_COLUMN_KEYS);

    const RESERVED_WIDTH_LEFT = 39 + 50 + 120;
    const RESERVED_WIDTH_RIGHT = 120;
    const autoWidthColumns = computed(() =>
      orderedColumnKeys.value.map((key) => ({
        key,
        getLabel: () => t('organizationList.columns.' + (COLUMN_KEY_TO_I18N[key] ?? key)),
        sortable: false,
        getCellText:
          key === 'abbrName'
            ? (row: Record<string, unknown>) => String(row.abbrName ?? '')
            : key === 'orgTypeDictCode'
              ? (row: Record<string, unknown>) => formatOrgTypeLabel(row.orgTypeDictCode)
              : key === 'seqNo'
                ? (row: Record<string, unknown>) => String(row.seqNo ?? '')
                : key === 'createTime'
                  ? (row: Record<string, unknown>) => listPage.formatDate(row.createTime)
                  : () => '',
      }))
    );
    const tableDataRef = computed(() => (listPage.state as Record<string, unknown>).tableData as Array<Record<string, unknown>>);
    const { columnWidths, run: runColumnAutoWidth } = useTableColumnAutoWidth({
      containerRef: listLayoutRefs.tableWrapRef,
      columns: autoWidthColumns,
      tableData: tableDataRef,
      reservedWidthLeft: RESERVED_WIDTH_LEFT,
      reservedWidthRight: RESERVED_WIDTH_RIGHT,
    });
    function onTableWrapMounted() {
      layoutOnTableWrapMounted();
      nextTick(runColumnAutoWidth);
    }

    /** 组织类型列：transDict 可能返回 i18n key（含.）或原始 code；空则不再 t('') 避免 intlify 报错 */
    function formatOrgTypeLabel(code: string | null | undefined): string {
      const val = listPage.transDict('user', 'organization_type', code ?? '');
      if (!val) return '';
      return val.includes('.') ? t(val) : t('organization_type.' + val);
    }

    const visibleColumnKeys = computed<string[]>({
      get: () => (listPage.state.visibleColumnKeys as string[]) ?? [],
      set: (next) => listPage.applyVisibleColumns(next),
    });
    const columnVisibilityOptions = computed(() => [
      { key: INDEX_COLUMN_KEY, label: t('organizationList.columns.index') },
      ...orderedColumnKeys.value.map((key) => ({
        key,
        label: t('organizationList.columns.' + (COLUMN_KEY_TO_I18N[key] ?? key)),
      })),
    ]);
    function isColumnVisible(key: string): boolean {
      return listPage.isColumnVisible(key);
    }
    const showOperationColumn = computed(() => Boolean(listPage.state?.showOperationColumn));

    return {
      listPage,
      OPERATION_COLUMN_PINNED_STORAGE_KEY,
      formVisible,
      formRid,
      hasFormEverOpened,
      onFormClose,
      onFormResponse,
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      t,
      formatOrgTypeLabel,
      listLayoutRefs,
      tableRef,
      visibleColumnKeys,
      columnVisibilityOptions,
      isColumnVisible,
      columnWidths,
      orderedColumnKeys,
      columnDragKey,
      columnDropTargetKey,
      onHeaderDragStart,
      onHeaderDragOver,
      onHeaderDrop,
      onHeaderDragEnd,
      onTableDragOver,
      onTableDrop,
      showOperationColumn,
      onTableWrapMounted,
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style lang="css" scoped>
.organization-list-page {
  height: 100%;
}
.organization-list-page :deep(.list-page-card) {
  margin-top: 3px; /* 卡片上外边距 */
}
.organization-list-page .list-page-toolbar .toolbar-cascader {
  margin-right: 8px;
}
.organization-list-page .list-page-toolbar .toolbar-cascader .search-cascader-input {
  min-width: 140px;
}
.organization-list-page .list-page-toolbar .toolbar-extra {
  margin-right: 8px;
}

/* 列可见性配置：所有列选项单列竖排（与 AccountList 一致） */
.organization-list-page .column-visibility-checkboxes {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  gap: 6px;
}
.organization-list-page .column-visibility-checkboxes :deep(.el-checkbox) {
  margin-right: 0;
}

/* 非固定列表头可拖拽排序 */
.organization-list-page :deep(.column-header-draggable) {
  cursor: grab;
  user-select: none;
  width: 100%;
  display: inline-block;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}
.organization-list-page :deep(.column-header-draggable:active) {
  cursor: grabbing;
}
.organization-list-page :deep(.column-header-draggable.is-dragging) {
  opacity: 0.7;
  background-color: var(--el-fill-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.organization-list-page :deep(.column-header-draggable.is-drop-target) {
  background-color: var(--el-color-primary-light-9);
  box-shadow: inset 4px 0 0 var(--el-color-primary);
}
.organization-list-page :deep(th .cell:has(.column-header-draggable)) {
  font-size: 0;
}
.organization-list-page :deep(th .cell:has(.column-header-draggable) .column-header-draggable) {
  font-size: 14px;
}
</style>
