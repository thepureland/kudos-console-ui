import { ElMessage } from "element-plus"
import { TenantSupportAddEditPage } from "./TenantSupportAddEditPage"
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from "../../../utils/backendRequest"


/**
 * 组织机构支持的添加/编辑页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class OrgSupportAddEditPage extends TenantSupportAddEditPage {

    private parentCascader: any

    /** @internal 需要 parentCascader 组件 ref，用于提交时取选中的父级节点 */
    protected constructor(
        props: Record<string, any>,
        context: { emit: (event: string, ...args: any[]) => void },
        parentCascader: any
    ) {
        super(props, context)
        this.parentCascader = parentCascader
        this.convertThis()
    }

    /** 在租户级联基础上增加懒加载级联配置与 formModel.parent */
    protected initVars() {
        super.initVars()
        const _self = this
        this.state.cascaderProps = {
            lazy: true,
                value: "id",
                label: "name",
                multiple: false,
                checkStrictly: true,
                expandTrigger: "hover",
                lazyLoad(node, resolve) {
                _self.loadTreeNodes(node, resolve)
            },
        }
        this.state.formModel.parent = []
    }

    /** 子类可重写：提交时从 parent 级联取 tenantId/parentId/subSystemCode；Account 等改为从 subSysOrTenant + parent 取 */
    protected createSubmitParams(): any {
        const params = super.createSubmitParams()
        const nodes = this.parentCascader.value?.getCheckedNodes?.()
        if (nodes?.[0]) {
            params.tenantId = this.getTenantId(nodes[0])
            params.parentId = this.getParentId(nodes[0])
            params.subSystemCode = this.state.formModel.parent[0]
        }
        return params
    }

    /** 回填时用 subSystemCode、tenantId、parentIds 组装 formModel.parent 数组 */
    protected fillForm(rowObject: any) {
        super.fillForm(rowObject)
        const parents = [rowObject.subSystemCode]
        if (rowObject.tenantId) {
            parents.push(rowObject.tenantId)
        }
        const parentIds = rowObject.parentIds
        if (parentIds) {
            for (let parentId of parentIds) {
                parents.push(parentId)
            }
        }
        this.state.formModel.parent = parents
    }

    public loadTreeNodes: (node: any, resolve: (data: any[]) => void) => void

    /** 级联懒加载：根节点返回原子服务列表，子节点请求 organization 树接口 */
    protected async doLoadTreeNodes(node: any, resolve: (data: any[]) => void) {
        if (node.level === 0) {
            if (this.getAtomicServices().length === 0) await this.loadAtomicServices()
            const items = this.getAtomicServices()
            const subSyses = items.map((item) => ({ id: item.code, name: item.name }))
            resolve(subSyses)
        } else {
            const params = {
                subSystemCode: this.getsubSystemCode(node),
                tenantId: this.getTenantId(node),
                parentId: this.getParentId(node),
                active: true
            }
            const result = await backendRequest({url: "user/organization/lazyLoadTree", method: "post", params})
            const payload = getApiResponseData<any[]>(result)
            if (Array.isArray(payload)) {
                resolve(payload)
            } else {
                ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || '组织机构树加载失败！')
            }
        }
    }

    /** 从级联节点向上找到根节点，返回其 id（子系统编码） */
    protected getsubSystemCode(node: any): string {
        while (node.parent) {
            node = node.parent
        }
        return node.data.id
    }

    /** 从级联节点向上找到「组织=false」的节点，返回其 id 作为租户 id */
    protected getTenantId(node: any): string | null {
        while (node.parent) {
            if (node.data.organization === false) {
                return node.data.id
            }
            node = node.parent
        }
        return null
    }

    /** 当前节点为租户层或根则无父级 id，否则返回当前节点 id 作为 parentId */
    protected getParentId(node: any): string | null {
        if (node.data.organization === false || node.parent == undefined) {
            return null
        }
        return node.data.id
    }

    /** 绑定 loadTreeNodes 到 doLoadTreeNodes */
    protected convertThis() {
        super.convertThis()
        this.loadTreeNodes = (node: any, resolve: (data: any[]) => void) => {
            this.doLoadTreeNodes(node, resolve)
        }
    }

}
