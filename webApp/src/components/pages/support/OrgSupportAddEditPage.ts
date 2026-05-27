import { ElMessage } from "element-plus"
import { TenantSupportAddEditPage } from "./TenantSupportAddEditPage"
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from "../../../utils/backendRequest"


/**
 * Abstract base class for add/edit pages that support organizations.
 *
 * @author K
 * @since 1.0.0
 */
export abstract class OrgSupportAddEditPage extends TenantSupportAddEditPage {

    private parentCascader: any

    /** @internal Requires the parentCascader component ref so the selected parent node can be read on submit */
    protected constructor(
        props: Record<string, any>,
        context: { emit: (event: string, ...args: any[]) => void },
        parentCascader: any
    ) {
        super(props, context)
        this.parentCascader = parentCascader
        this.convertThis()
    }

    /** On top of the tenant cascade, add lazy-loaded cascade options and formModel.parent */
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
                lazyLoad(node: any, resolve: (data: any[]) => void) {
                _self.loadTreeNodes(node, resolve)
            },
        }
        this.state.formModel.parent = []
    }

    /** Subclasses can override: on submit, read tenantId/parentId/subSystemCode from the parent cascade; pages like Account instead read from subSysOrTenant + parent */
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

    /** When back-filling, assemble the formModel.parent array from subSystemCode, tenantId, and parentIds */
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

    public loadTreeNodes!: (node: any, resolve: (data: any[]) => void) => void

    /** Cascade lazy-load: root nodes return the atomic-service list, child nodes request the organization tree endpoint */
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
                ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Failed to load the organization tree!')
            }
        }
    }

    /** Walk up from a cascade node to the root and return its id (subsystem code) */
    protected getsubSystemCode(node: any): string {
        while (node.parent) {
            node = node.parent
        }
        return node.data.id
    }

    /** Walk up from a cascade node, find the first node with organization === false, and return its id as the tenant id */
    protected getTenantId(node: any): string | null {
        while (node.parent) {
            if (node.data.organization === false) {
                return node.data.id
            }
            node = node.parent
        }
        return null
    }

    /** Return null when the current node is at the tenant level or the root (no parent id); otherwise return the current node id as parentId */
    protected getParentId(node: any): string | null {
        if (node.data.organization === false || node.parent == undefined) {
            return null
        }
        return node.data.id
    }

    /** Bind loadTreeNodes to doLoadTreeNodes */
    protected convertThis() {
        super.convertThis()
        this.loadTreeNodes = (node: any, resolve: (data: any[]) => void) => {
            this.doLoadTreeNodes(node, resolve)
        }
    }

}
