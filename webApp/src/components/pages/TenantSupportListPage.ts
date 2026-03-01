import { ElMessage } from "element-plus"
import { BaseListPage } from "./BaseListPage"
import { Pair } from "../model/Pair"
import { backendRequest } from "../../utils/backendRequest"

/**
 * 多租户支持的列表页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportListPage extends BaseListPage {

    /** @internal 初始化租户相关 state 并加载原子服务与租户级联数据 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.initTenantVars()
        this.loadAtomicServices().then(() => this.loadTenants())
    }

    /** 初始化 searchParams.subSysOrTenant、cascaderProps 等租户筛选相关 state */
    private initTenantVars() {
        let searchParams = this.state.searchParams
        if (!searchParams) {
            searchParams = {}
            this.state.searchParams = searchParams
        }
        searchParams.subSysOrTenant = null
        this.state.subSysDictCode = null
        this.state.tenantId = null
        this.state.subSysOrTenants = null
        const self = this
        this.state.cascaderProps = {
            multiple: false,
            checkStrictly: self.isCheckStrictly(),
            expandTrigger: "hover"
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

    /** 在父类 createSearchParams 基础上注入 subSysDictCode、tenantId（来自 parseSubSysOrTenant） */
    protected createSearchParams() {
        const pair = this.parseSubSysOrTenant()
        if (pair == null) {
            return null
        } else {
            const params = super.createSearchParams()
            params.subSysDictCode = pair.first
            this.state.subSysDictCode = pair.first
            params.tenantId = pair.second
            this.state.tenantId = pair.second
            return params
        }
    }

    /** 从 searchParams.subSysOrTenant 解析出 (subSysDictCode, tenantId)；必选时未选会提示并返回 null */
    protected parseSubSysOrTenant(): Pair | null {
        const subSysOrTenant = this.state.searchParams.subSysOrTenant
        if (this.isRequireSubSysOrTenantForSearch() && (subSysOrTenant == null || subSysOrTenant.length == 0)) {
            ElMessage.error('请先选择子系统/租户！')
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
        const subSysDictCode = params.subSysDictCode
        const tenantId = params.tenantId
        const subSysOrTenant = [subSysDictCode]
        if (tenantId) {
            subSysOrTenant.push(tenantId)
        }
        this.state.searchParams.subSysOrTenant = subSysOrTenant

        super.doAfterAdd(params)
    }

    /** 拉取所有活跃租户并按原子服务分组，写入 state.subSysOrTenants 供级联使用 */
    private async loadTenants() {
        const result = await backendRequest({url: "sys/tenant/getAllActiveTenants", method: "post"})
        if (result.code == 200) {
            const options = []
            const subSyses = this.getAtomicServices()
            for (let subSys of subSyses) {
                const subSysOption = {value: subSys.code, label: subSys.name}
                options.push(subSysOption)
                const tenants = result.data[subSys.code]
                if (tenants) {
                    const tenantOptions = []
                    subSysOption["children"] = tenantOptions
                    for (let tenantId in tenants) {
                        const tenantOption = {value: tenantId, label: tenants[tenantId]}
                        tenantOptions.push(tenantOption)
                    }
                }
            }
            this.state.subSysOrTenants = options
        } else {
            ElMessage.error('加载租户信息失败！')
        }
    }

}
