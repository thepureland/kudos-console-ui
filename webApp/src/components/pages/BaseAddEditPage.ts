import { ElMessage } from "element-plus"
import { nextTick, ref } from "vue"
import { ValidationRuleAdapter } from "../validation/ValidationRuleAdapter"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from "../../utils/backendRequest"
import { i18n, loadMessagesForConfig, loadMessagesForValidationPage } from "../../i18n"

/**
 * 从 getCreateValidationRule / getUpdateValidationRule 响应中取出「字段 -> 规则」map。
 * 若顶层为 { code, data } 类通用包装且 code 为原始值，则使用 data（为对象时）；否则整段响应即规则 map（全部由后端约定，不在此白名单规则名）。
 */
function extractValidationRulesPayload(result: unknown): Record<string, unknown> {
    if (result == null || typeof result !== 'object' || Array.isArray(result)) {
        return {}
    }
    const o = result as Record<string, unknown>
    if (o.code !== undefined && o.code !== null && typeof o.code !== 'object') {
        const data = o.data
        if (data != null && typeof data === 'object' && !Array.isArray(data)) {
            return data as Record<string, unknown>
        }
        return {}
    }
    return o
}

/** 備註輸入框預設最大長度（後端規則中無 remark.MaxLength 時使用） */
export const DEFAULT_REMARK_MAX_LENGTH = 128

/**
 * 從後端規則 map 中讀取某字段的 MaxLength[0].max（Bean Validation @MaxLength）。
 */
function extractRemarkMaxLengthFromFieldRules(payload: Record<string, unknown>, fieldName: string): number | null {
    const fieldRules = payload[fieldName]
    if (fieldRules == null || typeof fieldRules !== 'object' || Array.isArray(fieldRules)) return null
    const list = (fieldRules as Record<string, unknown>)['MaxLength']
    if (!Array.isArray(list) || list.length === 0) return null
    const first = list[0]
    if (first == null || typeof first !== 'object' || Array.isArray(first)) return null
    const max = (first as Record<string, unknown>)['max']
    if (max === undefined || max === null) return null
    const n = Number(max)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.floor(n)
}

/** 判断保存接口的 result 是否表示业务成功：仅当 code 为 200/0 或能解析出保存后的 id 时视为成功 */
function isSuccessfulSaveResponse(result: unknown): boolean {
    if (isApiSuccessResponse(result)) return true
    return getSavedIdFromResponse(result) != null
}

/** 从保存接口的 result（直接格式）中解析出主键 id（支持 { data: [entity], totalCount }、单实体、数组、或直接为 id） */
function getSavedIdFromResponse(data: unknown): string | number | null {
    const payload = getApiResponseData(data)
    if (payload !== data) return getSavedIdFromResponse(payload)
    if (data == null) return null
    if (typeof data === 'string' || typeof data === 'number') return data
    if (Array.isArray(data) && data.length > 0) {
        const first = data[0] as Record<string, unknown> | undefined
        return first != null && 'id' in first ? (first.id as string | number) : null
    }
    if (typeof data === 'object' && data !== null) {
        const o = data as Record<string, unknown>
        if ('id' in o && o.id !== undefined && o.id !== null) return o.id as string | number
        const list = o.data as unknown[] | undefined
        if (Array.isArray(list) && list.length > 0) {
            const first = list[0] as Record<string, unknown> | undefined
            return first != null && 'id' in first ? (first.id as string | number) : null
        }
    }
    return null
}

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

    /** 表单首次获焦时由守卫注册，用于 v-show 下编辑模式仅在有交互时才做关闭未保存提示 */
    public onFormInteraction: (() => void) | null = null

    /** 添加模式的初始 formModel 快照，用于从编辑切回添加时重置表单，避免误判未保存 */
    private initialFormModel: Record<string, unknown> = {}

    /** 新增/编辑校验规则是否已加载过（每种模式只请求一次 getCreateValidationRule / getUpdateValidationRule） */
    private _createValidationRuleLoaded: boolean = false
    private _updateValidationRuleLoaded: boolean = false

    /** @internal 新增时在此处 render + initValidationRule；编辑时不在此处拉数/规则，由 useAddEditDialogSetup 的 watch 统一触发，避免重复请求 */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.form = ref()
        const fm = this.state.formModel
        this.initialFormModel = fm && typeof fm === 'object' ? JSON.parse(JSON.stringify(fm)) : {}
        this.currentRid = props.rid ? String(props.rid) : ''
        if (props.rid) {
            // 编辑：由弹窗 watch 打开时统一调用 initValidationRule + reloadRowData，此处不请求
        } else {
            super.render()
            this.initValidationRule()
        }
    }

    /** 按当前 currentRid 重新加载编辑数据，供弹窗打开时或 rid 变化时调用 */
    public reloadRowData(): Promise<void> {
        return this.loadRowObject()
    }

    /** 将表单恢复为添加模式的初始空状态，用于先开编辑再开添加时清空上次编辑数据，避免关闭时误报未保存 */
    public resetFormForAdd(): void {
        const target = this.state.formModel as Record<string, unknown> | undefined
        if (!target || typeof target !== 'object') return
        const initial = this.initialFormModel
        for (const k in initial) {
            if (Object.prototype.hasOwnProperty.call(initial, k)) target[k] = initial[k]
        }
        const form = this.getFormInstance()
        if (form?.resetFields) form.resetFields()
    }

    protected initBaseState(): any {
        return {
            rules: null,
            /** 備註輸入 maxlength，由 initValidationRule 根據後端 MaxLength 規則覆寫 */
            remarkMaxLength: DEFAULT_REMARK_MAX_LENGTH,
        }
    }

    /**
     * 後端 getValidationRule 中備註字段名，默認 remark；若實體使用其它屬性名可覆寫。
     */
    protected getRemarkFieldNameForValidation(): string {
        return 'remark'
    }

    /** 根據規則 map 同步 state.remarkMaxLength */
    protected syncRemarkMaxLengthFromRulesPayload(payload: Record<string, unknown>): void {
        const n = extractRemarkMaxLengthFromFieldRules(payload, this.getRemarkFieldNameForValidation())
        this.state.remarkMaxLength = n != null ? n : DEFAULT_REMARK_MAX_LENGTH
    }

    /** 新增模式校验规则接口，默认 {root}/getCreateValidationRule，子类可重写。 */
    protected getCreateValidationRuleUrl(): string {
        return this.getRootActionPath() + "/getCreateValidationRule"
    }

    /** 编辑模式校验规则接口，默认 {root}/getUpdateValidationRule，子类可重写。 */
    protected getUpdateValidationRuleUrl(): string {
        return this.getRootActionPath() + "/getUpdateValidationRule"
    }

    /** 按当前模式返回校验规则接口：新增 -> getCreateValidationRule，编辑 -> getUpdateValidationRule。 */
    protected getValidationRuleUrl(): string {
        return this.isEditMode() ? this.getUpdateValidationRuleUrl() : this.getCreateValidationRuleUrl()
    }

    /** 公共校验提示 i18n：atomicServiceCode=sys, i18nTypeDictCode=valid-msg, namespace=default（应用级缓存，与后端 message 格式 atomicServiceCode.i18nTypeDictCode.namespace.key 对应） */
    protected getDefaultValidMsgI18nConfig(): { atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] } {
        return { atomicServiceCode: 'sys', i18nTypeDictCode: 'valid-msg', namespaces: ['default'] }
    }

    /**
     * 本页「view」类型校验相关 i18n 的命名空间，默认由 getRootActionPath() 转成点分（如 sys/tenant -> sys.tenant），子类可重写。
     * 与 getValidationModuleNamespace()（valid-msg 用的短模块名）不同。
     */
    protected getValidationI18nNamespace(): string | undefined {
        const path = this.getRootActionPath()
        return path ? path.replace(/\//g, '.') : undefined
    }

    /**
     * 本页 valid-msg 模块级命名空间：取 getRootActionPath() 最后一段（如 sys/cache -> cache；user/account -> account）。
     * 仅当路径至少两段时返回，否则 undefined（避免与仅一段路径重复加载）。
     */
    protected getValidationModuleNamespace(): string | undefined {
        const path = this.getRootActionPath()?.trim()
        if (!path) return undefined
        const segments = path.split('/').filter(Boolean)
        if (segments.length < 2) return undefined
        return segments[segments.length - 1]
    }

    /** 本页校验相关 batchGetI18ns 的 atomicServiceCode，默认取 getRootActionPath() 首段（上级目录，如 sys/cache -> sys），子类可重写 */
    protected getValidationI18nAtomicServiceCode(): string {
        const path = this.getRootActionPath()
        const first = path?.split('/')[0]
        return first || 'sys'
    }

    /** 新增用 save（POST），编辑用 update（PUT），子类可重写 */
    protected getSubmitUrl(): string {
        const base = this.getRootActionPath()
        return this.isEditMode() ? `${base}/update` : `${base}/save`
    }

    /** 新增用 post，编辑用 put，与 getSubmitUrl 对应 */
    protected getSubmitMethod(): 'post' | 'put' {
        return this.isEditMode() ? 'put' : 'post'
    }

    /** 是否为编辑模式（有 rid 视为编辑） */
    protected isEditMode(): boolean {
        const rid = this.props?.rid != null ? String(this.props.rid).trim() : ''
        return rid !== ''
    }

    /** 编辑拉数：原各模块多为 getDetail，现统一为 getEdit；仍用 /get 或专用接口的模块请重写本方法 */
    protected getRowObjectLoadUrl(): string {
        return this.getRootActionPath() + "/getEdit"
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

    /** 提交参数：合并 id（props.rid）与 state.formModel，子类可重写。保存时 id 为空串会置为 null。 */
    protected createSubmitParams(): any {
        const params: Record<string, any> = {
            id: this.props.rid
        }
        const model = this.state.formModel
        if (model) {
            for (const propName in model) {
                params[propName] = model[propName]
            }
        }
        if (params.id === '') params.id = null
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

    /** 请求 get 接口拉取编辑数据并 fillForm，成功时 render 并调用 onEditFormLoaded。仅支持后端直接返回实体（含 id 的对象） */
    protected async loadRowObject() {
        const params = this.createRowObjectLoadParams()
        const result = await backendRequest({ url: this.getRowObjectLoadUrl(), params })
        const payload = getApiResponseData(result)
        const rowData =
            typeof payload === 'object' && payload !== null && !Array.isArray(payload) && 'id' in payload
                ? payload
                : null
        if (rowData != null) {
            this.fillForm(rowData)
            super.render()
            this.onEditFormLoaded?.()
        } else {
            ElMessage.error(i18n.global.t(this.getLoadFailedMessageKey()) as string)
        }
    }

    /** 请求校验规则接口并生成 state.rules（ValidationRuleAdapter），供 el-form 使用。新增/编辑各自仅首次请求，后续复用。 */
    protected async initValidationRule(): Promise<any> {
        if (this.isEditMode()) {
            if (this._updateValidationRuleLoaded) return
        } else {
            if (this._createValidationRuleLoaded) return
        }

        const defaultCfg = this.getDefaultValidMsgI18nConfig()
        const atomic = this.getValidationI18nAtomicServiceCode()
        const moduleNs = this.getValidationModuleNamespace()
        /** 公共 valid-msg/default + 各模块 valid-msg/{模块名}；atomic 与公共配置相同时合并为一次请求 */
        const validationMsgConfigs: Array<{ atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] }> = []
        if (defaultCfg.atomicServiceCode === atomic) {
            const ns = [...defaultCfg.namespaces]
            if (moduleNs && !ns.includes(moduleNs)) ns.push(moduleNs)
            validationMsgConfigs.push({
                atomicServiceCode: atomic,
                i18nTypeDictCode: defaultCfg.i18nTypeDictCode,
                namespaces: ns,
            })
        } else {
            validationMsgConfigs.push({
                atomicServiceCode: defaultCfg.atomicServiceCode,
                i18nTypeDictCode: defaultCfg.i18nTypeDictCode,
                namespaces: [...defaultCfg.namespaces],
            })
            if (moduleNs) {
                validationMsgConfigs.push({
                    atomicServiceCode: atomic,
                    i18nTypeDictCode: defaultCfg.i18nTypeDictCode,
                    namespaces: [moduleNs],
                })
            }
        }
        await loadMessagesForConfig(validationMsgConfigs)

        const namespace = this.getValidationI18nNamespace()
        const pathKey = this.getRootActionPath()
        if (namespace && pathKey) {
            const cacheHolder = this.props.validationI18nCache as import('vue').Ref<Set<string>> | Set<string> | undefined
            await loadMessagesForValidationPage(
                this.getValidationI18nAtomicServiceCode(),
                'view',
                namespace,
                pathKey,
                cacheHolder
            )
        }

        let result: unknown
        try {
            // getCreateValidationRule / getUpdateValidationRule 均不带请求体
            result = await backendRequest({ url: this.getValidationRuleUrl() })
        } catch (_) {
            if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
                console.warn('[BaseAddEditPage] getValidationRule 请求失败，表单将无后端校验规则。', this.getValidationRuleUrl())
            }
            this.state.rules = {}
            this.state.remarkMaxLength = DEFAULT_REMARK_MAX_LENGTH
            return
        }

        const rulesPayload = extractValidationRulesPayload(getApiResponseData(result))
        this.state.rules = new ValidationRuleAdapter(
            rulesPayload,
            () => this.getFormInstance()?.model,
            'blur',
            () => i18n.global.t('addEditPage.defaultValidationMessage') as string
        ).getRules()
        this.syncRemarkMaxLengthFromRulesPayload(rulesPayload)

        if (this.isEditMode()) this._updateValidationRuleLoaded = true
        else this._createValidationRuleLoaded = true
    }

    /**
     * 切换语言后重新拉取当前模式下的校验规则（清除「仅首次请求」缓存并再次请求后端）。
     * 供 useAddEditDialogSetup 监听 locale 时调用。
     */
    public async reloadValidationRulesForLocaleChange(): Promise<void> {
        this._createValidationRuleLoaded = false
        this._updateValidationRuleLoaded = false
        await this.initValidationRule()
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
                backendRequest({ url: this.getSubmitUrl(), method: this.getSubmitMethod(), params })
                    .then(async (result) => {
                        if (result != null && isSuccessfulSaveResponse(result)) {
                            ElMessage.success(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (i18n.global.t('addEditPage.saveSuccess') as string))
                            const form = this.getFormInstance()
                            if (form?.resetFields) form.resetFields()
                            params.id = getSavedIdFromResponse(result)
                            if (typeof this.props?.onSaved === 'function') this.props.onSaved(params)
                            this.context.emit('response', params)
                            nextTick(() => this.doClose())
                        } else {
                            const msg = await resolveApiResponseMessage(result)
                                || getApiResponseMessage(result)
                                || (i18n.global.t('addEditPage.saveFailed') as string)
                            ElMessage.error(msg)
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
