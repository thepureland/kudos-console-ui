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

    /** @internal 若有 props.rid 则同步 state.rid、preLoad 后 loadData/loadOthers，否则报错 */
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

    /** 详情页基础 state：detail、rid */
    protected initBaseState(): any {
        return {
            detail: null,
            rid: '',
        }
    }

    /** 子类可重写以扩展 state */
    protected initState(): any {
    }

    /** 加载详情前的异步准备（如字典），返回 Promise；子类可重写 */
    protected async preLoad(): Promise<void> {
    }

    /** 详情加载成功后是否立即显示（true 时在 postLoadDataSuccessfully 中调用 render） */
    protected showAfterLoadData(): boolean {
        return true
    }

    /** 详情接口地址，默认 getRootActionPath() + "/getDetail" */
    protected getDetailLoadUrl(): string {
        return this.getRootActionPath() + "/getDetail"
    }

    /** 详情请求参数，默认 { id: state.rid 或 props.rid }，子类可重写以追加参数 */
    protected createDetailLoadParams(): any {
        return {
            id: String(this.state.rid || this.props.rid || '')
        }
    }

    /** 请求详情接口并写入 state.detail，成功时调用 postLoadDataSuccessfully。仅支持后端直接返回实体 */
    protected async loadData() {
        const params = this.createDetailLoadParams()
        const result = await backendRequest({ url: this.getDetailLoadUrl(), params })
        if (result != null) {
            this.postLoadDataSuccessfully(result)
        } else {
            ElMessage.error('数据加载失败！')
        }
    }

    /** 详情加载成功：写入 state.detail，若 showAfterLoadData 则 render */
    protected postLoadDataSuccessfully(data) {
        this.state.detail = data
        if (this.showAfterLoadData()) {
            this.render()
        }
    }

    /** 详情加载后的额外请求（如关联数据），子类可重写 */
    protected async loadOthers() {
    }

    /** 绑定 this，子类可在此追加方法绑定 */
    protected convertThis() {
        super.convertThis()
    }

}
