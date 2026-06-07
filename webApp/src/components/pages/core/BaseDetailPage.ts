import { BasePage } from "./BasePage"
import { ElMessage } from "element-plus"
import { tGlobal } from '../../../i18n';
import { backendRequest, getApiResponseData, isApiSuccessResponse } from "../../../utils/backendRequest"

export abstract class BaseDetailPage extends BasePage {
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        if (props.rid) {
            this.state.rid = String(props.rid)
            const promise = this.preLoad()
            if (promise) {
                // Wait for any pre-load work (e.g. loading dictionaries) before fetching the record.
                promise.then(() => {
                    this.loadData()
                    this.loadOthers()
                })
            } else {
                this.loadData()
            }
        } else {
            console.error("rid cannot be empty!")
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

    /** Override to perform async work (e.g. load dictionaries) before loadData() is called. */
    protected async preLoad(): Promise<void> {
    }

    /** Detail pages are hidden until data is fetched; render() is called from postLoadDataSuccessfully(). */
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
            ElMessage.error(tGlobal('listPage.loadDataFailed'))
        }
    }

    protected postLoadDataSuccessfully(data: unknown) {
        this.state.detail = data
        if (this.showAfterLoadData()) {
            this.render()
        }
    }

    /** Override to load supplementary data (e.g. related lists) after the main record is loaded. */
    protected async loadOthers() {
    }

}
