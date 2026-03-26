import { BasePage } from "./BasePage"
import { ElMessage } from "element-plus"
import { backendRequest, getApiResponseData, isApiSuccessResponse } from "../../../utils/backendRequest"

export abstract class BaseDetailPage extends BasePage {
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        if (props.rid) {
            this.state.rid = String(props.rid)
            const promise = this.preLoad()
            if (promise) {
                const self = this
                promise.then(function () {
                    self.loadData()
                    self.loadOthers()
                })
            } else {
                this.loadData()
            }
        } else {
            console.error("rid不能为空！")
        }
    }

    protected initBaseState(): any {
        return {
            detail: null,
            rid: '',
        }
    }

    protected initState(): any {
    }

    protected async preLoad(): Promise<void> {
    }

    protected showAfterLoadData(): boolean {
        return true
    }

    protected getDetailLoadUrl(): string {
        return this.getRootActionPath() + "/getDetail"
    }

    protected createDetailLoadParams(): any {
        return {
            id: String(this.state.rid || this.props.rid || '')
        }
    }

    protected async loadData() {
        const params = this.createDetailLoadParams()
        const result = await backendRequest({ url: this.getDetailLoadUrl(), params })
        const payload = getApiResponseData(result)
        if (isApiSuccessResponse(result) && payload != null) {
            this.postLoadDataSuccessfully(payload)
        } else {
            ElMessage.error('数据加载失败！')
        }
    }

    protected postLoadDataSuccessfully(data) {
        this.state.detail = data
        if (this.showAfterLoadData()) {
            this.render()
        }
    }

    protected async loadOthers() {
    }

    protected convertThis() {
        super.convertThis()
    }

}
