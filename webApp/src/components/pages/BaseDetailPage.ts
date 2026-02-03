import { BasePage } from "./BasePage"
import { ElMessage } from "element-plus"
import { backendRequest } from "../../utils/backendRequest"

/**
 * 详情页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BaseDetailPage extends BasePage {

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        if (props.rid) {
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
            id: this.props.rid
        }
    }

    protected async loadData() {
        const params = this.createDetailLoadParams()
        const result = await backendRequest({url: this.getDetailLoadUrl(), params});
        if (result.code == 200) {
            this.postLoadDataSuccessfully(result.data)
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
