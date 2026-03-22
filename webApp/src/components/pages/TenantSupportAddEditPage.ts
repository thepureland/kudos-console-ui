import { nextTick } from "vue"
import { ElMessage } from "element-plus"
import { BaseAddEditPage } from "./BaseAddEditPage"
import { backendRequest, getApiResponseData } from "../../utils/backendRequest"
import type { SysMicroServiceCacheItem } from "./BasePage"

/**
 * 多租户支持的添加/编辑页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportAddEditPage extends BaseAddEditPage {

    /** @internal 初始化租户相关 formModel/cascaderProps 并加载第一级（子系统或原子服务）与租户数据 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.initVars()
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

    /** 从指定接口加载第一级列表（子系统编码等），结果写入 state.firstLevelList 与 atomicServiceList */
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

    /** 懒加载：level 0 且无节点数据时返回第一级（子系统）；有 node 数据时按子系统编码请求 getTenantsBySubSystemCode 返回第二级（租户） */
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

    /** 初始化 formModel.subSysOrTenant、cascaderProps、subSysOrTenants 等 */
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

    /** 级联是否严格模式，子类可重写 */
    protected isCheckStrictly(): boolean {
        return false
    }

    /** 提交前将 subSysOrTenant 拆成 subSystemCode、tenantId 写入 formModel；未选时不弹窗，由表单校验提示 */
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

    /** 回填时把 subSystemCode、tenantId 合并为 subSysOrTenant 数组供级联显示 */
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

    /** 按子系统拉取启用租户（getTenantsBySubSystemCode），写入 state.subSysOrTenants 供级联选择使用 */
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
                // 单子系统失败不阻塞其余
            }
        }
        this.state.subSysOrTenants = options
        // 编辑回填时可能先于 options 设置 subSysOrTenant，级联需在 options 就绪后重新触发显示
        const current = this.state.formModel?.subSysOrTenant
        if (Array.isArray(current) && current.length > 0) {
            nextTick(() => {
                this.state.formModel.subSysOrTenant = [...current]
            })
        }
    }

}
