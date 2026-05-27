import { nextTick } from "vue"
import { BaseAddEditPage } from "../core/BaseAddEditPage"
import { backendRequest, getApiResponseData } from "../../../utils/backendRequest"
import type { SysMicroServiceCacheItem } from "../core/BasePage"

/**
 * Abstract base class for add/edit pages that support multi-tenant.
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportAddEditPage extends BaseAddEditPage {

    /** @internal Initialize tenant-related formModel/cascaderProps and load first-level (subsystem or atomic service) and tenant data */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.initVars()
        if (this.useListTenantBootstrap()) {
            // Don't write the list's options into state: once the list's loadTenants finishes it will replace the whole subSysOrTenants reference; just skip the request. Subclass templates merge-bind props with state.
        } else {
            const firstLevelUrl = this.getFirstLevelApiUrl()
            if (firstLevelUrl != null) {
                this.loadFirstLevel(firstLevelUrl).then(() => {
                    this.state.subSysOrTenants = []
                })
            } else {
                this.loadAtomicServices().then(() => this.loadTenants())
            }
        }
    }

    /**
     * When the list page passes in matching subsystem/tenant cascade data and atomic-service data, skip the API calls and share the list's data.
     * Subclasses can override; by default this requires listSubSysOrTenants, listCascaderProps, and listAtomicServiceList all to be provided.
     */
    protected useListTenantBootstrap(): boolean {
        const p = this.props as Record<string, unknown>
        return (
            p.listSubSysOrTenants !== undefined &&
            p.listCascaderProps !== undefined &&
            p.listAtomicServiceList !== undefined
        )
    }

    /** Return the URL when the first level uses the subsystem API (e.g. sys/system/getAllActiveSubSystemCodes); return null to use atomic services instead. Subclasses can override. */
    protected getFirstLevelApiUrl(): string | null {
        return null
    }

    /** Load the first-level list (subsystem codes, etc.) from the given endpoint and write the result to state.firstLevelList and atomicServiceList */
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

    /** Lazy load: when level 0 has no node data, return the first level (subsystems); when node data exists, fetch getTenantsBySubSystemCode by subsystem code to return the second level (tenants) */
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

    /** Initialize formModel.subSysOrTenant, cascaderProps, subSysOrTenants, etc. */
    protected initVars() {
        let formModel = this.state.formModel
        if (!formModel) {
            formModel = {}
            this.state.formModel = formModel
        }
        formModel.subSysOrTenant = null
        formModel.subSystemCode = null
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

    /** Whether the cascade is in strict mode; subclasses can override */
    protected isCheckStrictly(): boolean {
        return false
    }

    /** Before submit, split subSysOrTenant into subSystemCode and tenantId on formModel; if nothing is selected, don't prompt — let form validation handle it */
    protected beforeValidate() {
        const subSysOrTenant = this.state.formModel.subSysOrTenant
        if (!subSysOrTenant || subSysOrTenant.length === 0) {
            return
        }
        this.state.formModel.subSystemCode = subSysOrTenant[0]
        if (subSysOrTenant.length > 1) {
            this.state.formModel.tenantId = subSysOrTenant[1]
        }
    }

    /** When back-filling, combine subSystemCode and tenantId into a subSysOrTenant array for cascade display */
    protected fillForm(rowObject: any) {
        super.fillForm(rowObject)
        const subSys = rowObject.subSystemCode ?? this.state.formModel?.subSystemCode
        if (subSys == null || subSys === '') {
            return
        }
        const arr: string[] = [subSys]
        const tid = rowObject.tenantId ?? this.state.formModel?.tenantId
        if (tid != null && tid !== '') {
            arr.push(String(tid))
        }
        this.state.formModel.subSysOrTenant = arr
    }

    /** Fetch active tenants per subsystem (getTenantsBySubSystemCode) and write them into state.subSysOrTenants for cascade selection */
    protected async loadTenants() {
        const options: Array<{ value: string; label: string; children?: Array<{ value: string; label: string }> }> = []
        const subSyses = this.getAtomicServices()
        for (const subSys of subSyses) {
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
        // During edit back-fill, subSysOrTenant may be set before options arrive; the cascade needs to be re-triggered once options are ready
        const current = this.state.formModel?.subSysOrTenant
        if (Array.isArray(current) && current.length > 0) {
            nextTick(() => {
                this.state.formModel.subSysOrTenant = [...current]
            })
        }
    }

}
