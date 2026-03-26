import { ElMessage } from "element-plus"
import { nextTick, ref } from "vue"
import { ValidationRuleAdapter } from "../../validation/ValidationRuleAdapter"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, getApiFailureMessage, isApiSuccessResponse, resolveApiFailureMessage, resolveApiResponseMessage } from "../../../utils/backendRequest"
import { i18n, loadMessagesForConfig, loadMessagesForValidationPage } from "../../../i18n"

function extractValidationRulesPayload(result: unknown): Record<string, unknown> {
    if (result == null || typeof result !== 'object' || Array.isArray(result)) return {}
    const o = result as Record<string, unknown>
    if (o.code !== undefined && o.code !== null && typeof o.code !== 'object') {
        const data = o.data
        if (data != null && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
        return {}
    }
    return o
}
export const DEFAULT_REMARK_MAX_LENGTH = 128
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
function isSuccessfulSaveResponse(result: unknown): boolean { return isApiSuccessResponse(result) }
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

export abstract class BaseAddEditPage extends BasePage {
    public form: any
    public currentRid: string = ''
    public onEditFormLoaded: (() => void) | null = null
    public onFormInteraction: (() => void) | null = null
    private initialFormModel: Record<string, unknown> = {}
    private initialEditFormSnapshot: Record<string, unknown> | null = null
    private _createValidationRuleLoaded: boolean = false
    private _updateValidationRuleLoaded: boolean = false

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        super(props, context)
        this.form = ref()
        const fm = this.state.formModel
        this.initialFormModel = fm && typeof fm === 'object' ? JSON.parse(JSON.stringify(fm)) : {}
        this.currentRid = props.rid ? String(props.rid) : ''
        if (!props.rid) { super.render(); this.initValidationRule() }
    }

    public reloadRowData(): Promise<void> { return this.loadRowObject() }
    public resetFormForAdd(): void {
        const target = this.state.formModel as Record<string, unknown> | undefined
        if (!target || typeof target !== 'object') return
        const initial = this.initialFormModel
        for (const k in initial) if (Object.prototype.hasOwnProperty.call(initial, k)) target[k] = initial[k]
        this.initialEditFormSnapshot = null
        const form = this.getFormInstance()
        if (form?.resetFields) form.resetFields()
    }
    private deepNormalize(value: unknown): unknown {
        if (value === undefined || (typeof value === 'number' && Number.isNaN(value))) return null
        if (value === null || typeof value !== 'object') return value
        if (Array.isArray(value)) return value.map((item) => this.deepNormalize(item))
        const o: Record<string, unknown> = {}
        for (const k in value as Record<string, unknown>) o[k] = this.deepNormalize((value as Record<string, unknown>)[k])
        return o
    }
    private takeEditSnapshot(): void {
        const model = this.state.formModel as Record<string, unknown> | undefined
        if (!model || typeof model !== 'object') { this.initialEditFormSnapshot = null; return }
        const normalized = this.deepNormalize(model) as Record<string, unknown>
        this.initialEditFormSnapshot = JSON.parse(JSON.stringify(normalized))
    }
    protected isEditFormDirty(): boolean {
        if (!this.isEditMode()) return true
        const model = this.state.formModel as Record<string, unknown> | undefined
        if (!model || typeof model !== 'object') return false
        if (this.initialEditFormSnapshot == null) return true
        return JSON.stringify(this.deepNormalize(model)) !== JSON.stringify(this.initialEditFormSnapshot)
    }

    protected initBaseState(): any { return { rules: null, remarkMaxLength: DEFAULT_REMARK_MAX_LENGTH } }
    protected getRemarkFieldNameForValidation(): string { return 'remark' }
    protected syncRemarkMaxLengthFromRulesPayload(payload: Record<string, unknown>): void {
        const n = extractRemarkMaxLengthFromFieldRules(payload, this.getRemarkFieldNameForValidation())
        this.state.remarkMaxLength = n != null ? n : DEFAULT_REMARK_MAX_LENGTH
    }
    protected getCreateValidationRuleUrl(): string { return this.getRootActionPath() + "/getCreateValidationRule" }
    protected getUpdateValidationRuleUrl(): string { return this.getRootActionPath() + "/getUpdateValidationRule" }
    protected getValidationRuleUrl(): string { return this.isEditMode() ? this.getUpdateValidationRuleUrl() : this.getCreateValidationRuleUrl() }
    protected getDefaultValidMsgI18nConfig(): { atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] } { return { atomicServiceCode: 'sys', i18nTypeDictCode: 'valid-msg', namespaces: ['default'] } }
    protected getValidationI18nNamespace(): string | undefined {
        const path = this.getRootActionPath(); return path ? path.replace(/\//g, '.') : undefined
    }
    protected getValidationModuleNamespace(): string | undefined {
        const path = this.getRootActionPath()?.trim(); if (!path) return undefined
        const segments = path.split('/').filter(Boolean); if (segments.length < 2) return undefined
        return segments[segments.length - 1]
    }
    protected getValidationI18nAtomicServiceCode(): string {
        const path = this.getRootActionPath(); const first = path?.split('/')[0]; return first || 'sys'
    }
    protected getSubmitUrl(): string { const base = this.getRootActionPath(); return this.isEditMode() ? `${base}/update` : `${base}/save` }
    protected getSubmitMethod(): 'post' | 'put' { return this.isEditMode() ? 'put' : 'post' }
    protected isEditMode(): boolean { const rid = this.props?.rid != null ? String(this.props.rid).trim() : ''; return rid !== '' }
    protected getRowObjectLoadUrl(): string { return this.getRootActionPath() + "/getEdit" }
    protected getLoadFailedMessageKey(): string { return 'addEditPage.loadFailed' }
    protected createRequiredRules(fieldToKey: Record<string, string>, triggerByField?: Partial<Record<string, 'blur' | 'change'>>): Record<string, Array<{ required: boolean; validator: (rule: any, value: any, callback: (err?: Error) => void) => void; trigger: string }>> {
        const rules: Record<string, Array<{ required: boolean; validator: (rule: any, value: any, callback: (err?: Error) => void) => void; trigger: string }>> = {}
        for (const field of Object.keys(fieldToKey)) {
            const i18nKey = fieldToKey[field]; const trigger = triggerByField?.[field] ?? 'blur'
            rules[field] = [{ required: true, validator: (_rule: any, value: unknown, callback: (err?: Error) => void) => value !== undefined && value !== null && String(value).trim() !== '' ? callback() : callback(new Error((i18n.global.t(i18nKey) as string) || '')), trigger }]
        }
        return rules
    }
    protected createSubmitParams(): any {
        const params: Record<string, any> = { id: this.props.rid }
        const model = this.state.formModel
        if (model) for (const propName in model) params[propName] = model[propName]
        if (params.id === '') params.id = null
        return params
    }
    protected fillForm(rowObject: any) { for (const propName in rowObject) if (propName in this.state.formModel) this.state.formModel[propName] = rowObject[propName] }
    protected createRowObjectLoadParams(): any { const rid = this.currentRid || (this.props.rid ? String(this.props.rid) : ''); return { id: rid } }
    protected async loadRowObject() {
        const params = this.createRowObjectLoadParams()
        const result = await backendRequest({ url: this.getRowObjectLoadUrl(), params })
        const payload = getApiResponseData(result)
        const rowData = typeof payload === 'object' && payload !== null && !Array.isArray(payload) && 'id' in payload ? payload : null
        if (rowData != null) { this.fillForm(rowData); this.takeEditSnapshot(); super.render(); this.onEditFormLoaded?.() }
        else ElMessage.error(i18n.global.t(this.getLoadFailedMessageKey()) as string)
    }
    protected async initValidationRule(): Promise<any> {
        if (this.isEditMode()) { if (this._updateValidationRuleLoaded) return } else { if (this._createValidationRuleLoaded) return }
        const defaultCfg = this.getDefaultValidMsgI18nConfig()
        const atomic = this.getValidationI18nAtomicServiceCode()
        const moduleNs = this.getValidationModuleNamespace()
        const validationMsgConfigs: Array<{ atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] }> = []
        if (defaultCfg.atomicServiceCode === atomic) {
            const ns = [...defaultCfg.namespaces]; if (moduleNs && !ns.includes(moduleNs)) ns.push(moduleNs)
            validationMsgConfigs.push({ atomicServiceCode: atomic, i18nTypeDictCode: defaultCfg.i18nTypeDictCode, namespaces: ns })
        } else {
            validationMsgConfigs.push({ atomicServiceCode: defaultCfg.atomicServiceCode, i18nTypeDictCode: defaultCfg.i18nTypeDictCode, namespaces: [...defaultCfg.namespaces] })
            if (moduleNs) validationMsgConfigs.push({ atomicServiceCode: atomic, i18nTypeDictCode: defaultCfg.i18nTypeDictCode, namespaces: [moduleNs] })
        }
        await loadMessagesForConfig(validationMsgConfigs)
        const namespace = this.getValidationI18nNamespace()
        const pathKey = this.getRootActionPath()
        if (namespace && pathKey) {
            const cacheHolder = this.props.validationI18nCache as import('vue').Ref<Set<string>> | Set<string> | undefined
            await loadMessagesForValidationPage(this.getValidationI18nAtomicServiceCode(), 'view', namespace, pathKey, cacheHolder)
        }
        let result: unknown
        try { result = await backendRequest({ url: this.getValidationRuleUrl() }) }
        catch (_) { this.state.rules = {}; this.state.remarkMaxLength = DEFAULT_REMARK_MAX_LENGTH; return }
        const rulesPayload = extractValidationRulesPayload(getApiResponseData(result))
        this.state.rules = new ValidationRuleAdapter(rulesPayload, () => this.getFormInstance()?.model, 'blur', () => i18n.global.t('addEditPage.defaultValidationMessage') as string).getRules()
        this.syncRemarkMaxLengthFromRulesPayload(rulesPayload)
        if (this.isEditMode()) this._updateValidationRuleLoaded = true
        else this._createValidationRuleLoaded = true
    }
    public async reloadValidationRulesForLocaleChange(): Promise<void> {
        this._createValidationRuleLoaded = false
        this._updateValidationRuleLoaded = false
        await this.initValidationRule()
    }
    protected beforeValidate() {}
    public submit: () => void
    protected getFormInstance(): any {
        const f = this.form
        if (!f) return null
        if (typeof f.validate === 'function') return f
        return f?.value ?? null
    }
    protected doSubmit() {
        try {
            const formInstance = this.getFormInstance()
            if (!formInstance || typeof formInstance.validate !== 'function') { ElMessage.error(i18n.global.t('addEditPage.formNotReady') as string); return }
            if (this.isEditMode() && !this.isEditFormDirty()) { ElMessage.info(i18n.global.t('addEditPage.noChangeToSave') as string); return }
            this.beforeValidate()
            formInstance.validate((valid: boolean) => {
                if (!valid) { ElMessage.error(i18n.global.t('addEditPage.validationFailed') as string); return }
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
                            const msg = await resolveApiFailureMessage(result) || getApiFailureMessage(result) || await resolveApiResponseMessage(result) || getApiResponseMessage(result) || (i18n.global.t('addEditPage.saveFailed') as string)
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
    protected doClose() {
        super.doClose()
        const form = this.getFormInstance()
        if (form?.resetFields) form.resetFields()
    }
    protected convertThis() {
        super.convertThis()
        this.submit = () => this.doSubmit()
    }
}
