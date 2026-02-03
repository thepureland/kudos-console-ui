import { ElMessage } from "element-plus"
import { ref } from "vue"
import { ValidationRuleAdapter } from "../validation/ValidationRuleAdapter"
import { BasePage } from "./BasePage"
import { backendRequest } from "../../utils/backendRequest"


/**
 * 添加/编辑页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BaseAddEditPage extends BasePage {

    public form: any

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.form = ref()
        if (props.rid) {
            this.loadRowObject().then(() => this.initValidationRule())
        } else {
            super.render()
            this.initValidationRule()
        }
    }

    protected initBaseState(): any {
        return {
            rules: null,
        }
    }

    protected getValidationRuleUrl(): string {
        return this.getRootActionPath() + "/getValidationRule"
    }

    protected getSubmitUrl(): string {
        return this.getRootActionPath() + "/saveOrUpdate"
    }

    protected getRowObjectLoadUrl(): string {
        return this.getRootActionPath() + "/get"
    }

    protected createSubmitParams(): any {
        // remark: this.state.formModel.remark
        const params = {
            id: this.props.rid
        }
        const model = this.state.formModel
        if (model) {
            for (const propName in model) {
                params[propName] = model[propName]
            }
        }
        return params
    }

    protected fillForm(rowObject: any) {
        for (const propName in rowObject) {
            if (propName in this.state.formModel) {
                this.state.formModel[propName] = rowObject[propName]
            }
        }
    }

    protected createRowObjectLoadParams(): any {
        return {
            id: this.props.rid
        }
    }

    protected async loadRowObject() {
        const params = this.createRowObjectLoadParams()
        const result = await backendRequest({url: this.getRowObjectLoadUrl(), params});
        if (result.code == 200) {
            this.fillForm(result.data)
            super.render()
        } else {
            ElMessage.error('数据加载失败！')
        }
    }

    protected async initValidationRule(): Promise<any> {
        const result = await backendRequest({url: this.getValidationRuleUrl()});
        if (result.code == 200) {
            this.state.rules = new ValidationRuleAdapter(result.data, () => {
                return this.form.value.model
            }).getRules()
        } else {
            ElMessage.error('表单校验规则加载失败！')
        }
    }

    protected beforeValidate() {
    }

    public submit: () => void

    protected doSubmit() {
        this.beforeValidate()
        this.form.value.validate(async (valid: boolean) => {
            if (!valid) return ElMessage.error('验证未通过')
            const params = this.createSubmitParams()
            if (params) {
                const result = await backendRequest({url: this.getSubmitUrl(), method: "post", params})
                if (result.code == 200) {
                    ElMessage.success('保存成功！')
                    this.form.value.resetFields()
                    params.id = result.data
                    this.doClose()
                    this.context.emit('response', params)
                } else {
                    ElMessage.error('保存失败！')
                }
            }
        })
    }

    protected doClose() {
        super.doClose()
        this.form.value.resetFields()
    }

    protected convertThis() {
        super.convertThis()
        this.submit = () => {
            this.doSubmit()
        }
    }

}
