import { ElMessage } from "element-plus"
import { nextTick, ref } from "vue"
import { ValidationRuleAdapter } from "../validation/ValidationRuleAdapter"
import { BasePage } from "./BasePage"
import { backendRequest } from "../../utils/backendRequest"
import { i18n } from "../../i18n"


/**
 * 添加/编辑页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BaseAddEditPage extends BasePage {

    public form: any

    /** 当前编辑行 id，与 props.rid 同步，供 createRowObjectLoadParams / 子类使用 */
    public currentRid: string = ''

    /** 编辑数据加载并回填后由组件注册，用于立即拍快照等（如未保存提示） */
    public onEditFormLoaded: (() => void) | null = null

    /** @internal 有 rid 时加载编辑数据并 initValidationRule，无 rid 时直接 render + initValidationRule */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.form = ref()
        this.currentRid = props.rid ? String(props.rid) : ''
        if (props.rid) {
            this.loadRowObject().then(() => this.initValidationRule())
        } else {
            super.render()
            this.initValidationRule()
        }
    }

    /** 按当前 currentRid 重新加载编辑数据，供弹窗打开时或 rid 变化时调用 */
    public reloadRowData(): Promise<void> {
        return this.loadRowObject()
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

    /** 加载失败时的 i18n key，子类可重写为模块级 key（如 cacheAddEdit.messages.loadFailed） */
    protected getLoadFailedMessageKey(): string {
        return 'addEditPage.loadFailed'
    }

    /**
     * 生成基于 i18n 的必填校验规则，供子类在 initValidationRule 中合并使用，保证切换语言后提示正确。
     * @param fieldToKey 字段名 -> i18n 文案 key，如 { name: 'cacheAddEdit.validation.requiredName' }
     * @param triggerByField 可选，字段 -> 'blur'|'change'，未指定的字段默认 'blur'（下拉建议 'change'）
     */
    protected createRequiredRules(
        fieldToKey: Record<string, string>,
        triggerByField?: Partial<Record<string, 'blur' | 'change'>>
    ): Record<string, Array<{ required: boolean; validator: (rule: any, value: any, callback: (err?: Error) => void) => void; trigger: string }>> {
        const rules: Record<string, Array<{ required: boolean; validator: (rule: any, value: any, callback: (err?: Error) => void) => void; trigger: string }>> = {}
        for (const field of Object.keys(fieldToKey)) {
            const i18nKey = fieldToKey[field]
            const trigger = triggerByField?.[field] ?? 'blur'
            rules[field] = [{
                required: true,
                validator: (_rule: any, value: unknown, callback: (err?: Error) => void) => {
                    if (value !== undefined && value !== null && String(value).trim() !== '') callback()
                    else callback(new Error((i18n.global.t(i18nKey) as string) || ''))
                },
                trigger,
            }]
        }
        return rules
    }

    /** 提交参数：合并 id（props.rid）与 state.formModel，子类可重写 */
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

    /** 将接口返回的 rowObject 回填到 state.formModel，子类可重写以处理级联等 */
    protected fillForm(rowObject: any) {
        for (const propName in rowObject) {
            if (propName in this.state.formModel) {
                this.state.formModel[propName] = rowObject[propName]
            }
        }
    }

    /** 编辑时加载单条数据的请求参数，默认 { id: currentRid } */
    protected createRowObjectLoadParams(): any {
        const rid = this.currentRid || (this.props.rid ? String(this.props.rid) : '')
        return { id: rid }
    }

    /** 请求 get 接口拉取编辑数据并 fillForm，成功时 render 并调用 onEditFormLoaded */
    protected async loadRowObject() {
        const params = this.createRowObjectLoadParams()
        const result = await backendRequest({url: this.getRowObjectLoadUrl(), params});
        if (result.code == 200) {
            this.fillForm(result.data)
            super.render()
            this.onEditFormLoaded?.()
        } else {
            ElMessage.error(i18n.global.t(this.getLoadFailedMessageKey()) as string)
        }
    }

    /** 请求校验规则接口并生成 state.rules（ValidationRuleAdapter），供 el-form 使用 */
    protected async initValidationRule(): Promise<any> {
        const result = await backendRequest({url: this.getValidationRuleUrl()});
        if (result.code == 200) {
            this.state.rules = new ValidationRuleAdapter(
            result.data,
            () => this.getFormInstance()?.model,
            'blur',
            () => i18n.global.t('addEditPage.defaultValidationMessage') as string
        ).getRules()
        } else {
            ElMessage.error(i18n.global.t('addEditPage.validationRuleLoadFailed') as string)
        }
    }

    /** 提交前校验前钩子，子类可在此同步 formModel（如级联字段） */
    protected beforeValidate() {
    }

    public submit: () => void

    /** 获取表单实例：模板 ref 可能把 this.form 写成 el-form 实例，或保持为 Ref */
    protected getFormInstance(): any {
        const f = this.form
        if (!f) return null
        if (typeof f.validate === 'function') return f
        return f?.value ?? null
    }

    /** 表单校验通过后组参请求保存接口，成功则 emit response 并关闭 */
    protected doSubmit() {
        try {
            const formInstance = this.getFormInstance()
            if (!formInstance || typeof formInstance.validate !== 'function') {
                ElMessage.error(i18n.global.t('addEditPage.formNotReady') as string)
                return
            }
            this.beforeValidate()
            formInstance.validate((valid: boolean) => {
                if (!valid) {
                    ElMessage.error(i18n.global.t('addEditPage.validationFailed') as string)
                    return
                }
                const params = this.createSubmitParams()
                if (!params) return
                backendRequest({ url: this.getSubmitUrl(), method: 'post', params })
                    .then((result) => {
                        if (result && result.code == 200) {
                            ElMessage.success(i18n.global.t('addEditPage.saveSuccess') as string)
                            const form = this.getFormInstance()
                            if (form?.resetFields) form.resetFields()
                            params.id = result.data
                            if (typeof this.props?.onSaved === 'function') this.props.onSaved(params)
                            this.context.emit('response', params)
                            nextTick(() => this.doClose())
                        } else {
                            const msg = result?.msg ?? result?.message ?? i18n.global.t('addEditPage.saveFailed')
                            ElMessage.error(typeof msg === 'string' ? msg : (i18n.global.t('addEditPage.saveFailed') as string))
                        }
                    })
                    .catch((e) => {
                        const msg = e instanceof Error ? e.message : i18n.global.t('addEditPage.requestFailed')
                        ElMessage.error(typeof msg === 'string' ? msg : (i18n.global.t('addEditPage.requestFailed') as string))
                    })
            })
        } catch (e) {
            const msg = e instanceof Error ? e.message : i18n.global.t('addEditPage.submitError')
            ElMessage.error(typeof msg === 'string' ? msg : (i18n.global.t('addEditPage.submitError') as string))
        }
    }

    /** 关闭时重置表单并调用父类 doClose */
    protected doClose() {
        super.doClose()
        const form = this.getFormInstance()
        if (form?.resetFields) form.resetFields()
    }

    /** 绑定 submit 到 doSubmit */
    protected convertThis() {
        super.convertThis()
        this.submit = () => {
            this.doSubmit()
        }
    }

}
