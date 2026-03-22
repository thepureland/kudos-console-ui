import { ElMessage } from "element-plus"
import { BaseListPage } from "./BaseListPage"
import { Pair } from "../model/Pair"
import { backendRequest, getApiResponseData } from "../../utils/backendRequest"
import type { SysMicroServiceCacheItem } from "./BasePage"

/**
 * 多租户支持的列表页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportListPage extends BaseListPage {

    /** @internal 初始化租户相关 state 并加载第一级（子系统或原子服务）与租户级联数据 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.initTenantVars()
        const firstLevelUrl = this.getFirstLevelApiUrl()
        if (firstLevelUrl != null) {
            this.loadFirstLevel(firstLevelUrl).then(() => {
                this.state.subSysOrTenants = []
            })
        } else {
            this.loadAtomicServices().then(() => this.loadTenants())
        }
    }

    /** 第一级使用子系统接口时返回 URL（如 sys/system/getAllActiveSubSystemCodes），返回 null 则使用原子服务。子类可重写。 */
    protected getFirstLevelApiUrl(): string | null {
        return null
    }

    /** 从指定接口加载第一级列表（子系统编码等），结果写入 state.firstLevelList 与 atomicServiceList，供 loadTenants 与表格展示使用 */
    private async loadFirstLevel(url: string): Promise<void> {
        try {
            const result = await backendRequest({ url, method: "get" })
            const payload = getApiResponseData<unknown[]>(result)
            const raw = Array.isArray(payload) ? payload.map((x) => String(x ?? "")) : []
            const list = raw.filter((c) => c !== "").map((code) => ({ code, name: code }))
            this.state.firstLevelList = list
            const asCache: SysMicroServiceCacheItem[] = list.map(({ code, name }) => ({
                id: code,
                code,
                name,
                context: null as string | null,
                atomicService: true,
                parentCode: null as string | null,
                remark: null as string | null,
                active: true,
                builtIn: true,
            }))
            this.atomicServiceList = asCache
            this.state.atomicServiceList = asCache
        } catch {
            this.state.firstLevelList = []
        }
    }

    /** 初始化 searchParams.subSysOrTenant、cascaderProps 等租户筛选相关 state */
    private initTenantVars() {
        let searchParams = this.state.searchParams
        if (!searchParams) {
            searchParams = {}
            this.state.searchParams = searchParams
        }
        searchParams.subSysOrTenant = null
        this.state.subSystemCode = null
        this.state.tenantId = null
        this.state.subSysOrTenants = null
        this.state.firstLevelList = null
        const self = this
        const useLazy = self.getFirstLevelApiUrl() != null
        this.state.cascaderProps = {
            multiple: false,
            checkStrictly: self.isCheckStrictly(),
            expandTrigger: "hover",
            ...(useLazy ? { lazy: true, lazyLoad: (node: { level: number; value: string; data?: { value?: string } }, resolve: (children: Array<{ value: string; label: string; leaf: boolean }>) => void) => self.lazyLoadTenants(node, resolve) } : {}),
        }
    }

    /** 懒加载：level 0 且无节点数据时返回第一级（子系统）；level 0 且有 node 数据或 level 1 时按子系统编码请求 getTenantsBySubSystemCode 返回第二级（租户） */
    private async lazyLoadTenants(node: { level: number; value: string; data?: { value?: string } }, resolve: (children: Array<{ value: string; label: string; leaf?: boolean }>) => void) {
        const subSystemCode = (node.data?.value ?? node.value) as string
        const isRootRequest = node.level === 0 && !subSystemCode
        if (isRootRequest) {
            const firstLevel = (this.state.firstLevelList as Array<{ code: string; name: string }> | null) ?? []
            resolve(firstLevel.map((sub) => ({ value: sub.code, label: sub.name, leaf: false })))
            return
        }
        const needChildren = node.level === 0 || node.level === 1
        if (!needChildren || !subSystemCode) {
            resolve([])
            return
        }
        try {
            const result = await backendRequest({ url: "sys/tenant/getTenantsBySubSystemCode", method: "get", params: { subSystemCode } })
            const payload = getApiResponseData<Array<{ id: string; name: string }>>(result)
            const children = Array.isArray(payload)
                ? payload.map((item) => ({ value: item.id, label: item.name, leaf: true }))
                : []
            resolve(children)
        } catch {
            resolve([])
        }
    }

    /** 级联是否严格模式（选父不选子），子类可重写 */
    protected isCheckStrictly(): boolean {
        return true
    }

    /** 是否必须先选择子系统/租户才能搜索；默认 false，可不选直接搜索（按条件筛选）。 */
    protected isRequireSubSysOrTenantForSearch(): boolean {
        return false
    }

    /** 在父类 createSearchParams 基础上注入 subSystemCode、tenantId（与角色列表一致，便于 Mock/后端按租户过滤） */
    protected createSearchParams() {
        const pair = this.parseSubSysOrTenant()
        if (pair == null) {
            return null
        } else {
            const params = super.createSearchParams()
            this.state.subSystemCode = pair.first
            this.state.tenantId = pair.second
            params.subSystemCode = pair.first
            params.tenantId = pair.second
            return params
        }
    }

    /** 从 searchParams.subSysOrTenant 解析出 (subSystemCode, tenantId)；必选时须选到第二层（租户）才通过 */
    protected parseSubSysOrTenant(): Pair | null {
        const subSysOrTenant = this.state.searchParams.subSysOrTenant
        if (this.isRequireSubSysOrTenantForSearch() && (subSysOrTenant == null || subSysOrTenant.length < 2)) {
            ElMessage.error('请先选择子系统并选择租户！')
            return null
        }
        const pair = new Pair(null, null)
        if (subSysOrTenant) {
            if (subSysOrTenant.length > 0) {
                pair.first = subSysOrTenant[0]
            }
            if (subSysOrTenant.length > 1) {
                pair.second = subSysOrTenant[1]
            }
        }
        return pair
    }

    /** 新增成功后回填 searchParams.subSysOrTenant 再执行父类 doAfterAdd */
    protected doAfterAdd(params: any) {
        const subSystemCode = params.subSystemCode
        const tenantId = params.tenantId
        const subSysOrTenant = [subSystemCode]
        if (tenantId) {
            subSysOrTenant.push(tenantId)
        }
        this.state.searchParams.subSysOrTenant = subSysOrTenant

        super.doAfterAdd(params)
    }

    /** 按第一级（原子服务）拉取全部启用租户，写入 state.subSysOrTenants；使用 getFirstLevelApiUrl 时改为 setFirstLevelOptionsOnly + lazyLoad */
    private async loadTenants() {
        const options: Array<{ value: string; label: string; children?: Array<{ value: string; label: string }> }> = []
        const firstLevel = this.getAtomicServices().map((s) => ({ code: s.code, name: s.name }))
        for (const subSys of firstLevel) {
            const subSysOption: { value: string; label: string; children?: Array<{ value: string; label: string }> } = { value: subSys.code, label: subSys.name }
            options.push(subSysOption)
            try {
                const result = await backendRequest({ url: "sys/tenant/getTenantsBySubSystemCode", method: "get", params: { subSystemCode: subSys.code } })
                const payload = getApiResponseData<Array<{ id: string; name: string }>>(result)
                if (Array.isArray(payload) && payload.length > 0) {
                    subSysOption.children = payload.map((item) => ({ value: item.id, label: item.name }))
                }
            } catch {
                // 单子系统失败不阻塞其余
            }
        }
        this.state.subSysOrTenants = options
    }

}
