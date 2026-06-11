import { ElMessage, ElMessageBox } from "element-plus"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, getApiFailureMessage, isApiSuccessResponse, resolveApiFailureMessage } from "../../../utils/backendRequest"
import { ColumnVisibilitySupport } from "../list/ColumnVisibilitySupport"
import { tGlobal } from "../../../i18n"

/**
 * Abstract base class for list pages.
 *
 * Provides standard CRUD operations (search, delete, batch-delete, edit, add, detail),
 * pagination/sort state management, column visibility persistence, dynamic table max-height
 * calculation, and optional full list-state persistence in localStorage.
 *
 * Subclasses must implement `getRootActionPath()` (from BasePage) and `initState()`, and
 * should call `convertThis()` via `super.convertThis()` to bind public handler stubs.
 *
 * @see BasePage
 */
export abstract class BaseListPage extends BasePage {
    /** Manages which columns are visible and persists the choice in localStorage. */
    private columnVisibilitySupport: ColumnVisibilitySupport | null = null
    /** localStorage key for full list-state persistence (null = disabled). */
    private listStateStorageKey: string | null = null
    /** Fallback table max-height (px) when the element-based calculation is unavailable. */
    private tableMaxHeightFallback = 520
    /** Minimum table max-height (px) to prevent the table from becoming too small. */
    private tableMaxHeightMin = 280
    /** Bottom safe-gap (px) subtracted from the viewport height during max-height calculation. */
    private tableBottomSafeGap = 20
    /** Deep-clone of searchParams taken at construction, used to restore state on reset/leave. */
    private initialSearchParamsSnapshot: Record<string, unknown> | null = null
    /** Shallow clone of pagination taken at construction, used to restore state on reset/leave. */
    private initialPaginationSnapshot: Record<string, unknown> | null = null
    /** Shallow clone of sort taken at construction, used to restore state on reset/leave. */
    private initialSortSnapshot: Record<string, unknown> | null = null

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.snapshotInitialListState()
    }

    /**
     * Captures the initial list state (searchParams deep-cloned, pagination and sort
     * shallow-cloned) so it can be restored by resetSearchAndTableOnLeave / doResetSearchFields.
     */
    private snapshotInitialListState(): void {
        if (this.state.searchParams) this.initialSearchParamsSnapshot = JSON.parse(JSON.stringify(this.state.searchParams))
        if (this.state.pagination) this.initialPaginationSnapshot = { ...this.state.pagination }
        if (this.state.sort) this.initialSortSnapshot = { ...this.state.sort }
    }

    /**
     * Resets search params, pagination, and sort to their initial values and clears table data.
     * Intended to be called from a route `beforeRouteLeave` guard so the list re-fetches fresh
     * data the next time the page is entered.
     */
    public resetSearchAndTableOnLeave(): void {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        if (this.initialPaginationSnapshot && this.state.pagination) Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        if (this.initialSortSnapshot && this.state.sort) Object.assign(this.state.sort, this.initialSortSnapshot)
        this.state.tableData = []
    }

    /** Returns the default reactive state shared by all list pages. Merged with initState() output. */
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
            /** Incremented when a search returns 0 results, used to trigger the empty-state shake animation. */
            emptyShakeVersion: 0,
            /** Row id currently open in edit/detail dialog. */
            rid: '',
            selectedItems: []
        }
    }

    /**
     * Builds the request payload for pagingSearch, merging sort, pagination, and any
     * page-specific searchParams into a single flat object.
     */
    protected createSearchParams(): any {
        const params: Record<string, any> = {}
        if (this.state.sort.orderProperty) {
            params["orders"] = [{ property: this.state.sort.orderProperty, direction: this.state.sort.orderDirection }]
        }
        if (this.state.pagination) {
            params["pageNo"] = this.state.pagination.pageNo
            params["pageSize"] = this.state.pagination.pageSize
        }
        // Spread any page-specific filter fields on top of pagination/sort params.
        const searchParams = this.state.searchParams
        if (searchParams) for (const paramName in searchParams) params[paramName] = searchParams[paramName]
        return params
    }

    // --- URL helpers — subclasses may override to point at non-standard endpoints. ---
    protected getSearchUrl(): string { return this.getRootActionPath() + "/pagingSearch" }
    protected getDeleteUrl(): string { return this.getRootActionPath() + "/delete" }
    protected getBatchDeleteUrl(): string { return this.getRootActionPath() + "/batchDelete" }
    protected getDetailUrl(): string { return this.getRootActionPath() + "/getDetail" }
    protected getUpdateActiveUrl(): string { return this.getRootActionPath() + "/updateActive" }

    /** Returns the IDs of all currently selected table rows. */
    protected getSelectedIds(): Array<any> {
        return (this.state.selectedItems as any[]).map((row) => this.getRowId(row))
    }
    protected createDeleteParams(row: any): any { return { id: this.getRowId(row) } }
    /** By default, batch-delete sends the array of selected IDs as the request body. */
    protected createBatchDeleteParams(): any { return this.getSelectedIds() }
    protected getDeleteMessage(_row: any): string { return tGlobal('listPage.deleteConfirm') }
    protected getBatchDeleteMessage(rows: Array<any>): string { return tGlobal('listPage.batchDeleteConfirm', { n: rows.length }) }
    /** Convenience wrapper around tGlobal for use inside subclasses. */
    protected tr(key: string, params?: Record<string, any>): string { return tGlobal(key, params ?? {}) }
    /** Returns the unique identifier for a row. Override when the primary key field is not `id`. */
    protected getRowId(row: any): string | number { return row.id }

    /** Public stub bound to doSearch() in convertThis(). Call this to trigger a pagingSearch. */
    public search!: () => void
    /** Monotonic id of the most recent search request, used to discard stale responses. */
    private searchSequence = 0
    protected async doSearch() {
        const params = this.createSearchParams()
        if (!params) return
        const seq = ++this.searchSequence
        const result = await backendRequest({url: this.getSearchUrl(), method: "post", params})
        // A newer search was issued while this one was in flight — drop the stale response
        // so rapid filter/pagination changes never show outdated rows.
        if (seq !== this.searchSequence) return
        // Unwrap the standard API envelope when present; fall back to the raw result for
        // legacy endpoints that return a plain array/page-object at the top level.
        const apiSuccess = isApiSuccessResponse(result)
        const payload = apiSuccess ? getApiResponseData(result) : result
        if (this.isSearchPayload(payload)) {
            this.postSearchSuccessfully(payload)
            // Trigger empty-state shake animation when the search returns no rows.
            if (Array.isArray(this.state.tableData) && this.state.tableData.length === 0) this.state.emptyShakeVersion = Number(this.state.emptyShakeVersion ?? 0) + 1
        } else {
            ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || tGlobal('listPage.queryFailed'))
        }
    }

    /**
     * Applies a successful search result to reactive state.
     * Supports two response shapes:
     *   - Page object: `{ data: T[], totalCount: number }` — updates pagination total.
     *   - Plain array: `T[]` — used by endpoints that do not paginate.
     */
    protected postSearchSuccessfully(data: any) {
        if (data && Array.isArray(data.data) && typeof data.totalCount === "number") {
            // The current page is past the last page (e.g. the only row on the last page was
            // deleted, or a narrower filter shrank the result set) — step back to the last
            // non-empty page and re-fetch instead of showing an empty page.
            const pagination = this.state.pagination
            if (data.data.length === 0 && data.totalCount > 0 && pagination && Number(pagination.pageNo) > 1) {
                const lastPage = Math.max(1, Math.ceil(data.totalCount / Number(pagination.pageSize || 10)))
                if (lastPage < Number(pagination.pageNo)) {
                    pagination.pageNo = lastPage
                    pagination.total = data.totalCount
                    this.doSearch()
                    return
                }
            }
            this.state.tableData = data.data
            this.state.pagination.total = data.totalCount
            return
        }
        this.state.tableData = Array.isArray(data) ? data : []
    }
    /** Returns true when `data` looks like a valid search payload (plain array or page-object). */
    private isSearchPayload(data: unknown): boolean { return Array.isArray(data) || !!(data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) }

    /** Handles El-Table page-size change: updates pageSize and re-fetches. */
    public handleSizeChange!: (newSize: number) => void
    protected doHandleSizeChange(newSize: number) { this.state.pagination.pageSize = newSize; this.search() }
    /** Handles El-Table current-page change: updates pageNo and re-fetches. */
    public handleCurrentChange!: (newCurrent: number) => void
    protected doHandleCurrentChange(newCurrent: number) { if (newCurrent) { this.state.pagination.pageNo = newCurrent; this.search() } }
    /** Syncs selected table rows into state.selectedItems. */
    public handleSelectionChange!: (selection: any[]) => void
    protected doHandleSelectionChange(selection: any[]) { this.state.selectedItems = selection }
    /** Resets search fields, pagination, and sort order to their initial (construction-time) values. */
    public resetSearchFields!: () => void
    protected doResetSearchFields() {
        if (this.initialSearchParamsSnapshot && this.state.searchParams) Object.assign(this.state.searchParams, this.initialSearchParamsSnapshot)
        if (this.initialPaginationSnapshot && this.state.pagination) Object.assign(this.state.pagination, this.initialPaginationSnapshot)
        if (this.initialSortSnapshot && this.state.sort) Object.assign(this.state.sort, this.initialSortSnapshot)
    }
    /** Handles El-Table sort-change event, translating Element Plus sort state to backend order params. */
    public handleSortChange!: (column: { prop?: string; order?: string }) => void
    protected doHandleSortChange(column: { prop?: string; order?: string }) {
        if (!column.order || !column.prop) {
            // No sort active — clear order fields and return to page 1.
            this.state.sort.orderProperty = ""; this.state.sort.orderDirection = ""; this.state.pagination.pageNo = 1; this.doSearch(); return
        }
        this.state.sort.orderProperty = column.prop
        // Element Plus uses "ascending"/"descending"; backend expects "ASC"/"DESC".
        this.state.sort.orderDirection = column.order == "ascending" ? "ASC" : "DESC"
        this.state.pagination.pageNo = 1
        this.doSearch()
    }
    /** Client-side column filter handler for El-Table (used with local filter mode). */
    public handleFilter!: (value: any, row: any, column: any) => void
    protected doHandleFilter(value: any, row: any, column: any) { const property = column['property']; return row[property] === value }

    /**
     * Parses a filter cell value (which may be a boolean, string "true"/"false", or null/undefined)
     * into a boolean for use with remote-filter boolean params. Returns null when the value is absent
     * or unrecognisable, signalling that the filter should be cleared.
     */
    public parseBooleanFilterValue(value: unknown): boolean | null {
        if (value === undefined || value === null) return null
        if (typeof value === "boolean") return value
        const text = String(value).toLowerCase()
        if (text === "true") return true
        if (text === "false") return false
        return null
    }

    /**
     * Initialises column visibility support backed by localStorage.
     * Call this from `setup()` or `onMounted()` before the table is rendered.
     *
     * @param storageKey      localStorage key for persisting the visible column set.
     * @param allowedKeys     All column keys that can appear in the visibility picker.
     * @param defaultVisibleKeys  Keys visible when no persisted preference exists (defaults to all allowed keys).
     */
    public configureColumnVisibility(storageKey: string, allowedKeys: string[], defaultVisibleKeys: string[] = allowedKeys) {
        this.columnVisibilitySupport = new ColumnVisibilitySupport(storageKey, allowedKeys, defaultVisibleKeys)
        this.state.visibleColumnKeys = this.columnVisibilitySupport.load()
        this.state.columnVisibilityPanelVisible = false
    }
    /**
     * Enables (or disables with null) full list-state persistence in localStorage.
     * When enabled, call restorePersistedListState() on mount and persistListState() on leave.
     */
    public configureListStatePersistence(storageKey: string | null) { this.listStateStorageKey = storageKey }
    /**
     * Overrides the default table max-height parameters.
     * Must be called before the first updateTableMaxHeightByElements() call.
     */
    public configureTableMaxHeight(fallback = 520, min = 280, safeGap = 20) {
        this.tableMaxHeightFallback = fallback
        this.tableMaxHeightMin = min
        this.tableBottomSafeGap = safeGap
        this.state.tableMaxHeight = fallback
    }
    // Constants used in updateTableMaxHeightByElements content-height estimation.
    private static readonly TABLE_HEADER_HEIGHT = 56
    private static readonly TABLE_ROW_HEIGHT_WITH_BORDER = 34
    private static readonly TABLE_HEIGHT_BUFFER = 164
    /**
     * Dynamically computes and sets tableMaxHeight based on:
     *   - The remaining viewport height below the table wrapper element.
     *   - The estimated content height (header + rows + buffer).
     * The final value is clamped to [tableMaxHeightMin, available].
     * Call this after each search or on window resize.
     */
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
    /**
     * Reads the persisted list state from localStorage and merges it into the current state.
     * No-op when listStateStorageKey is not configured or in a non-browser environment.
     */
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
        } catch {
            // Silently ignore malformed localStorage data.
        }
    }
    /**
     * Serialises searchParams, sort, pagination, and tableData to localStorage.
     * Call this from a route `beforeRouteLeave` guard when list-state persistence is enabled.
     */
    public persistListState() {
        if (!this.listStateStorageKey || typeof window === "undefined") return
        const payload = {
            searchParams: { ...(this.state.searchParams || {}) },
            sort: { ...(this.state.sort || {}) },
            pagination: { ...(this.state.pagination || {}) },
            tableData: Array.isArray(this.state.tableData) ? [...this.state.tableData] : []
        }
        window.localStorage.setItem(this.listStateStorageKey, JSON.stringify(payload))
    }
    /**
     * Returns true when the given column key should be rendered.
     * Always returns true when no column visibility configuration is active.
     */
    public isColumnVisible(columnKey: string): boolean {
        const keys = this.state.visibleColumnKeys as string[] | undefined
        if (!keys || keys.length === 0) return true
        return keys.includes(columnKey)
    }
    /** Toggles the column-visibility picker panel open/closed. */
    public toggleColumnVisibilityPanel!: () => void
    protected doToggleColumnVisibilityPanel() { this.state.columnVisibilityPanelVisible = !this.state.columnVisibilityPanelVisible }
    /** Applies and persists a new set of visible column keys, sanitising against the allowed set. */
    public applyVisibleColumns(keys: string[]) {
        if (!this.columnVisibilitySupport) { this.state.visibleColumnKeys = keys; return }
        const next = this.columnVisibilitySupport.sanitize(keys)
        this.state.visibleColumnKeys = next
        this.columnVisibilitySupport.save(next)
    }
    /**
     * Closes the column-visibility panel when a click occurs outside both the panel element
     * and the toggle button (matched by `toggleSelector`).
     * Wire this to a document-level click listener.
     */
    public applyColumnVisibilityOutsideClick(target: EventTarget | null, panelEl: HTMLElement | null, toggleSelector = '.table-corner-fold.is-left') {
        if (!this.state.columnVisibilityPanelVisible || !this.columnVisibilitySupport) return
        if (!this.columnVisibilitySupport.shouldCloseOnOutsideClick(target, panelEl, toggleSelector)) return
        this.state.columnVisibilityPanelVisible = false
    }
    /** Convenience factory for the boolean filter options array expected by El-Table. */
    public createBooleanFilters(trueText: string, falseText: string): Array<{ text: string; value: boolean }> { return [{ text: trueText, value: true }, { text: falseText, value: false }] }
    /** Formats a boolean value for display using provided label strings. */
    public formatBoolean(value: unknown, trueText: string, falseText: string): string { return value ? trueText : falseText }
    /**
     * Returns the filter value for El-Table's `:filter-value` prop.
     * El-Table expects an array; an empty array means "no active filter".
     */
    public getFilteredValueForColumn(value: unknown): unknown[] { return value === null || value === undefined ? [] : [value] }
    /** Creates a remote-filter mapping descriptor for a boolean search parameter. */
    public createBooleanFilterMapping(paramName: string): { paramName: string; parser: (value: unknown) => boolean | null; emptyValue: null } {
        return { paramName, parser: (value: unknown) => this.parseBooleanFilterValue(value), emptyValue: null }
    }
    /**
     * Applies El-Table remote filter values to searchParams and triggers a new search.
     *
     * @param filters  The raw filter object from El-Table's filter-change event.
     * @param mappings Maps each filter key to its corresponding search param name, an optional
     *                 value parser, and a fallback value used when the filter is cleared.
     */
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

    /** Shows a confirm dialog then DELETEs a single row; re-fetches the list on success. */
    public handleDelete!: (row: any) => void
    protected async doHandleDelete(row: any) {
        const t = tGlobal
        const confirmResult = await ElMessageBox.confirm(this.getDeleteMessage(row), t('listPage.confirmTitle') as string, { confirmButtonText: t('listPage.confirmButton') as string, cancelButtonText: t('listPage.cancelButton') as string, type: 'warning' }).catch(err => err)
        if (confirmResult !== 'confirm') return
        const params = this.createDeleteParams(row)
        const result = await backendRequest({url: this.getDeleteUrl(), method: "delete", params: params})
        if (isApiSuccessResponse(result)) { ElMessage.success(t('listPage.deleteSuccess') as string); this.doAfterDelete([params["id"]]) }
        else ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
    }
    /** Shows a confirm dialog then batch-deletes all selected rows; re-fetches the list on success. */
    public multiDelete!: () => void
    protected async doMultiDelete() {
        const t = tGlobal
        const rows = this.state.selectedItems
        if (!rows || rows.length == 0) { ElMessage.info(t('listPage.selectDataFirst') as string); return }
        const confirmResult = await ElMessageBox.confirm(this.getBatchDeleteMessage(rows), t('listPage.confirmTitle') as string, { confirmButtonText: t('listPage.confirmButton') as string, cancelButtonText: t('listPage.cancelButton') as string, type: 'warning' }).catch(err => err)
        if (confirmResult !== 'confirm') return
        const params = this.createBatchDeleteParams()
        const result = await backendRequest({url: this.getBatchDeleteUrl(), method: "post", params: params})
        if (isApiSuccessResponse(result)) { ElMessage.success(t('listPage.deleteSuccess') as string); this.doAfterDelete(this.getSelectedIds()) }
        else ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || (t('listPage.deleteFailed') as string))
    }

    /** Opens the detail dialog for the given row, setting state.rid to the row's ID. */
    public handleDetail!: (row: any) => void
    protected doHandleDetail(row: any) { this.state.rid = this.getRowId(row); this.state.detailDialogVisible = true }
    /** Toggles the `active` flag on a row via a PUT request (params sent in query string). */
    public updateActive!: (row: any) => void
    protected async doUpdateActive(row: any) {
        const params: Record<string, any> = { id: this.getRowId(row), active: row.active }
        // NOTE: `row.subSystemCode ?? row.subSystemCode` appears intentional as a runtime
        // property read that guards against undefined; the field name is consistent in the backend.
        const subSystemCode = row.subSystemCode
        if (subSystemCode) params["subSystemCode"] = subSystemCode
        const result = await backendRequest({url: this.getUpdateActiveUrl(), method: 'put', params, paramsInQuery: true})
        if (!isApiSuccessResponse(result)) {
            // The el-switch v-model already toggled the row optimistically; revert it so the
            // UI does not show a state the backend rejected.
            row.active = !row.active
            ElMessage.error(await resolveApiFailureMessage(result) || getApiFailureMessage(result) || getApiResponseMessage(result) || tGlobal('listPage.updateActiveFailed'))
        }
    }
    /** Opens the edit dialog for the given row, setting state.rid to the row's ID. */
    public handleEdit!: (row: any) => void
    protected doHandleEdit(row: any) { this.state.rid = this.getRowId(row); this.state.editDialogVisible = true }
    /** Opens the add dialog. */
    public openAddDialog!: () => void
    protected doOpenAddDialog() { this.state.addDialogVisible = true }
    /** Toggles visibility of the inline operation column (e.g. edit/delete action buttons). */
    public toggleOperationColumn!: () => void
    protected doToggleOperationColumn() { this.state.showOperationColumn = !this.state.showOperationColumn }
    /**
     * Called by the add dialog on success. Optionally copies specified fields from the add
     * params into searchParams (so the list auto-filters to the newly created record), then
     * re-fetches the list.
     *
     * @see getAfterAddSearchParamKeys
     */
    public afterAdd!: (params: any) => void
    /**
     * Returns the param keys that should be copied from add/edit params into searchParams
     * after a successful add. Override in subclasses to enable auto-filter behaviour.
     */
    protected getAfterAddSearchParamKeys(): string[] { return [] }
    protected doAfterAdd(params: any) {
        const keys = this.getAfterAddSearchParamKeys()
        if (keys?.length && params && this.state.searchParams) {
            const sp = this.state.searchParams as Record<string, unknown>
            for (const k of keys) if (params[k] !== undefined && params[k] !== null) sp[k] = params[k]
        }
        this.search()
    }
    /** Called by the edit dialog on success. Delegates to doAfterAdd for the same refresh logic. */
    public afterEdit!: (params: any) => void
    protected doAfterEdit(params: any) { this.doAfterAdd(params) }
    /** Called after a successful delete (single or batch). Default: re-fetches the list. */
    public afterDelete!: (ids: Array<any>) => void
    protected doAfterDelete(_ids: Array<any>) { this.search() }

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
