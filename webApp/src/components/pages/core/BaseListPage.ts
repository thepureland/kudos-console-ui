import { ElMessage, ElMessageBox } from "element-plus"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, getApiFailureMessage, isApiSuccessResponse, resolveApiFailureMessage } from "../../../utils/backendRequest"
import { ColumnVisibilitySupport } from "../list/ColumnVisibilitySupport"
import { i18n } from "../../../i18n"

export abstract class BaseListPage extends BasePage {
    private columnVisibilitySupport: ColumnVisibilitySupport | null = null
    private listStateStorageKey: string | null = null
    private tableMaxHeightFallback = 520
    private tableMaxHeightMin = 280
    private tableBottomSafeGap = 20
    private initialSearchParamsSnapshot: Record<string, unknown> | null = null
    private initialPaginationSnapshot: Record<string, unknown> | null = null
    private initialSortSnapshot: Record<string, unknown> | null = null

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.snapshotInitialListState()
    }

    private snapshotInitialListState(): void {
        if (this.state.searchParams) this.initialSearchParamsSnapshot = JSON.parse(JSON.stringify(this.state.searchParams))
        if (this.state.pagination) this.initialPaginationSnapshot = { ...this.state.pagination }
        if (this.state.sort) this.initialSortSnapshot = { ...this.state.sort }
    }

    public resetSearchAndTableOnLeave(): void {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        if (this.initialPaginationSnapshot && this.state.pagination) Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        if (this.initialSortSnapshot && this.state.sort) Object.assign(this.state.sort, this.initialSortSnapshot)
        this.state.tableData = []
    }

    protected initBaseState(): any {
        return {
            tableData: [],
            tableLayout: 'auto',
            tableMaxHeight: 520,
            columnVisibilityPanelVisible: false,
            visibleColumnKeys: [],
            sort: { orderProperty: '', orderDirection: '' },
            pagination: { total: 0, pageNo: 1, pageSize: 10 },
            addDialogVisible: false,
            editDialogVisible: false,
            detailDialogVisible: false,
            showOperationColumn: false,
            emptyShakeVersion: 0,
            rid: '',
            selectedItems: []
        }
    }

    protected createSearchParams(): any {
        const params = {}
        if (this.state.sort.orderProperty) {
            params["orders"] = [{ property: this.state.sort.orderProperty, direction: this.state.sort.orderDirection }]
        }
        if (this.state.pagination) {
            params["pageNo"] = this.state.pagination.pageNo
            params["pageSize"] = this.state.pagination.pageSize
        }
        const searchParams = this.state.searchParams
        if (searchParams) for (const paramName in searchParams) params[paramName] = searchParams[paramName]
        return params
    }

    protected getSearchUrl(): string { return this.getRootActionPath() + "/pagingSearch" }
    protected getDeleteUrl(): string { return this.getRootActionPath() + "/delete" }
    protected getBatchDeleteUrl(): string { return this.getRootActionPath() + "/batchDelete" }
    protected getDetailUrl(): string { return this.getRootActionPath() + "/getDetail" }
    protected getUpdateActiveUrl(): string { return this.getRootActionPath() + "/updateActive" }

    protected getSelectedIds(): Array<any> {
        const ids = []
        for (let row of this.state.selectedItems) ids.push(this.getRowId(row))
        return ids
    }
    protected createDeleteParams(row: any): any { return { id: this.getRowId(row) } }
    protected createBatchDeleteParams(): any { return this.getSelectedIds() }
    protected getDeleteMessage(_row: any): string { return i18n.global.t('listPage.deleteConfirm') as string }
    protected getBatchDeleteMessage(rows: Array<any>): string { return i18n.global.t('listPage.batchDeleteConfirm', { n: rows.length }) as string }
    protected tr(key: string, params?: Record<string, unknown>): string { return i18n.global.t(key, params ?? {}) as string }
    protected getRowId(row: any): string | number { return row.id }

    public search: () => void
    protected async doSearch() {
        const params = this.createSearchParams()
        if (!params) return
        const result = await backendRequest({url: this.getSearchUrl(), method: "post", params})
        const payload = getApiResponseData(result)
        const isSuccess = isApiSuccessResponse(result) ? this.isSearchPayload(payload) : this.isSearchPayload(result)
        if (isSuccess) {
            this.postSearchSuccessfully(isApiSuccessResponse(result) ? payload : result)
            if (Array.isArray(this.state.tableData) && this.state.tableData.length === 0) this.state.emptyShakeVersion = Number(this.state.emptyShakeVersion ?? 0) + 1
        } else {
            ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (i18n.global.t('listPage.queryFailed') as string))
        }
    }

    protected postSearchSuccessfully(data: any) {
        if (data && Array.isArray(data.data) && typeof data.totalCount === "number") {
            this.state.tableData = data.data
            this.state.pagination.total = data.totalCount
            return
        }
        this.state.tableData = Array.isArray(data) ? data : []
    }
    private isSearchPayload(data: unknown): boolean { return Array.isArray(data) || !!(data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) }

    public handleSizeChange: (newSize: number) => void
    protected doHandleSizeChange(newSize: number) { this.state.pagination.pageSize = newSize; this.search() }
    public handleCurrentChange: (newCurrent: number) => void
    protected doHandleCurrentChange(newCurrent: number) { if (newCurrent) { this.state.pagination.pageNo = newCurrent; this.search() } }
    public handleSelectionChange: (selection: any[]) => void
    protected doHandleSelectionChange(selection: any[]) { this.state.selectedItems = selection }
    public resetSearchFields: () => void
    protected doResetSearchFields() {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        if (this.initialPaginationSnapshot && this.state.pagination) Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        if (this.initialSortSnapshot && this.state.sort) Object.assign(this.state.sort, this.initialSortSnapshot)
    }
    public handleSortChange: (column: { prop?: string; order?: string }) => void
    protected doHandleSortChange(column: { prop?: string; order?: string }) {
        if (!column.order || !column.prop) {
            this.state.sort.orderProperty = ""; this.state.sort.orderDirection = ""; this.state.pagination.pageNo = 1; this.doSearch(); return
        }
        this.state.sort.orderProperty = column.prop
        this.state.sort.orderDirection = column.order == "ascending" ? "ASC" : "DESC"
        this.state.pagination.pageNo = 1
        this.doSearch()
    }
    public handleFilter: (value: any, row: any, column: any) => void
    protected doHandleFilter(value: any, row: any, column: any) { const property = column['property']; return row[property] === value }

    public parseBooleanFilterValue(value: unknown): boolean | null {
        if (value === undefined || value === null) return null
        if (typeof value === "boolean") return value
        const text = String(value).toLowerCase()
        if (text === "true") return true
        if (text === "false") return false
        return null
    }

    public configureColumnVisibility(storageKey: string, allowedKeys: string[], defaultVisibleKeys: string[] = allowedKeys) {
        this.columnVisibilitySupport = new ColumnVisibilitySupport(storageKey, allowedKeys, defaultVisibleKeys)
        this.state.visibleColumnKeys = this.columnVisibilitySupport.load()
        this.state.columnVisibilityPanelVisible = false
    }
    public configureListStatePersistence(storageKey: string | null) { this.listStateStorageKey = storageKey }
    public configureTableMaxHeight(fallback = 520, min = 280, safeGap = 20) {
        this.tableMaxHeightFallback = fallback
        this.tableMaxHeightMin = min
        this.tableBottomSafeGap = safeGap
        this.state.tableMaxHeight = fallback
    }
    private static readonly TABLE_HEADER_HEIGHT = 56
    private static readonly TABLE_ROW_HEIGHT_WITH_BORDER = 34
    private static readonly TABLE_HEIGHT_BUFFER = 164
    public updateTableMaxHeightByElements(tableWrapEl: HTMLElement | null, paginationEl: HTMLElement | null) {
        if (typeof window === "undefined") return
        if (!tableWrapEl) { this.state.tableMaxHeight = this.tableMaxHeightFallback; return }
        const paginationHeight = paginationEl?.offsetHeight ?? 0
        const top = tableWrapEl.getBoundingClientRect().top
        const byViewport = Math.floor(window.innerHeight - top - paginationHeight - this.tableBottomSafeGap)
        const byWrap = tableWrapEl.offsetHeight > 0 ? tableWrapEl.offsetHeight : 0
        const available = byWrap > 0 ? Math.max(byViewport, byWrap) : byViewport
        const rowCount = (this.state.tableData as any[])?.length ?? 0
        const contentHeight = BaseListPage.TABLE_HEADER_HEIGHT + rowCount * BaseListPage.TABLE_ROW_HEIGHT_WITH_BORDER + BaseListPage.TABLE_HEIGHT_BUFFER
        this.state.tableMaxHeight = Math.max(this.tableMaxHeightMin, Math.min(available, contentHeight))
    }
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
            if (searchParams && typeof searchParams === "object" && this.state.searchParams) Object.assign(this.state.searchParams, searchParams as Record<string, unknown>)
            if (sort && typeof sort === "object" && this.state.sort) Object.assign(this.state.sort, sort as Record<string, unknown>)
            if (pagination && typeof pagination === "object" && this.state.pagination) Object.assign(this.state.pagination, pagination as Record<string, unknown>)
            if (Array.isArray(tableData)) this.state.tableData = tableData
        } catch {}
    }
    public persistListState() {
        if (!this.listStateStorageKey || typeof window === "undefined") return
        const payload = { searchParams: { ...(this.state.searchParams || {}) }, sort: { ...(this.state.sort || {}) }, pagination: { ...(this.state.pagination || {}) }, tableData: Array.isArray(this.state.tableData) ? [...this.state.tableData] : [] }
        window.localStorage.setItem(this.listStateStorageKey, JSON.stringify(payload))
    }
    public isColumnVisible(columnKey: string): boolean {
        const keys = this.state.visibleColumnKeys as string[] | undefined
        if (!keys || keys.length === 0) return true
        return keys.includes(columnKey)
    }
    public toggleColumnVisibilityPanel: () => void
    protected doToggleColumnVisibilityPanel() { this.state.columnVisibilityPanelVisible = !this.state.columnVisibilityPanelVisible }
    public applyVisibleColumns(keys: string[]) {
        if (!this.columnVisibilitySupport) { this.state.visibleColumnKeys = keys; return }
        const next = this.columnVisibilitySupport.sanitize(keys)
        this.state.visibleColumnKeys = next
        this.columnVisibilitySupport.save(next)
    }
    public applyColumnVisibilityOutsideClick(target: EventTarget | null, panelEl: HTMLElement | null, toggleSelector = '.table-corner-fold.is-left') {
        if (!this.state.columnVisibilityPanelVisible || !this.columnVisibilitySupport) return
        if (!this.columnVisibilitySupport.shouldCloseOnOutsideClick(target, panelEl, toggleSelector)) return
        this.state.columnVisibilityPanelVisible = false
    }
    public createBooleanFilters(trueText: string, falseText: string): Array<{ text: string; value: boolean }> { return [{ text: trueText, value: true }, { text: falseText, value: false }] }
    public formatBoolean(value: unknown, trueText: string, falseText: string): string { return value ? trueText : falseText }
    public getFilteredValueForColumn(value: unknown): unknown[] { return value === null || value === undefined ? [] : [value] }
    public createBooleanFilterMapping(paramName: string): { paramName: string; parser: (value: unknown) => boolean | null; emptyValue: null } {
        return { paramName, parser: (value: unknown) => this.parseBooleanFilterValue(value), emptyValue: null }
    }
    public applyRemoteTableFilters(filters: Record<string, Array<string | number | boolean>>, mappings: Record<string, { paramName: string; parser?: (value: string | number | boolean | undefined) => unknown; emptyValue?: unknown }>) {
        const searchParams = this.state.searchParams
        if (!searchParams) return
        for (const filterKey in mappings) {
            const mapping = mappings[filterKey]
            const raw = filters[filterKey]?.[0]
            const parsed: unknown = raw === undefined ? (mapping.emptyValue !== undefined ? mapping.emptyValue : null) : (mapping.parser ? mapping.parser(raw) : raw)
            searchParams[mapping.paramName] = parsed
        }
        this.search()
    }

    public handleDelete: (row: any) => void
    protected async doHandleDelete(row: any) {
        const t = i18n.global.t.bind(i18n.global)
        const confirmResult = await ElMessageBox.confirm(this.getDeleteMessage(row), t('listPage.confirmTitle') as string, { confirmButtonText: t('listPage.confirmButton') as string, cancelButtonText: t('listPage.cancelButton') as string, type: 'warning' }).catch(err => err)
        if (confirmResult !== 'confirm') return
        const params = this.createDeleteParams(row)
        const result = await backendRequest({url: this.getDeleteUrl(), method: "delete", params: params})
        if (isApiSuccessResponse(result)) { ElMessage.success(t('listPage.deleteSuccess') as string); this.doAfterDelete([params["id"]]) }
        else ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
    }
    public multiDelete: () => void
    protected async doMultiDelete() {
        const t = i18n.global.t.bind(i18n.global)
        const rows = this.state.selectedItems
        if (!rows || rows.length == 0) { ElMessage.info(t('listPage.selectDataFirst') as string); return }
        const confirmResult = await ElMessageBox.confirm(this.getBatchDeleteMessage(rows), t('listPage.confirmTitle') as string, { confirmButtonText: t('listPage.confirmButton') as string, cancelButtonText: t('listPage.cancelButton') as string, type: 'warning' }).catch(err => err)
        if (confirmResult !== 'confirm') return
        const params = this.createBatchDeleteParams()
        const result = await backendRequest({url: this.getBatchDeleteUrl(), method: "post", params: params})
        if (isApiSuccessResponse(result)) { ElMessage.success(t('listPage.deleteSuccess') as string); this.doAfterDelete(this.getSelectedIds()) }
        else ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
    }

    public handleDetail: (row: any) => void
    protected doHandleDetail(row: any) { this.state.rid = this.getRowId(row); this.state.detailDialogVisible = true }
    public updateActive: (row: any) => void
    protected async doUpdateActive(row: any) {
        const params = { id: this.getRowId(row), active: row.active }
        const subSystemCode = row.subSystemCode ?? row.subSystemCode
        if (subSystemCode) params["subSystemCode"] = subSystemCode
        const result = await backendRequest({url: this.getUpdateActiveUrl(), method: 'put', params, paramsInQuery: true})
        if (!isApiSuccessResponse(result)) ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (i18n.global.t('listPage.updateActiveFailed') as string))
    }
    public handleEdit: (row: any) => void
    protected doHandleEdit(row: any) { this.state.rid = this.getRowId(row); this.state.editDialogVisible = true }
    public openAddDialog: () => void
    protected doOpenAddDialog() { this.state.addDialogVisible = true }
    public toggleOperationColumn: () => void
    protected doToggleOperationColumn() { this.state.showOperationColumn = !this.state.showOperationColumn }
    public afterAdd: (params: any) => void
    protected getAfterAddSearchParamKeys(): string[] { return [] }
    protected doAfterAdd(params: any) {
        const keys = this.getAfterAddSearchParamKeys()
        if (keys?.length && params && this.state.searchParams) {
            const sp = this.state.searchParams as Record<string, unknown>
            for (const k of keys) if (params[k] !== undefined && params[k] !== null) sp[k] = params[k]
        }
        this.search()
    }
    public afterEdit: (params: any) => void
    protected doAfterEdit(params: any) { this.doAfterAdd(params) }
    public afterDelete: (ids: Array<any>) => void
    protected doAfterDelete(ids: Array<any>) { this.search() }

    protected convertThis() {
        super.convertThis()
        this.handleSizeChange = (newSize: number) => this.doHandleSizeChange(newSize)
        this.handleCurrentChange = (newCurrent: number) => this.doHandleCurrentChange(newCurrent)
        this.search = () => this.doSearch()
        this.resetSearchFields = () => this.doResetSearchFields()
        this.handleSortChange = (column: { prop?: string; order?: string }) => this.doHandleSortChange(column)
        this.handleFilter = (value: any, row: any, column: any) => this.doHandleFilter(value, row, column)
        this.handleDelete = (row: any) => this.doHandleDelete(row)
        this.handleEdit = (row: any) => this.doHandleEdit(row)
        this.handleDetail = (row: any) => this.doHandleDetail(row)
        this.afterAdd = (params: any) => this.doAfterAdd(params)
        this.afterEdit = (params: any) => this.doAfterEdit(params)
        this.afterDelete = (ids: Array<any>) => this.doAfterDelete(ids)
        this.openAddDialog = () => this.doOpenAddDialog()
        this.toggleColumnVisibilityPanel = () => this.doToggleColumnVisibilityPanel()
        this.toggleOperationColumn = () => this.doToggleOperationColumn()
        this.multiDelete = () => this.doMultiDelete()
        this.updateActive = (row: any) => this.doUpdateActive(row)
        this.handleSelectionChange = (selection: any[]) => this.doHandleSelectionChange(selection)
    }
}
