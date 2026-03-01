import { ElMessage } from "element-plus"
import { BaseAddEditPage } from "./BaseAddEditPage"
import { backendRequest } from "../../utils/backendRequest"


/**
 * 多租户支持的添加/编辑页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class TenantSupportAddEditPage extends BaseAddEditPage {

    /** @internal 初始化租户相关 formModel/cascaderProps 并加载原子服务与租户数据 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.initVars()
        this.loadAtomicServices().then(() => this.loadTenants())
    }

    /** 初始化 formModel.subSysOrTenant、cascaderProps、subSysOrTenants 等 */
    protected initVars() {
        let formModel = this.state.formModel
        if (!formModel) {
            formModel = {}
            this.state.formModel = formModel
        }
        formModel.subSysOrTenant = null
        formModel.subSysDictCode = null
        this.state.tenantId = null
        this.state.subSysOrTenants = null
        const self = this
        this.state.cascaderProps = {
            multiple: false,
            checkStrictly: self.isCheckStrictly(),
            expandTrigger: "hover"
        }
    }

    /** 级联是否严格模式，子类可重写 */
    protected isCheckStrictly(): boolean {
        return false
    }

    /** 提交前将 subSysOrTenant 拆成 subSysDictCode、tenantId 写入 formModel；未选时不弹窗，由表单校验提示 */
    protected beforeValidate() {
        const subSysOrTenant = this.state.formModel.subSysOrTenant
        if (!subSysOrTenant || subSysOrTenant.length === 0) {
            return
        }
        this.state.formModel.subSysDictCode = subSysOrTenant[0]
        if (subSysOrTenant.length > 1) {
            this.state.formModel.tenantId = subSysOrTenant[1]
        }
    }

    /** 回填时把 subSysDictCode、tenantId 合并为 subSysOrTenant 数组供级联显示 */
    protected fillForm(rowObject: any) {
        super.fillForm(rowObject)
        const subSysOrTenant = [rowObject.subSysDictCode]
        if (rowObject.tenantId) {
            subSysOrTenant.push(rowObject.tenantId)
        }
        this.state.formModel.subSysOrTenant = subSysOrTenant
    }

    /** 拉取租户树并写入 state.subSysOrTenants，供级联选择使用 */
    protected async loadTenants() {
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
