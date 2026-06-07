import { ElMessage } from "element-plus"
import { nextTick, ref } from "vue"
import { ValidationRuleAdapter } from "../../validation/ValidationRuleAdapter"
import { BasePage } from "./BasePage"
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage, resolveSaveFailureHint } from "../../../utils/backendRequest"
import { loadMessagesForConfig, loadMessagesForValidationPage, tGlobal } from "../../../i18n"

/**
 * Unwraps the backend validation-rule response into a plain field→rules map.
 * The backend may return either a raw rules object or a standard API envelope
 * ({ code, data }). When an envelope is detected (primitive `code` present) the
 * inner `data` object is returned; otherwise the object itself is used as-is.
 */
function extractValidationRulesPayload(result: unknown): Record<string, unknown> {
    if (result == null || typeof result !== 'object' || Array.isArray(result)) return {}
    const o = result as Record<string, unknown>
    if (o.code !== undefined && o.code !== null && typeof o.code !== 'object') {
        // Standard API envelope — extract the nested data payload.
        const data = o.data
        if (data != null && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
        return {}
    }
    return o
}

/** Default max-length for remark/note fields when no server rule overrides it. */
export const DEFAULT_REMARK_MAX_LENGTH = 128

/**
 * Reads the `MaxLength[0].max` value from the server-provided validation rules
 * for a specific field. Returns `null` if the rule is absent or malformed.
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

/**
 * Extracts the saved record's `id` from a successful save response.
 * The backend may return the id as a bare primitive, inside a standard API
 * envelope (unwrapped via `getApiResponseData`), directly on a `{ id }` object,
 * or as the first element of a result list. Returns `null` when no id is found.
 */
function getSavedIdFromResponse(data: unknown): string | number | null {
    // Unwrap one level of API envelope if present.
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
        // Some endpoints nest the list under a secondary `data` key.
        const list = o.data as unknown[] | undefined
        if (Array.isArray(list) && list.length > 0) {
            const first = list[0] as Record<string, unknown> | undefined
            return first != null && 'id' in first ? (first.id as string | number) : null
        }
    }
    return null
}

/**
 * Base class for Add / Edit dialog pages.
 *
 * Concrete subclasses must implement `getRootActionPath()` (from BasePage) and
 * may override `getSubmitUrl`, `getSubmitMethod`, `createSubmitParams`, etc. to
 * customise request construction.  The class wires form validation, dirty-state
 * tracking, and locale-aware validation message loading automatically.
 */
export abstract class BaseAddEditPage extends BasePage {
    /** Template ref for the root ElForm instance. */
    public form: any
    /** The record id passed via props (empty string in create mode). */
    public currentRid: string = ''
    /** Optional callback invoked after the edit-mode row data has been loaded and the form rendered. */
    public onEditFormLoaded: (() => void) | null = null
    /** Optional callback invoked on any user interaction with the form. */
    public onFormInteraction: (() => void) | null = null
    /** Snapshot of the initial (blank) form model used to reset the form after a successful create. */
    private initialFormModel: Record<string, unknown> = {}
    /** Deep-normalized snapshot of the form model taken after loading edit data; used for dirty detection. */
    private initialEditFormSnapshot: Record<string, unknown> | null = null
    /** Guards against fetching create-mode validation rules more than once per page lifecycle. */
    private _createValidationRuleLoaded: boolean = false
    /** Guards against fetching update-mode validation rules more than once per page lifecycle. */
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
        for (const k in initial) {
            if (!Object.prototype.hasOwnProperty.call(initial, k)) continue
            const v = initial[k]
            target[k] = v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v
        }
        this.initialEditFormSnapshot = null
        const form = this.getFormInstance()
        /** Do not call resetFields here: el-form writes back to model from each field's mount-time initialValue, which on dialog reuse is often the previous input and would override the reset above. */
        if (form?.clearValidate) form.clearValidate()
    }
    /**
     * Recursively converts `undefined` and `NaN` to `null` so that the model
     * can be safely serialised with `JSON.stringify` for dirty-state comparison.
     * (`JSON.stringify` silently drops `undefined` keys and turns `NaN` into
     * `null`, which would produce false "dirty" signals on a round-trip.)
     */
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
    protected getDefaultValidMsgI18nConfig(): { atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] } {
        return { atomicServiceCode: 'sys', i18nTypeDictCode: 'valid-msg', namespaces: ['default', 'accessrule'] }
    }
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
            rules[field] = [{ required: true, validator: (_rule: any, value: unknown, callback: (err?: Error) => void) => value !== undefined && value !== null && String(value).trim() !== '' ? callback() : callback(new Error(tGlobal(i18nKey) || '')), trigger }]
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
        else ElMessage.error(tGlobal(this.getLoadFailedMessageKey()))
    }
    /**
     * Loads i18n validation messages and the server-driven validation rule set for
     * the current mode (create vs. update), then builds Element Plus form rules via
     * `ValidationRuleAdapter`.  Idempotent: successive calls within the same mode
     * are no-ops once rules have been successfully loaded.
     *
     * I18n namespace strategy:
     * - When the module's atomic-service code matches the shared default config, the
     *   module namespace is appended to the default namespace list (single request).
     * - When they differ, two separate config entries are pushed so that messages for
     *   both the shared defaults and the module-specific service are fetched.
     */
    protected async initValidationRule(): Promise<any> {
        // Skip if rules for the current mode have already been fetched.
        if (this.isEditMode()) { if (this._updateValidationRuleLoaded) return } else { if (this._createValidationRuleLoaded) return }
        const defaultCfg = this.getDefaultValidMsgI18nConfig()
        const atomic = this.getValidationI18nAtomicServiceCode()
        const moduleNs = this.getValidationModuleNamespace()
        const validationMsgConfigs: Array<{ atomicServiceCode: string; i18nTypeDictCode: string; namespaces: string[] }> = []
        if (defaultCfg.atomicServiceCode === atomic) {
            // Same service: merge the module namespace into the default namespace list.
            const ns = [...defaultCfg.namespaces]
            if (moduleNs && !ns.includes(moduleNs)) ns.push(moduleNs)
            validationMsgConfigs.push({ atomicServiceCode: atomic, i18nTypeDictCode: defaultCfg.i18nTypeDictCode, namespaces: ns })
        } else {
            // Different services: fetch each independently.
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
        // Element Plus 2's ElForm ref does not expose the model; cross-field rules
        // (e.g. Compare) therefore read state.formModel directly via the accessor lambda.
        this.state.rules = new ValidationRuleAdapter(rulesPayload, () => this.state.formModel, 'blur', () => tGlobal('addEditPage.defaultValidationMessage')).getRules()
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
    public submit!: () => void
    protected getFormInstance(): any {
        const f = this.form
        if (!f) return null
        if (typeof f.validate === 'function') return f
        return f?.value ?? null
    }
    /**
     * Validates the form and, if valid, POSTs (create) or PUTs (edit) the model to
     * the backend.  On success, emits `response` with the saved params (including
     * the resolved id) and closes the dialog.  Dirty-state guard prevents
     * unnecessary network calls when no fields have changed in edit mode.
     */
    protected doSubmit() {
        try {
            const formInstance = this.getFormInstance()
            if (!formInstance || typeof formInstance.validate !== 'function') { ElMessage.error(tGlobal('addEditPage.formNotReady')); return }
            if (this.isEditMode() && !this.isEditFormDirty()) { ElMessage.info(tGlobal('addEditPage.noChangeToSave')); return }
            this.beforeValidate()
            formInstance.validate((valid: boolean) => {
                if (!valid) { ElMessage.error(tGlobal('addEditPage.validationFailed')); return }
                const params = this.createSubmitParams()
                if (!params) return
                backendRequest({ url: this.getSubmitUrl(), method: this.getSubmitMethod(), params })
                    .then(async (result) => {
                        if (result != null && isApiSuccessResponse(result)) {
                            ElMessage.success(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tGlobal('addEditPage.saveSuccess'))
                            const form = this.getFormInstance()
                            if (!this.isEditMode()) {
                                // Create mode: restore the blank form so the dialog is ready for another entry.
                                this.resetFormForAdd()
                            } else if (form?.resetFields) {
                                // Edit mode: clear field-level validation state after a successful save.
                                form.resetFields()
                            }
                            // Attach the persisted id to the params emitted to the parent.
                            params.id = getSavedIdFromResponse(result)
                            if (typeof this.props?.onSaved === 'function') this.props.onSaved(params)
                            this.context.emit('response', params)
                            nextTick(() => this.doClose())
                        } else {
                            try {
                                const hint = await resolveSaveFailureHint(result)
                                ElMessage.error(
                                    hint != null && hint !== ''
                                        ? hint
                                        : tGlobal('addEditPage.saveFailed')
                                )
                            } catch {
                                ElMessage.error(tGlobal('addEditPage.saveFailed'))
                            }
                        }
                    })
                    .catch((e) => {
                        const msg = e instanceof Error ? e.message : tGlobal('addEditPage.requestFailed')
                        ElMessage.error(typeof msg === 'string' ? msg : tGlobal('addEditPage.requestFailed'))
                    })
            })
        } catch (e) {
            const msg = e instanceof Error ? e.message : tGlobal('addEditPage.submitError')
            ElMessage.error(typeof msg === 'string' ? msg : tGlobal('addEditPage.submitError'))
        }
    }
    protected doClose() {
        super.doClose()
        const form = this.getFormInstance()
        if (form?.clearValidate) form.clearValidate()
    }
    protected convertThis() {
        super.convertThis()
        this.submit = () => this.doSubmit()
    }
}
