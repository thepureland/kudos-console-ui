import {ElMessage, ElMessageBox} from "element-plus"
import { BasePage } from "./BasePage"
import { backendRequest } from "../../utils/backendRequest"
import { ColumnVisibilitySupport } from "../widgets/ColumnVisibilitySupport"

/**
 * 列表页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BaseListPage extends BasePage {

    // 列可见性能力按需启用，避免影响未接入页面
    private columnVisibilitySupport: ColumnVisibilitySupport | null = null
    // 列表状态持久化 key（由子页面配置）
    private listStateStorageKey: string | null = null
    private tableMaxHeightFallback = 520
    private tableMaxHeightMin = 280
    private tableBottomSafeGap = 20

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
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
        return this.getRootActionPath() + "/search"
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
    protected getDeleteMessage(row: any): string {
        return '确定要删除该数据？'
    }

    /** 获取批量删除确认文案。 */
    protected getBatchDeleteMessage(rows: Array<any>): string {
        return "确定要删除这" + rows.length + "行数据吗？"
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
        if (result.code == 200) {
            this.postSearchSuccessfully(result.data)
        } else {
            ElMessage.error('查询失败！')
        }
    }

    /** 处理查询成功后的列表与分页数据。 */
    protected postSearchSuccessfully(data: any) {
        if (data && Array.isArray(data.first) && typeof data.second === "number") {
            this.state.tableData = data.first
            this.state.pagination.total = data.second
            return
        }
        this.state.tableData = Array.isArray(data) ? data : []
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

    /** 重置搜索条件并回到第一页。 */
    protected doResetSearchFields() {
        this.state.pagination.pageNo = 1
        const searchParams = this.state.searchParams
        if (searchParams) {
            for (const paramName in searchParams) {
                searchParams[paramName] = null
            }
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

    /** 配置列表状态持久化存储 key。 */
    public configureListStatePersistence(storageKey: string) {
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

    /** 根据表格容器与分页元素计算可用最大高度。 */
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
        const available = Math.floor(window.innerHeight - top - paginationHeight - this.tableBottomSafeGap)
        this.state.tableMaxHeight = Math.max(this.tableMaxHeightMin, available)
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

    /** 将当前列表查询态持久化到本地。 */
    public persistListState() {
        if (!this.listStateStorageKey || typeof window === "undefined") return
        // 仅持久化列表查询态，避免把弹窗等瞬时 UI 状态写入本地
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
        const confirmResult = await ElMessageBox.confirm(this.getDeleteMessage(row), '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }).catch(err => err)
        if (confirmResult !== 'confirm') {
            return
        }
        const params = this.createDeleteParams(row)
        const result = await backendRequest({url: this.getDeleteUrl(), method: "delete", params: params})
        if (result.data === true) {
            ElMessage.success('删除成功！')
            this.doAfterDelete([params["id"]])
        } else {
            ElMessage.error('删除失败！')
        }
    }

    public multiDelete: () => void

    /** 处理批量删除（含确认与结果提示）。 */
    protected async doMultiDelete() {
        const rows = this.state.selectedItems
        if (!rows || rows.length == 0) {
            ElMessage.info('请先选择要删除的数据！')
        } else {
            const confirmResult = await ElMessageBox.confirm(this.getBatchDeleteMessage(rows), '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).catch(err => err)
            if (confirmResult !== 'confirm') {
                return
            }
            const params = this.createBatchDeleteParams()
            const result = await backendRequest({url: this.getBatchDeleteUrl(), method: "post", params: params})
            if (result.data === true) {
                ElMessage.success('删除成功！')
                this.doAfterDelete(this.getSelectedIds())
            } else {
                ElMessage.error('删除失败！')
            }
        }
    }

    public handleDetail: (row: any) => void

    /** 打开详情弹窗。 */
    protected doHandleDetail(row: any) {
        this.state.detailDialogVisible = true
        this.state.rid = this.getRowId(row)
    }

    public updateActive: (row: any) => void

    /** 更新启用状态。 */
    protected async doUpdateActive(row: any) {
        const params = {
            id: this.getRowId(row),
            active: row.active
        }
        if (row.subSysDictCode) {
            params["subSysDictCode"] = row.subSysDictCode
        }
        const result = await backendRequest({url: this.getUpdateActiveUrl(), params})
        if (!result.data) {
            ElMessage.error('启用状态更新失败！')
        }
    }

    public handleEdit: (row: any) => void

    /** 打开编辑弹窗。 */
    protected doHandleEdit(row: any) {
        this.state.editDialogVisible = true
        this.state.rid = this.getRowId(row)
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

    /** 新增成功后的默认回调：重新查询。 */
    protected doAfterAdd(params: any) {
        this.search()
    }

    public afterEdit: (params: any) => void

    /** 编辑成功后的默认回调：重新查询。 */
    protected doAfterEdit(params: any) {
        this.search()
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
