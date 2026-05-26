import { ElMessage } from "element-plus"
import { BaseListPage } from "../core/BaseListPage"
import { Pair } from "../../model/Pair"
import { backendRequest, getApiResponseData } from "../../../utils/backendRequest"
import type { SysMicroServiceCacheItem } from "../core/BasePage"

/**
 * Abstract base class for list pages that support multi-tenant.
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportListPage extends BaseListPage {

    /** @internal Initialize tenant-related state and load the first level (subsystem or atomic service) plus tenant cascade data */
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

    /** Return the URL when the first level uses the subsystem API (e.g. sys/system/getAllActiveSubSystemCodes); return null to use atomic services. Subclasses can override. */
    protected getFirstLevelApiUrl(): string | null {
        return null
    }

    /** Load the first-level list (subsystem codes, etc.) from the given endpoint and write the result to state.firstLevelList and atomicServiceList, used by loadTenants and the table */
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

    /** Initialize tenant-filter state such as searchParams.subSysOrTenant and cascaderProps */
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
            ...(useLazy ? { lazy: true, lazyLoad: (node: { level: number; value: string; data?: { value?: string } }, resolve: (children: Array<{ value: string; label: string; leaf?: boolean }>) => void) => self.lazyLoadTenants(node, resolve) } : {}),
        }
    }

    /** Lazy load: when level 0 has no node data, return the first level (subsystems); when level 0 has node data or for level 1, fetch getTenantsBySubSystemCode by subsystem code to return the second level (tenants) */
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

    /** Whether the cascade is in strict mode (selecting a parent does not select its children); subclasses can override */
    protected isCheckStrictly(): boolean {
        return true
    }

    /** Whether selecting a subsystem/tenant is required before searching; defaults to false so searches can run without a selection (filtered by criteria). */
    protected isRequireSubSysOrTenantForSearch(): boolean {
        return false
    }

    /** On top of the parent's createSearchParams, inject subSystemCode and tenantId (matching the role list, so the mock/backend can filter by tenant) */
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

    /** Parse (subSystemCode, tenantId) from searchParams.subSysOrTenant; when required, the second level (tenant) must also be selected */
    protected parseSubSysOrTenant(): Pair | null {
        const subSysOrTenant = this.state.searchParams.subSysOrTenant
        if (this.isRequireSubSysOrTenantForSearch() && (subSysOrTenant == null || subSysOrTenant.length < 2)) {
            ElMessage.error('Please select a subsystem and then a tenant first!')
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

    /** After a successful add, back-fill searchParams.subSysOrTenant before calling the parent's doAfterAdd */
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

    /** Fetch all active tenants per first level (atomic services) and write them to state.subSysOrTenants; when getFirstLevelApiUrl is used, switch to setFirstLevelOptionsOnly + lazyLoad */
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
                // A single subsystem failure must not block the rest
            }
        }
        this.state.subSysOrTenants = options
    }

}
