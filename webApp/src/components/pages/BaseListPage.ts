import { ElMessage, ElMessageBox } from "element-plus"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from "../../utils/backendRequest"
import { ColumnVisibilitySupport } from "../widgets/ColumnVisibilitySupport"
import { i18n } from "../../i18n"

/**
 * 列表页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BaseListPage extends BasePage {

    // 列可见性能力按需启用，避免影响未接入页面
    private columnVisibilitySupport: ColumnVisibilitySupport | null = null
    // 列表状态持久化 key（由子页面配置；不配置则关闭后不保留查询结果）
    private listStateStorageKey: string | null = null
    private tableMaxHeightFallback = 520
    private tableMaxHeightMin = 280
    private tableBottomSafeGap = 20
    /** 初始搜索条件/分页/排序，用于关闭页面时重置（默认行为：不保留上次结果）；命名避免 _ 前缀以免被 setup return 暴露时触发 Vue 保留前缀警告 */
    private initialSearchParamsSnapshot: Record<string, unknown> | null = null
    private initialPaginationSnapshot: Record<string, unknown> | null = null
    private initialSortSnapshot: Record<string, unknown> | null = null

    /** @internal 子类通过 super(props, context) 调用 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.snapshotInitialListState()
    }

    /** 保存当前搜索条件、分页、排序为「初始状态」，离开页面时重置用 */
    private snapshotInitialListState(): void {
        if (this.state.searchParams) this.initialSearchParamsSnapshot = JSON.parse(JSON.stringify(this.state.searchParams))
        if (this.state.pagination) this.initialPaginationSnapshot = { ...this.state.pagination }
        if (this.state.sort) this.initialSortSnapshot = { ...this.state.sort }
    }

    /** 关闭/离开页面时重置搜索条件与表格数据（keep-alive 下由 useListPageLayout 的 onDeactivated 调用） */
    public resetSearchAndTableOnLeave(): void {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) {
            Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        }
        if (this.initialPaginationSnapshot && this.state.pagination) {
            Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        }
        if (this.initialSortSnapshot && this.state.sort) {
            Object.assign(this.state.sort, this.initialSortSnapshot)
        }
        this.state.tableData = []
    }

    /** 初始化列表页基础状态。 */
    protected initBaseState(): any {
        return {
            tableData: [],
            tableLayout: 'auto',
            tableMaxHeight: 520,
            columnVisibilityPanelVisible: false,
            visibleColumnKeys: [],
            sort: {
                orderProperty: '',
                orderDirection: ''
            },
            pagination: {
                total: 0,
                pageNo: 1,
                pageSize: 10
            },
            addDialogVisible: false,
            editDialogVisible: false,
            detailDialogVisible: false,
            showOperationColumn: false,
            rid: '',
            selectedItems: []
        }
    }

    /** 组装统一查询参数（排序、分页、搜索条件）。 */
    protected createSearchParams(): any {
        const params = {}
        if (this.state.sort.orderProperty) {
            params["orders"] = [{
                property: this.state.sort.orderProperty,
                direction: this.state.sort.orderDirection,
            }]
        }
        if (this.state.pagination) {
            params["pageNo"] = this.state.pagination.pageNo
            params["pageSize"] = this.state.pagination.pageSize
        }
        const searchParams = this.state.searchParams
        if (searchParams) {
            for (const paramName in searchParams) {
                params[paramName] = searchParams[paramName]
            }
        }
        return params
    }

    /** 获取列表查询接口地址。 */
    protected getSearchUrl(): string {
        return this.getRootActionPath() + "/pagingSearch"
    }

    /** 获取单条删除接口地址。 */
    protected getDeleteUrl(): string {
        return this.getRootActionPath() + "/delete"
    }

    /** 获取批量删除接口地址。 */
    protected getBatchDeleteUrl(): string {
        return this.getRootActionPath() + "/batchDelete"
    }

    /** 获取详情接口地址。 */
    protected getDetailUrl(): string {
        return this.getRootActionPath() + "/getDetail"
    }

    /** 获取启用状态更新接口地址。 */
    protected getUpdateActiveUrl(): string {
        return this.getRootActionPath() + "/updateActive"
    }

    /** 从当前选中行中提取主键列表。 */
    protected getSelectedIds(): Array<any> {
        const ids = []
        for (let row of this.state.selectedItems) {
            ids.push(this.getRowId(row))
        }
        return ids
    }

    /** 生成单条删除请求参数。 */
    protected createDeleteParams(row: any): any {
        return {
            id: this.getRowId(row)
        }
    }

    /** 生成批量删除请求参数。 */
    protected createBatchDeleteParams(): any {
        return this.getSelectedIds()
    }

    /** 获取单条删除确认文案。 */
    protected getDeleteMessage(_row: any): string {
        return i18n.global.t('listPage.deleteConfirm') as string
    }

    /** 获取批量删除确认文案。 */
    protected getBatchDeleteMessage(rows: Array<any>): string {
        return i18n.global.t('listPage.batchDeleteConfirm', { n: rows.length }) as string
    }

    /** 获取数据行主键，默认取 row.id。 */
    protected getRowId(row: any): string | number {
        return row.id
    }

    public search: () => void

    /** 发起远程查询并分发结果处理。 */
    protected async doSearch() {
        const params = this.createSearchParams()
        if (!params) {
            return
        }

        const result = await backendRequest({url: this.getSearchUrl(), method: "post", params})
        const payload = getApiResponseData(result)
        const isSuccess = isApiSuccessResponse(result)
            ? this.isSearchPayload(payload)
            : this.isSearchPayload(result)
        if (isSuccess) {
            this.postSearchSuccessfully(isApiSuccessResponse(result) ? payload : result)
        } else {
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (i18n.global.t('listPage.queryFailed') as string))
        }
    }

    /** 处理查询成功后的列表与分页数据。结构：{ data: 行数组, totalCount: 总条数 } */
    protected postSearchSuccessfully(data: any) {
        if (data && Array.isArray(data.data) && typeof data.totalCount === "number") {
            this.state.tableData = data.data
            this.state.pagination.total = data.totalCount
            return
        }
        this.state.tableData = Array.isArray(data) ? data : []
    }

    private isSearchPayload(data: unknown): boolean {
        if (Array.isArray(data)) return true
        return !!(data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data))
    }

    public handleSizeChange: (newSize: number) => void

    /** 处理分页大小变更并重新查询。 */
    protected doHandleSizeChange(newSize: number) {
        this.state.pagination.pageSize = newSize
        this.search()
    }

    public handleCurrentChange: (newCurrent: number) => void

    /** 处理页码变更并重新查询。 */
    protected doHandleCurrentChange(newCurrent: number) {
        if (newCurrent) {
            this.state.pagination.pageNo = newCurrent
            this.search()
        }
    }

    public handleSelectionChange: (selection: any[]) => void

    /** 同步表格勾选行。 */
    protected doHandleSelectionChange(selection: any[]) {
        this.state.selectedItems = selection
    }

    public resetSearchFields: () => void

    /** 重置搜索条件并回到第一页：恢复为初始状态（与离开页面时一致）。 */
    protected doResetSearchFields() {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) {
            Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        }
        if (this.initialPaginationSnapshot && this.state.pagination) {
            Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        }
        if (this.initialSortSnapshot && this.state.sort) {
            Object.assign(this.state.sort, this.initialSortSnapshot)
        }
    }

    public handleSortChange: (column: { prop?: string; order?: string }) => void

    /** 处理列排序变化（含取消排序）。 */
    protected doHandleSortChange(column: { prop?: string; order?: string }) {
        if (!column.order || !column.prop) {
            this.state.sort.orderProperty = ""
            this.state.sort.orderDirection = ""
            this.state.pagination.pageNo = 1
            this.doSearch()
            return
        }
        this.state.sort.orderProperty = column.prop
        this.state.sort.orderDirection = column.order == "ascending" ? "ASC" : "DESC"
        this.state.pagination.pageNo = 1
        this.doSearch()
    }

    public handleFilter: (value: any, row: any, column: any) => void

    /** 默认本地过滤器：严格等值比较。 */
    protected doHandleFilter(value: any, row: any, column: any) {
        const property = column['property']
        return row[property] === value
    }

    /** 解析布尔筛选值，无法识别时返回 null。 */
    public parseBooleanFilterValue(value: unknown): boolean | null {
        if (value === undefined || value === null) return null
        if (typeof value === "boolean") return value
        const text = String(value).toLowerCase()
        if (text === "true") return true
        if (text === "false") return false
        return null
    }

    /** 配置列可见性能力并恢复本地保存。 */
    public configureColumnVisibility(storageKey: string, allowedKeys: string[], defaultVisibleKeys: string[] = allowedKeys) {
        this.columnVisibilitySupport = new ColumnVisibilitySupport(storageKey, allowedKeys, defaultVisibleKeys)
        this.state.visibleColumnKeys = this.columnVisibilitySupport.load()
        this.state.columnVisibilityPanelVisible = false
    }

    /** 配置列表状态持久化存储 key；传 null 则不持久化（关闭后不保留查询结果）。 */
    public configureListStatePersistence(storageKey: string | null) {
        this.listStateStorageKey = storageKey
    }

    // 用于“表格内部滚动 + 分页可见”的高度上限参数
    /** 配置表格最大高度计算参数。 */
    public configureTableMaxHeight(fallback = 520, min = 280, safeGap = 20) {
        this.tableMaxHeightFallback = fallback
        this.tableMaxHeightMin = min
        this.tableBottomSafeGap = safeGap
        this.state.tableMaxHeight = fallback
    }

    /** 表头约高（px），用于“按行数推算内容高度”（含边框/内边距）。 */
    private static readonly TABLE_HEADER_HEIGHT = 56
    /** 单行行高（px），与列表页 .el-table__row 一致；含行线/边框余量。 */
    private static readonly TABLE_ROW_HEIGHT_WITH_BORDER = 34
    /** 表格边框、内边距、滚动条等额外高度（px）；略大以保证 10 行时最后一行底部不被裁掉。 */
    private static readonly TABLE_HEIGHT_BUFFER = 164

    /** 根据表格容器与分页元素计算可用最大高度；并随当前页行数增加而增高（在可用空间内）。 */
    public updateTableMaxHeightByElements(
        tableWrapEl: HTMLElement | null,
        paginationEl: HTMLElement | null
    ) {
        if (typeof window === "undefined") return
        if (!tableWrapEl) {
            this.state.tableMaxHeight = this.tableMaxHeightFallback
            return
        }
        const paginationHeight = paginationEl?.offsetHeight ?? 0
        const top = tableWrapEl.getBoundingClientRect().top
        const byViewport = Math.floor(window.innerHeight - top - paginationHeight - this.tableBottomSafeGap)
        const byWrap = tableWrapEl.offsetHeight > 0 ? tableWrapEl.offsetHeight : 0
        const available = byWrap > 0 ? Math.max(byViewport, byWrap) : byViewport
        const rowCount = (this.state.tableData as any[])?.length ?? 0
        const contentHeight = BaseListPage.TABLE_HEADER_HEIGHT + rowCount * BaseListPage.TABLE_ROW_HEIGHT_WITH_BORDER + BaseListPage.TABLE_HEIGHT_BUFFER
        this.state.tableMaxHeight = Math.max(this.tableMaxHeightMin, Math.min(available, contentHeight))
    }

    /** 从本地存储恢复列表查询态。 */
    public restorePersistedListState() {
        if (!this.listStateStorageKey || typeof window === "undefined") return
        const raw = window.localStorage.getItem(this.listStateStorageKey)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const searchParams = parsed["searchParams"]
            const sort = parsed["sort"]
            const pagination = parsed["pagination"]
            const tableData = parsed["tableData"]
            if (searchParams && typeof searchParams === "object" && this.state.searchParams) {
                Object.assign(this.state.searchParams, searchParams as Record<string, unknown>)
            }
            if (sort && typeof sort === "object" && this.state.sort) {
                Object.assign(this.state.sort, sort as Record<string, unknown>)
            }
            if (pagination && typeof pagination === "object" && this.state.pagination) {
                Object.assign(this.state.pagination, pagination as Record<string, unknown>)
            }
            if (Array.isArray(tableData)) {
                this.state.tableData = tableData
            }
        } catch {
            // ignore invalid local storage
        }
    }

    /** 将当前列表查询态持久化到本地。不持久化表格列宽（列宽统一不持久化）。 */
    public persistListState() {
        if (!this.listStateStorageKey || typeof window === "undefined") return
        // 仅持久化列表查询态，避免把弹窗等瞬时 UI 状态写入本地；列宽不写入
        const payload = {
            searchParams: { ...(this.state.searchParams || {}) },
            sort: { ...(this.state.sort || {}) },
            pagination: { ...(this.state.pagination || {}) },
            tableData: Array.isArray(this.state.tableData) ? [...this.state.tableData] : [],
        }
        window.localStorage.setItem(this.listStateStorageKey, JSON.stringify(payload))
    }

    /** 判断指定列当前是否可见。 */
    public isColumnVisible(columnKey: string): boolean {
        const keys = this.state.visibleColumnKeys as string[] | undefined
        if (!keys || keys.length === 0) return true
        return keys.includes(columnKey)
    }

    public toggleColumnVisibilityPanel: () => void

    /** 切换列可见性面板显隐。 */
    protected doToggleColumnVisibilityPanel() {
        this.state.columnVisibilityPanelVisible = !this.state.columnVisibilityPanelVisible
    }

    /** 应用并保存列可见 key 集合。 */
    public applyVisibleColumns(keys: string[]) {
        if (!this.columnVisibilitySupport) {
            this.state.visibleColumnKeys = keys
            return
        }
        const next = this.columnVisibilitySupport.sanitize(keys)
        this.state.visibleColumnKeys = next
        this.columnVisibilitySupport.save(next)
    }

    /** 处理列可见性面板的点击外部关闭逻辑。 */
    public applyColumnVisibilityOutsideClick(
        target: EventTarget | null,
        panelEl: HTMLElement | null,
        toggleSelector = '.table-corner-fold.is-left'
    ) {
        if (!this.state.columnVisibilityPanelVisible) return
        if (!this.columnVisibilitySupport) return
        if (!this.columnVisibilitySupport.shouldCloseOnOutsideClick(target, panelEl, toggleSelector)) return
        this.state.columnVisibilityPanelVisible = false
    }

    /** 生成布尔筛选项（是/否）。 */
    public createBooleanFilters(trueText: string, falseText: string): Array<{ text: string; value: boolean }> {
        return [
            { text: trueText, value: true },
            { text: falseText, value: false },
        ]
    }

    /** 将布尔值格式化为指定文案。 */
    public formatBoolean(value: unknown, trueText: string, falseText: string): string {
        return value ? trueText : falseText
    }

    /** 用于 el-table :filtered-value：null/undefined 转为 []，否则 [value]，供列表页表头筛选绑定。 */
    public getFilteredValueForColumn(value: unknown): unknown[] {
        return value === null || value === undefined ? [] : [value]
    }

    /** 生成布尔列的表头筛选映射项，供 applyRemoteTableFilters 使用。 */
    public createBooleanFilterMapping(paramName: string): {
        paramName: string
        parser: (value: unknown) => boolean | null
        emptyValue: null
    } {
        return {
            paramName,
            parser: (value: unknown) => this.parseBooleanFilterValue(value),
            emptyValue: null
        }
    }

    /** 将表头筛选变更映射到远程查询参数并触发查询。 */
    public applyRemoteTableFilters(
        filters: Record<string, Array<string | number | boolean>>,
        mappings: Record<
            string,
            {
                paramName: string
                parser?: (value: string | number | boolean | undefined) => unknown
                emptyValue?: unknown
            }
        >
    ) {
        const searchParams = this.state.searchParams
        if (!searchParams) return
        // 统一把列头 filter 映射为后端查询参数，避免每个页面重复写分发逻辑
        for (const filterKey in mappings) {
            const mapping = mappings[filterKey]
            const raw = filters[filterKey]?.[0]
            let parsed: unknown
            if (raw === undefined) {
                parsed = mapping.emptyValue !== undefined ? mapping.emptyValue : null
            } else {
                parsed = mapping.parser ? mapping.parser(raw) : raw
            }
            searchParams[mapping.paramName] = parsed
        }
        this.search()
    }

    public handleDelete: (row: any) => void

    /** 处理单条删除（含确认与结果提示）。 */
    protected async doHandleDelete(row: any) {
        const t = i18n.global.t.bind(i18n.global)
        const confirmResult = await ElMessageBox.confirm(this.getDeleteMessage(row), t('listPage.confirmTitle') as string, {
            confirmButtonText: t('listPage.confirmButton') as string,
            cancelButtonText: t('listPage.cancelButton') as string,
            type: 'warning'
        }).catch(err => err)
        if (confirmResult !== 'confirm') {
            return
        }
        const params = this.createDeleteParams(row)
        const result = await backendRequest({url: this.getDeleteUrl(), method: "delete", params: params})
        if (isApiSuccessResponse(result) || result === true || result?.data === true) {
            ElMessage.success(t('listPage.deleteSuccess') as string)
            this.doAfterDelete([params["id"]])
        } else {
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
        }
    }

    public multiDelete: () => void

    /** 处理批量删除（含确认与结果提示）。 */
    protected async doMultiDelete() {
        const t = i18n.global.t.bind(i18n.global)
        const rows = this.state.selectedItems
        if (!rows || rows.length == 0) {
            ElMessage.info(t('listPage.selectDataFirst') as string)
        } else {
            const confirmResult = await ElMessageBox.confirm(this.getBatchDeleteMessage(rows), t('listPage.confirmTitle') as string, {
                confirmButtonText: t('listPage.confirmButton') as string,
                cancelButtonText: t('listPage.cancelButton') as string,
                type: 'warning'
            }).catch(err => err)
            if (confirmResult !== 'confirm') {
                return
            }
            const params = this.createBatchDeleteParams()
            const result = await backendRequest({url: this.getBatchDeleteUrl(), method: "post", params: params})
            if (isApiSuccessResponse(result) || result === true || result?.data === true) {
                ElMessage.success(t('listPage.deleteSuccess') as string)
                this.doAfterDelete(this.getSelectedIds())
            } else {
                ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
            }
        }
    }

    public handleDetail: (row: any) => void

    /** 打开详情弹窗。先设置 rid 再打开，保证详情组件拿到当前行 id。 */
    protected doHandleDetail(row: any) {
        this.state.rid = this.getRowId(row)
        this.state.detailDialogVisible = true
    }

    public updateActive: (row: any) => void

    /** 更新启用状态。 */
    protected async doUpdateActive(row: any) {
        const params = {
            id: this.getRowId(row),
            active: row.active
        }
        const subSystemCode = row.subSystemCode ?? row.subSystemCode
        if (subSystemCode) {
            params["subSystemCode"] = subSystemCode
        }
        const result = await backendRequest({url: this.getUpdateActiveUrl(), method: 'put', params, paramsInQuery: true})
        if (!(isApiSuccessResponse(result) || result === true || result?.data === true)) {
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (i18n.global.t('listPage.updateActiveFailed') as string))
        }
    }

    public handleEdit: (row: any) => void

    /** 打开编辑弹窗。先设置 rid 再打开，确保弹窗拿到当前行 id。 */
    protected doHandleEdit(row: any) {
        this.state.rid = this.getRowId(row)
        this.state.editDialogVisible = true
    }

    public openAddDialog: () => void

    /** 打开新增弹窗。 */
    protected doOpenAddDialog() {
        this.state.addDialogVisible = true
    }

    public toggleOperationColumn: () => void

    /** 切换操作列显示状态。 */
    protected doToggleOperationColumn() {
        this.state.showOperationColumn = !this.state.showOperationColumn
    }

    public afterAdd: (params: any) => void

    /**
     * 子类可覆盖：新增成功后需要从保存结果回填到 searchParams 的字段名列表（与 params 的 key 一致）。
     * 返回空数组则不回填任何字段，仅刷新列表。
     */
    protected getAfterAddSearchParamKeys(): string[] {
        return []
    }

    /** 新增成功后的默认回调：按 getAfterAddSearchParamKeys 回填搜索条件后重新查询列表。 */
    protected doAfterAdd(params: any) {
        const keys = this.getAfterAddSearchParamKeys()
        if (keys?.length && params && this.state.searchParams) {
            const sp = this.state.searchParams as Record<string, unknown>
            for (const k of keys) {
                if (params[k] !== undefined && params[k] !== null) sp[k] = params[k]
            }
        }
        this.search()
    }

    public afterEdit: (params: any) => void

    /** 编辑成功后的默认回调：与新增一致，按 getAfterAddSearchParamKeys 回填搜索条件后重新查询列表，以查出刚编辑的那条数据。 */
    protected doAfterEdit(params: any) {
        this.doAfterAdd(params)
    }

    public afterDelete: (ids: Array<any>) => void

    /** 删除成功后的默认回调：重新查询。 */
    protected doAfterDelete(ids: Array<any>) {
        this.search()
    }

    /** 绑定 this 与对外可调用方法，避免上下文丢失。 */
    protected convertThis() {
        super.convertThis()
        this.handleSizeChange = (newSize: number) => {
            this.doHandleSizeChange(newSize)
        }
        this.handleCurrentChange = (newCurrent: number) => {
            this.doHandleCurrentChange(newCurrent)
        }
        this.search = () => {
            this.doSearch()
        }
        this.resetSearchFields = () => {
            this.doResetSearchFields()
        }
        this.handleSortChange = (column: { prop?: string; order?: string }) => {
            this.doHandleSortChange(column)
        }
        this.handleFilter = (value: any, row: any, column: any) => {
            this.doHandleFilter(value, row, column)
        }
        this.handleDelete = (row: any) => {
            this.doHandleDelete(row)
        }
        this.handleEdit = (row: any) => {
            this.doHandleEdit(row)
        }
        this.handleDetail = (row: any) => {
            this.doHandleDetail(row)
        }
        this.afterAdd = (params: any) => {
            this.doAfterAdd(params)
        }
        this.afterEdit = (params: any) => {
            this.doAfterEdit(params)
        }
        this.afterDelete = (ids: Array<any>) => {
            this.doAfterDelete(ids)
        }
        this.openAddDialog = () => {
            this.doOpenAddDialog()
        }
        this.toggleColumnVisibilityPanel = () => {
            this.doToggleColumnVisibilityPanel()
        }
        this.toggleOperationColumn = () => {
            this.doToggleOperationColumn()
        }
        this.multiDelete = () => {
            this.doMultiDelete()
        }
        this.updateActive = (row: any) => {
            this.doUpdateActive(row)
        }
        this.handleSelectionChange = (selection: any[]) => {
            this.doHandleSelectionChange(selection)
        }
    }

}
