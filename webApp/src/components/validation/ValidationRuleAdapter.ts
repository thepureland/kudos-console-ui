import { backendRequest, getApiFailureMessage, isApiSuccessResponse } from "../../utils/backendRequest";
import { tGlobal } from "../../i18n";

/** Backend `ruleDetail` fields vary by validation annotation; keep an index type to carry dynamic rule metadata. */
type RuleDetail = Record<string, any>
type RuleDetails = RuleDetail[]
/** The async-validator rule object is populated incrementally by different parsers with fields like type/validator/message. */
type ValidatorRule = Record<string, any>

/**
 * Validation rule adapter that converts validation rules returned by the server into async-validator rules.
 * Validation rule i18n is provided entirely by the backend: `message` is a full key
 * (atomicServiceCode.i18nTypeDictCode.namespace.key); after being merged into vue-i18n it becomes
 * i18nTypeDictCode.namespace.key. Here we only translate using the key with its first segment stripped —
 * we no longer look up frontend copy by the full key.
 *
 * @author K
 * @since 1.0.0
 */
export class ValidationRuleAdapter {

    private remoteRules: Record<string, Record<string, RuleDetails>>
    private getModel: () => Record<string, any>
    private destRules: Record<string, ValidatorRule[]> = {}
    private trigger: string

    /** Fields used for vue-i18n named interpolation and `{xxx}` placeholder replacement (aligned with common backend `ruleDetail` fields). */
    private static messageInterpolationKeys = [
        'min', 'max', 'value', 'integer', 'fraction', 'regexp', 'size', 'step', 'type', 'inclusive',
        'anotherProperty', 'logic', 'host', 'port', 'protocol',
        'days', 'hours', 'minutes', 'seconds', 'millis', 'nanos',
    ] as const

    private static buildMessageInterpolationParams(detail: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
        if (!detail || typeof detail !== 'object') return undefined
        const out: Record<string, unknown> = {}
        for (const k of ValidationRuleAdapter.messageInterpolationKeys) {
            if (detail[k] !== undefined && detail[k] !== null) out[k] = detail[k]
        }
        return Object.keys(out).length ? out : undefined
    }

    /**
     * Convert the backend `message` into display text: for a four-segment key, strip the first segment and translate;
     * otherwise return as-is (the backend copy).
     * @param detail The first `ruleDetail`, used for `t(key, { min, max, ... })` so placeholders are not blanked out by i18n.
     */
    private static resolveMessage(raw: string | null | undefined, detail?: Record<string, unknown> | null): string {
        if (raw == null || typeof raw !== 'string' || raw === '') return ''
        const parts = raw.split('.')
        if (parts.length >= 4) {
            const keyWithoutAtomic = parts.slice(1).join('.')
            const params = ValidationRuleAdapter.buildMessageInterpolationParams(detail ?? null)
            const out = params ? tGlobal(keyWithoutAtomic, params) : tGlobal(keyWithoutAtomic)
            return out !== keyWithoutAtomic ? out : raw
        }
        return raw
    }

    /**
     * Replace placeholders like `{min}`, `{max}`, `{value}` in the text with the same-named fields from `ruleDetail`
     * (avoids placeholders being blanked out when `t(key)` is called without params).
     */
    private static interpolateMessagePlaceholders(template: string, detail: Record<string, unknown> | null | undefined): string {
        if (!template || detail == null || typeof detail !== 'object') return template
        let out = template
        for (const k of ValidationRuleAdapter.messageInterpolationKeys) {
            if (detail[k] === undefined || detail[k] === null) continue
            const v = detail[k]
            const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
            out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), str)
        }
        return out
    }

    /** resolveMessage plus placeholder replacement using the first `ruleDetail` (for non-i18n direct text, or when translated text still contains `{xxx}`). */
    private static resolveMessageWithDetail(raw: string | null | undefined, detail: Record<string, unknown> | null | undefined): string {
        const resolved = ValidationRuleAdapter.resolveMessage(raw, detail ?? null)
        return ValidationRuleAdapter.interpolateMessagePlaceholders(resolved, detail ?? undefined)
    }

    /**
     * Constructor for the validation rule adapter.
     *
     * @param remoteRules The validation-rules object returned by the server.
     * @param getModel Function that returns the object to validate.
     * @param trigger The validation rule trigger.
     * @param getDefaultMessage Default message used when the server does not return a `message` (i18n-friendly).
     */
    constructor(remoteRules: any, getModel: () => Record<string, any>, trigger = 'blur', getDefaultMessage?: () => string) {
        // Backend failures or older APIs may not return a rules object; an empty object lets the form keep rendering without attaching remote rules.
        this.remoteRules = remoteRules ?? {}
        this.getModel = getModel
        this.trigger = trigger
        this.getDefaultMessage = getDefaultMessage ?? (() => 'Validation failed')
    }

    private getDefaultMessage: () => string

    /**
     * Return the async-validator rules object.
     */
    getRules(): any {
        for (let propName in this.remoteRules) {
            const rules = this.remoteRules[propName]
            for (let ruleName in rules) {
                this.parseRule(ruleName, propName, rules)
            }
        }
        return this.destRules
    }

    private parseRule(ruleName: string, propName: string, rules: Record<string, RuleDetails>) {
        const ruleDetails: RuleDetails = rules[ruleName]
        if (!Array.isArray(ruleDetails) || ruleDetails.length === 0) {
            return
        }
        if (!this.destRules[propName]) {
            this.destRules[propName] = []
        }
        const rule: ValidatorRule = {trigger: this.trigger}
        this.doParseRule(ruleName, propName, ruleDetails, rule)
        if (!rule["message"]) {
            const firstDetail = ruleDetails[0]
            const raw = firstDetail && firstDetail["message"] != null ? firstDetail["message"] : null
            rule["message"] =
                raw != null
                    ? ValidationRuleAdapter.resolveMessageWithDetail(raw, firstDetail as Record<string, unknown>)
                    : this.getDefaultMessage()
        }
        this.destRules[propName].push(rule)
    }

    private doParseRule(ruleName: string, propName: string, ruleDetails: RuleDetails, rule: ValidatorRule) {
        switch (ruleName) {
            case "Null":
                this.null(propName, ruleDetails, rule)
                break
            case "NotNull":
                this.notNull(propName, ruleDetails, rule)
                break
            case "NotEmpty":
                this.notEmpty(propName, ruleDetails, rule)
                break
            case "NotBlank":
                this.notBlank(propName, ruleDetails, rule)
                break
            case "AssertTrue":
                this.assertTrue(propName, ruleDetails, rule)
                break
            case "AssertFalse":
                this.assertFalse(propName, ruleDetails, rule)
                break
            case "CodePointLength":
                this.codePointLength(propName, ruleDetails, rule)
                break
            case "Remote":
                this.remote(propName, ruleDetails, rule)
                break
            case "Length":
                this.length(propName, ruleDetails, rule)
                break
            // MaxLength: equivalent to a Length rule with only `max` specified (string).
            case "MaxLength":
                this.maxLength(propName, ruleDetails, rule)
                break
            case "Compare":
                this.compare(propName, ruleDetails)
                break
            case "Pattern":
                this.pattern(propName, ruleDetails, rule)
                break
            case "Email":
                this.email(propName, ruleDetails, rule)
                break
            case "Min":
                this.min(propName, ruleDetails, rule)
                break
            case "Max":
                this.max(propName, ruleDetails, rule)
                break
            case "Past":
                this.past(propName, ruleDetails, rule)
                break
            case "Future":
                this.future(propName, ruleDetails, rule)
                break
            case "PastOrPresent":
                this.pastOrPresent(propName, ruleDetails, rule)
                break
            case "FutureOrPresent":
                this.futureOrPresent(propName, ruleDetails, rule)
                break
            case "DurationMin":
                this.durationMin(propName, ruleDetails, rule)
                break
            case "DurationMax":
                this.durationMax(propName, ruleDetails, rule)
                break
            case "DecimalMin":
                this.decimalMin(propName, ruleDetails, rule)
                break
            case "DecimalMax":
                this.decimalMax(propName, ruleDetails, rule)
                break
            case "Range":
                this.range(propName, ruleDetails, rule)
                break
            case "Digits":
                this.digits(propName, ruleDetails, rule)
                break
            case "Positive":
                this.positive(propName, ruleDetails, rule)
                break
            case "Negative":
                this.negative(propName, ruleDetails, rule)
                break
            case "PositiveOrZero":
                this.positiveOrZero(propName, ruleDetails, rule)
                break
            case "NegativeOrZero":
                this.negativeOrZero(propName, ruleDetails, rule)
                break
            case "CreditCardNumber":
                this.luhnCheck(propName, ruleDetails, rule)
                break
            case "Currency":
                this.currency(propName, ruleDetails, rule)
                break
            case "EAN":
                this.ean(propName, ruleDetails, rule)
                break
            case "LuhnCheck":
                this.luhnCheck(propName, ruleDetails, rule)
                break
            case "Mod10Check":
                this.mod10Check(propName, ruleDetails, rule)
                break
            case "Mod11Check":
                this.mod11Check(propName, ruleDetails, rule)
                break
            case "ISBN":
                this.isbn(propName, ruleDetails, rule)
                break
            case "ParameterScriptAssert":
                this.parameterScriptAssert(propName, ruleDetails, rule)
                break
            case "URL":
                this.url(propName, ruleDetails, rule)
                break
            case "Size":
                this.size(propName, ruleDetails, rule)
                break
            // MaxSize: equivalent to a Size rule with only `max` specified.
            case "MaxSize":
                this.maxSize(propName, ruleDetails, rule)
                break
            case "DictEnumCode":
                this.dictEnumCode(propName, ruleDetails, rule)
                break
            case "Series":
                this.series(propName, ruleDetails, rule)
                break
            case "NotNullOn":
                this.notNullOn(propName, ruleDetails, rule)
                break
            case "Each":
                this.each(propName, ruleDetails, rule)
                break
            case "Exist":
                this.exist(propName, ruleDetails, rule)
                break
            case "UniqueElements":
                this.uniqueElements(propName, ruleDetails, rule)
                break
        }
    }

    /** Use the callback form so `rule.message` is shown on failure (async-validator may not display text when validators merely `return false`). */
    private static validatorWithMessage(rule: any, _value: any, callback: (err?: Error) => void, pass: boolean) {
        if (pass) callback()
        else callback(new Error(rule?.message || ''))
    }

    /** Null constraint; the target value may be of any type. */
    private null(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, value == null || value == '')
    }

    /** NotNull constraint; the target value may be of any type. */
    private notNull(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, value != null && value != '')
    }

    /** NotEmpty constraint; target type must be one of: string, array, Set, Map. */
    private notEmpty(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, !this.isEmpty(value))
    }

    /** NotBlank constraint; target type must be string. */
    private notBlank(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "string"
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, value != null && String(value).trim() !== '')
    }

    /** AssertTrue constraint; target type must be Boolean with value `true`, or a string `"true"`. */
    private assertTrue(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, value == null || value == '' || value == true || value == "true")
    }

    /** AssertFalse constraint; target type must be Boolean with value `false`, or a string `"false"`. */
    private assertFalse(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (r: any, value: any, callback: (err?: Error) => void) =>
            ValidationRuleAdapter.validatorWithMessage(r, value, callback, value == null || value == '' || value == false || value == "false")
    }

    /** String code-point length (actual character count) constraint; target type must be string. */
    private codePointLength(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "string"
        rule["validator"] = (rule: any, value: any) => {
            return value == null || value == '' || value.length >= ruleDetails[0].min && value.length <= ruleDetails[0].max
        }
    }

    /** Remote validation. */
    private remote(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["asyncValidator"] = (_rule: any, value: any) => {
            return new Promise<void>(async (resolve, reject) => {
                if (value == null || value == '') {
                    resolve()
                    return
                }
                const params: Record<string, any> = {}
                params[propName] = value

                const result = await backendRequest({url: ruleDetails[0].requestUrl, params})
                if (isApiSuccessResponse(result)) {
                    resolve()
                } else {
                    reject(
                        getApiFailureMessage(result)
                        || ValidationRuleAdapter.resolveMessageWithDetail(
                            ruleDetails[0]["message"],
                            ruleDetails[0] as Record<string, unknown>,
                        ),
                    )
                }
            });
        }
    }

    /** String length constraint; target type must be string. */
    private length(propName: string, ruleDetails: Array<any>, rule: any) {
        this.codePointLength(propName, ruleDetails, rule)
    }

    /**
     * Max-length constraint (equivalent to a Length rule with only `max` specified); target type is string.
     * `ruleDetails[0].max`: maximum length (inclusive).
     */
    private maxLength(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "string"
        const max = ruleDetails[0]["max"]
        rule["validator"] = (rule: any, value: any) => {
            if (value == null || value === "") return true
            if (!this.isString(value)) return false
            const n = Number(max)
            if (max === undefined || max === null || Number.isNaN(n)) return true
            return String(value).length <= n
        }
    }

    /** Compare constraint; supports array types, but both arrays must have the same size. */
    private compare(propName: string, ruleDetails: Array<any>) {
        ruleDetails.forEach((ruleDetail) => {
            const rule: ValidatorRule = {}
            rule["asyncValidator"] = (_r: any, value: any) => {
                return new Promise<void>((resolve, reject) => {
                    if (value == null) {
                        resolve()
                        return
                    }

                    // Evaluate the depends condition first.
                    const depends = ruleDetail["depends"]
                    if (depends) {
                        if (this.isDependsNotPass(depends)) {
                            // Depends condition not met — skip the compare; resolve (pass) rather than leaving the
                            // promise pending. `return true` is a no-op inside a Promise executor.
                            resolve()
                            return
                        }
                    }

                    // If there is no depends condition, or its expression holds, run the Compare logic.
                    const anotherProperty = ruleDetail["anotherProperty"]
                    const model = typeof this.getModel === "function" ? this.getModel() : null
                    if (model == null || typeof model !== "object") {
                        reject(this.getDefaultMessage())
                        return
                    }
                    const anotherValue = (model as Record<string, unknown>)[anotherProperty as string]
                    const logic = ruleDetail["logic"]
                    const result = this.compareTwoValue(logic, value, anotherValue)
                    if (!result) {
                        reject(
                            ValidationRuleAdapter.resolveMessageWithDetail(
                                ruleDetail["message"],
                                ruleDetail as Record<string, unknown>,
                            ),
                        )
                    } else {
                        resolve()
                    }
                });
            }
            this.destRules[propName].push(rule)
        })
    }

    /** Pattern constraint; target type must be string. */
    private pattern(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "string"
        rule["validator"] = (rule: any, value: any) => {
            return this.isEmpty(value) || RegExp(ruleDetails[0]["regexp"]).test(value)
        }
    }

    /** Email constraint; target type must be string. */
    private email(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "email"
        // Ensure `rule["validator"]` is set so Each/Exists constraints can pick it up.
        const pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+\.)+[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}))$/
        rule["validator"] = (rule: any, value: any) => {
            return this.isEmpty(value) || value.length <= 320 && !!value.match(pattern)
        }
    }

    /** Min constraint; target type must be numeric. */
    private min(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value >= ruleDetails[0]["value"]
    }

    /** Max constraint; target type must be numeric. */
    private max(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value <= ruleDetails[0]["value"]
    }

    /** Past constraint; target type must be Date. */
    private past(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "date"
        rule["validator"] = (rule: any, value: any) => value == null || value < new Date()
    }

    /** Future constraint; target type must be Date. */
    private future(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "date"
        rule["validator"] = (rule: any, value: any) => value == null || value > new Date()
    }

    /** PastOrPresent constraint; target type must be Date. */
    private pastOrPresent(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "date"
        rule["validator"] = (rule: any, value: any) => value == null || value <= new Date()
    }

    /** FutureOrPresent constraint; target type must be Date. */
    private futureOrPresent(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "date"
        rule["validator"] = (rule: any, value: any) => value == null || value >= new Date()
    }

    /**
     * DurationMin constraint: the Duration value must be longer than (or equal to, when inclusive) the
     * configured threshold. Lenient: an empty or non-ISO-8601 value defers to backend validation.
     */
    private durationMin(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (_rule: any, value: any) => {
            if (this.isEmpty(value)) return true
            const ms = this.parseDurationToMillis(value)
            if (ms == null) return true
            const inclusive = ruleDetails[0]["inclusive"] !== false
            const threshold = this.durationDetailToMillis(ruleDetails[0])
            return inclusive ? ms >= threshold : ms > threshold
        }
    }

    /**
     * DurationMax constraint: the Duration value must be shorter than (or equal to, when inclusive) the
     * configured threshold. Lenient: an empty or non-ISO-8601 value defers to backend validation.
     */
    private durationMax(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (_rule: any, value: any) => {
            if (this.isEmpty(value)) return true
            const ms = this.parseDurationToMillis(value)
            if (ms == null) return true
            const inclusive = ruleDetails[0]["inclusive"] !== false
            const threshold = this.durationDetailToMillis(ruleDetails[0])
            return inclusive ? ms <= threshold : ms < threshold
        }
    }

    /** Sum a DurationMin/Max ruleDetail's {days,hours,minutes,seconds,millis,nanos} into milliseconds. */
    private durationDetailToMillis(d: Record<string, any>): number {
        const num = (k: string) => {
            const n = Number(d?.[k])
            return Number.isFinite(n) ? n : 0
        }
        return num('days') * 86400000 + num('hours') * 3600000 + num('minutes') * 60000
            + num('seconds') * 1000 + num('millis') + num('nanos') / 1e6
    }

    /** Parse an ISO-8601 duration string (e.g. PT1H30M, P2DT3H, PT0.5S) into milliseconds; null if not parseable. */
    private parseDurationToMillis(value: any): number | null {
        if (!this.isString(value)) return null
        const m = String(value).trim().match(/^([+-]?)P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
        if (!m || (m[2] == null && m[3] == null && m[4] == null && m[5] == null)) return null
        const sign = m[1] === '-' ? -1 : 1
        const days = Number(m[2] || 0), hours = Number(m[3] || 0), minutes = Number(m[4] || 0), seconds = Number(m[5] || 0)
        return sign * (days * 86400000 + hours * 3600000 + minutes * 60000 + seconds * 1000)
    }

    /**
     * Currency constraint: the monetary value's ISO-4217 currency code must be one of the accepted codes.
     * Lenient: an empty value, an empty accepted list, or a value whose currency can't be determined
     * client-side defers to backend validation.
     */
    private currency(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (_rule: any, value: any) => {
            if (this.isEmpty(value)) return true
            const accepted = ruleDetails[0]["value"]
            if (!Array.isArray(accepted) || accepted.length === 0) return true
            const code = this.extractCurrencyCode(value)
            if (code == null) return true
            return accepted.map((c: any) => String(c).toUpperCase()).indexOf(code.toUpperCase()) !== -1
        }
    }

    /** Best-effort ISO-4217 code extraction: a 3-letter string, or an object carrying currency/currencyCode/code. */
    private extractCurrencyCode(value: any): string | null {
        if (this.isString(value)) {
            const t = String(value).trim()
            return /^[A-Za-z]{3}$/.test(t) ? t : null
        }
        if (value && typeof value === 'object') {
            const c = value.currency ?? value.currencyCode ?? value.code
            if (typeof c === 'string' && /^[A-Za-z]{3}$/.test(c.trim())) return c.trim()
        }
        return null
    }

    /**
     * ParameterScriptAssert is a server-side, method-level (cross-parameter) script constraint; it can't be
     * meaningfully evaluated against a single form field in the browser, so it defers entirely to backend
     * validation (explicit pass-through rather than a dangling no-op rule).
     */
    private parameterScriptAssert(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = () => true
    }

    /** DecimalMin constraint; target type must be number. */
    private decimalMin(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const inclusive = ruleDetails[0]["inclusive"] as boolean
                const minValue = Number(ruleDetails[0]["value"])
                return inclusive ? value >= minValue : value > minValue
            }
        }
    }

    /** DecimalMax constraint; target type must be number. */
    private decimalMax(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const inclusive = ruleDetails[0]["inclusive"] as boolean
                const maxValue = Number(ruleDetails[0]["value"])
                return inclusive ? value <= maxValue : value < maxValue
            }
        }
    }

    /** Range constraint; target type must be number. */
    private range(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const minValue = Number(ruleDetails[0]["min"])
                const maxValue = Number(ruleDetails[0]["max"])
                return value >= minValue && value <= maxValue
            }
        }
    }

    /** Digits constraint (integer/fraction digit limits); target type must be number. */
    private digits(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const parts = value.toString().split(".")
                const maxIntegerDigits = Number(ruleDetails[0]["integer"])
                // Despite the name, `fraction` from ruleDetail is the maximum number of fraction digits (not minimum).
                const maxFractionDigits = Number(ruleDetails[0]["fraction"])
                const integerDigits = value <= 0 ? parts[0].length - 1 : parts[0].length
                const fractionDigits = !parts[1] ? 0 : parts[1].length
                return integerDigits <= maxIntegerDigits && fractionDigits <= maxFractionDigits
            }
        }
    }

    /** Positive constraint; target type must be number. */
    private positive(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value > 0
    }

    /** Negative constraint; target type must be number. */
    private negative(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value < 0
    }

    /** PositiveOrZero constraint; target type must be number. */
    private positiveOrZero(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value >= 0
    }

    /** NegativeOrZero constraint; target type must be number. */
    private negativeOrZero(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "number"
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || value <= 0
    }

    /** EAN-13 barcode constraint; target type must be number or string. */
    private ean(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            }
            const type = (ruleDetails[0]["type"] || "").toString().toUpperCase()
            const digits = value.toString().replace(/\D/g, "")
            if (type === "EAN_8" || type === "EAN8") {
                return this.isValidEan(digits, 8)
            }
            // Default to EAN-13.
            return this.isValidEan(digits, 13)
        }
    }

    /** Luhn constraint; can validate bank/credit cards. */
    private luhnCheck(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || this.checkMod10(value)
    }

    /** Mod10 constraint; can validate bank/credit cards. */
    private mod10Check(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || this.checkMod10(value)
    }

    /** Mod11 constraint; can validate bank/credit cards. */
    private mod11Check(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || this.checkMod11(value)
    }

    private isValidEan(digits: string, length: number) {
        if (digits.length !== length) return false
        const body = digits.slice(0, -1)
        const checkDigit = parseInt(digits.slice(-1), 10)
        let sum = 0
        const reversed = body.split("").reverse()
        for (let i = 0; i < reversed.length; i++) {
            const n = parseInt(reversed[i], 10)
            sum += (i % 2 === 0 ? 3 : 1) * n
        }
        const calc = (10 - (sum % 10)) % 10
        return calc === checkDigit
    }

    /** ISBN constraint. */
    private isbn(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const type = ruleDetails[0]["type"]
                switch (type) {
                    case "ISBN_10":
                        return this.checkISBN10(value)
                    case "ISBN_13":
                        return this.checkISBN13(value)
                    case "ANY":
                        return this.checkISBN10(value) || this.checkISBN13(value)
                }
            }
        }
    }

    /** URL constraint. */
    private url(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "url"
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const protocol = ruleDetails[0]["protocol"]
                if (protocol && protocol != "") {
                    if (!value.trim().startsWith(protocol + "://")) {
                        return false
                    }
                }

                const host = ruleDetails[0]["host"]
                if (host && host != "") {
                    if (value.indexOf(host) == -1) {
                        return false
                    }
                }

                const port = ruleDetails[0]["port"]
                if (port && port != "" && port > 0) {
                    if (!value.endsWith(":" + port) && value.indexOf(":" + port + "/") == -1) {
                        return false
                    }
                }

                const regexp = ruleDetails[0]["regexp"]
                if (regexp && regexp != "") {
                    if (!new RegExp(regexp).test(value)) {
                        return false
                    }
                }

                return true
            }
        }
    }

    /** Size constraint; target type must be string, array, Set, or Map. */
    private size(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                const min = ruleDetails[0]["min"]
                const max = ruleDetails[0]["max"]
                if (this.isString(value) || value instanceof Array) {
                    return value.length >= min && value.length <= max
                }
                if (value instanceof Set || value instanceof Map) {
                    return value.size >= min && value.size <= max
                }
                return false
            }
        }
    }

    /**
     * Max-size constraint (equivalent to a Size rule with only `max` specified).
     * Target types: string, array, TypedArray, Set, Map, etc. (same as Size; only the upper bound is checked).
     * `ruleDetails[0].max`: maximum element count (inclusive).
     */
    private maxSize(propName: string, ruleDetails: Array<any>, rule: any) {
        const max = ruleDetails[0]["max"]
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            }
            const n = Number(max)
            if (max === undefined || max === null || Number.isNaN(n)) return true
            if (this.isString(value) || value instanceof Array) {
                return ((value as { length?: number }).length ?? (value as { byteLength?: number }).byteLength ?? 0) <= n
            }
            if (value instanceof Set || value instanceof Map) {
                return value.size <= n
            }
            if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
                // TypedArray/DataView do not uniformly expose `length` in DOM types; DataView only has `byteLength`.
                return ((value as { length?: number }).length ?? (value as { byteLength?: number }).byteLength ?? 0) <= n
            }
            return false
        }
    }

    /** Enum constraint. */
    private dictEnumCode(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => this.isEmpty(value) || ruleDetails[0]["values"].indexOf(value) != -1
    }

    /** Series constraint; the target must be an array or a string separated by comma, space, or semicolon. */
    private series(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => {
            if (this.isEmpty(value)) {
                return true
            } else {
                if (this.isString(value)) {
                    if (value.indexOf(",") != -1) {
                        value = value.split(",")
                    } else if(value.indexOf(";") != -1) {
                        value = value.split(";")
                    } else {
                        value = value.split(" ")
                    }
                }
                const size = ruleDetails[0]["size"]
                if (size != 0 && value.length != size) {
                    return false
                }
                if (value.length == 0 || value.length == 1) {
                    return true
                }
                return this.validateSeries(ruleDetails[0]["type"], ruleDetails[0]["step"], value)
            }
        }
    }

    /** Not-null-depends constraint: whether the current property may be null depends on the defined expression. */
    private notNullOn(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["validator"] = (rule: any, value: any) => {
            const depends = ruleDetails[0]["depends"]
            if (this.isDependsNotPass(depends)) {
                return true
            }

            // If there's no depends condition, or its expression holds, apply NotNull logic.
            return !this.isEmpty(value)
        }
    }

    /**
     * Builds one inner validator per constraint contained in `ruleDetails`,
     * for use by the Each / Exist array-element validators.
     */
    private buildElementValidators(propName: string, ruleDetails: Array<any>): Array<ValidatorRule> {
        const validators: Array<ValidatorRule> = []
        for (const r of ruleDetails) {
            for (const ruleName in r) {
                const inner: ValidatorRule = {}
                this.doParseRule(ruleName, propName, r[ruleName], inner)
                if (typeof inner["validator"] === "function") validators.push(inner)
            }
        }
        return validators
    }

    /** Apply Constraints to every element of an array; only when every element passes does the whole rule pass. */
    private each(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "array"
        rule["validator"] = (_rule: any, value: Array<any>) => {
            if (!Array.isArray(value)) return true
            const validators = this.buildElementValidators(propName, ruleDetails)
            return value.every((elem) => validators.every((inner) => inner["validator"](inner, elem)))
        }
    }

    /** Apply Constraints to every element of an array; as long as at least one element passes, the whole rule passes. */
    private exist(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "array"
        rule["validator"] = (_rule: any, value: Array<any>) => {
            if (!Array.isArray(value)) return true
            const validators = this.buildElementValidators(propName, ruleDetails)
            return value.some((elem) => validators.every((inner) => inner["validator"](inner, elem)))
        }
    }

    /** Uniqueness constraint; the target must be an array. */
    private uniqueElements(propName: string, ruleDetails: Array<any>, rule: any) {
        rule["type"] = "array"
        rule["validator"] = (rule: any, value: any) => new Set(value).size == value.length
    }


    private isString(value: any): Boolean {
        return typeof value == 'string' || value instanceof String
    }

    private isEmpty(value: any): Boolean {
        if (value == null) {
            return true
        }
        if (typeof value == 'string' || value instanceof String) {
            return value == ''
        }
        if (value instanceof Array) {
            return value.length == 0
        }
        if (value instanceof Set || value instanceof Map) {
            return value.size == 0
        }
        return false
    }

    private isDependsNotPass(depends: any): Boolean {
        const andOr = depends["andOr"]
        const properties = <Array<string>>depends["properties"]
        const logics = <Array<string>>depends["logics"]
        const values = <Array<string>>depends["values"]
        for (let i = 0; i < properties.length; i++) {
            const property = properties[i]
            const v1 = this.getModel()[property]
            if (v1 == undefined) {
                throw new Error("Property not found in the supplied validation model: " + property)
            }
            let v2 = null
            if (values && values.length > i) {
                v2 = values[i]
            }
            const result = this.compareTwoValue(logics[i], v1, v2)
            if (andOr) {
                if (andOr == "AND") {
                    if (!result) {
                        return true // AND logic: any false condition makes depends false; skip the outer compare.
                    }
                } else {
                    if (result) {
                        return false // OR logic: any true condition makes depends true; run the outer compare.
                    }
                }
            } else {
                // When `andOr` is absent the depends expression is assumed to be a single condition;
                // multiple properties without `andOr` would only evaluate the first (loop exits immediately).
                return !result
            }
        }
        return false
    }

    private compareTwoValue(logic: string, v1: any, v2: any): Boolean {
        switch (logic) {
            case "EQ":
                return v1 == v2
            case "IEQ":
                return v1.toString().toLowerCase() == v2.toString().toLowerCase()
            case "NE":
            case "LG":
                return v1 != v2
            case "GE":
                return v1 >= v2
            case "LE":
                return v1 <= v2
            case "GT":
                return v1 > v2
            case "LT":
                return v1 < v2
            case "LIKE":
                if (this.isString(v1)) {
                    return v1.indexOf(v2.toString()) != -1
                } else {
                    return false
                }
            case "LIKE_S":
                if (this.isString(v1)) {
                    return v1.startsWith(v2.toString())
                } else {
                    return false
                }
            case "LIKE_E":
                if (this.isString(v1)) {
                    return v1.endsWith(v2.toString())
                } else {
                    return false
                }
            case "ILIKE":
                if (this.isString(v1)) {
                    return v1.toLowerCase().indexOf(v2.toLowerCase()) != -1
                } else {
                    return false
                }
            case "ILIKE_S":
                if (this.isString(v1)) {
                    return v1.toLowerCase().startsWith(v2.toLowerCase())
                } else {
                    return false
                }
            case "ILIKE_E":
                if (this.isString(v1)) {
                    return v1.toLowerCase().endsWith(v2.toLowerCase())
                } else {
                    return false
                }
            case "IN":
                if (this.isString(v1)) {
                    return this.compareTwoValue("LIKE", v2, v1)
                }
                if (v2 instanceof Array) {
                    if (!(v1 instanceof Array)) {
                        return (<Array<any>>v2).indexOf(v1) != -1
                    } else {
                        // Array v1 is IN array v2 when every element of v1 is contained in v2.
                        for (const elem of v1 as Array<any>) {
                            if ((<Array<any>>v2).indexOf(elem) == -1) {
                                return false
                            }
                        }
                        return true
                    }
                }
                if (v1 instanceof Map && v2 instanceof Map) {
                    if (v1.size > v2.size) {
                        return false
                    } else {
                        // Check that every key of v1 exists in v2 with the same key (subset check).
                        // Note: `return false` inside `forEach` exits only the callback; the outer
                        // function always returns `true` here — this is a pre-existing limitation.
                        ;(<Map<any, any>>v1).forEach((_v, k) => {
                            const value = (<Map<any, any>>v2).get(k)
                            if (value != k) {
                                return false
                            }
                        })
                        return true
                    }
                }
                return false
            case "NOT_IN":
                return !this.compareTwoValue("IN", v1, v2)
            case "IS_NULL":
            case "IS_EMPTY":
                return v1 == null || v1 == ''
            case "IS_NOT_NULL":
            case "IS_NOT_EMPTY":
                return v1 != null && v1 != ''
        }
        return false
    }

    private checkMod10(nums: unknown): Boolean {
        let arr = (nums + '')
            .split('')
            .reverse()
            .map(x => parseInt(x));
        let lastDigit = arr.splice(0, 1)[0];
        let sum = arr.reduce(
            (acc, val, i) => (i % 2 !== 0 ? acc + val : acc + ((val *= 2) > 9 ? val - 9 : val)),
            0
        );
        sum += lastDigit;
        return sum % 10 === 0;
    }

    private checkMod11(nums: unknown): Boolean {
        let arr = (nums + '')
            .split('')
            .reverse()
            .map(x => parseInt(x));
        let lastDigit = arr.splice(0, 1)[0];
        let sum = arr.reduce(
            (acc, val, i) => (acc + (i % 6 + 2) * val), 0
        );
        const mod = sum % 11
        let checkDigit
        if (mod == 0) {
            checkDigit = 0
        } else if (mod == 1) {
            checkDigit = 'X'
        } else {
            checkDigit = 11 - mod
        }
        return checkDigit === lastDigit;
    }

    private checkISBN10(code: unknown): Boolean {
        // Convert to string first before computing the check digit; supports both number and string input.
        const text = (code + '').replace(/[-\s]/g, '');
        if (!/^\d{9}[\dxX]?$/.test(text)) return false;
        let i = 0, c = 0; // c:checksum
        for (; i < 9;)
            c += Number(text.charAt(i++)) * i;
        c %= 11;
        let ch = c + ''
        if (c == 10) ch = 'X';
        return String(c) == (text.charAt(9)) || ch == 'X' && text.charAt(9).toLowerCase() == 'x';
    }

    private checkISBN13(code: unknown): Boolean {
        // Convert to string first before computing the check digit; supports both number and string input.
        const text = (code + '').replace(/[-\s]/g, '');
        if (!/^\d{12,13}$/.test(text)) return false;
        let i = 1, c = 0; // c:checksum
        for (; i < 12; i += 2)
            c += Math.floor(Number(text.charAt(i)));
        for (c *= 3, i = 0; i < 12; i += 2)
            c += Math.floor(Number(text.charAt(i)));
        c = (220 - c) % 10; // 220: greater than (1*6+3*6); only %10==0 matters.
        // A 12-digit input (no check digit provided) always returns true (`Boolean(text + c)` is a non-empty
        // string, so always truthy). This is intentional: the backend validates the full 13-digit check digit.
        if (text.length == 12) return Boolean(text + c);
        return String(c) == text.charAt(12);
    }

    private validateSeries(type: string, step: number, values: Array<number>): Boolean {
        switch (type) {
            case "INC_DIFF": // Strictly increasing, all distinct.
                let preValue: number | null = null
                for (let i = 0; i < values.length; i++) {
                    const value = Number(values[i])
                    if (preValue != null) {
                        if (step == 0.0) { // No step applied.
                            if (preValue >= value) {
                                return false
                            }
                        } else {
                            if (preValue + step != value) {
                                return false
                            }
                        }
                    }
                    preValue = value
                }
                return true
            case "DESC_DIFF": // Strictly decreasing, all distinct.
                return this.validateSeries("INC_DIFF", step, values.reverse())
            case "INC_DIFF_DESC_DIFF": // Strictly increasing then strictly decreasing, all distinct.
                const maxValueIndex = this.maxValueIndex(values)
                if (maxValueIndex == values.length - 1) {
                    return false
                }
                const incDiffValues = values.slice(0, maxValueIndex + 1)
                const incDiffPass = this.validateSeries("INC_DIFF", step, incDiffValues)
                if (incDiffPass) {
                    const descDiffValues = values.slice(maxValueIndex, values.length)
                    return this.validateSeries("DESC_DIFF", step, descDiffValues)
                } else {
                    return false
                }
            case "DESC_DIFF_INC_DIFF": // Strictly decreasing then strictly increasing, all distinct.
                const minValueIndex = this.minValueIndex(values)
                if (minValueIndex == values.length - 1) {
                    return false
                }
                const descDiffValues = values.slice(0, minValueIndex + 1)
                const descDiffPass = this.validateSeries("DESC_DIFF", step, descDiffValues)
                if (descDiffPass) {
                    const descDiffValues = values.slice(minValueIndex, values.length)
                    return this.validateSeries("INC_DIFF", step, descDiffValues)
                } else {
                    return false
                }
            case "DIFF": // All distinct.
                const diff = new Set(values).size == values.length
                if (!diff) {
                    return false
                } else if (step != 0.0) {
                    let preValue: number | null = null
                    for (let i = 0; i < values.length; i++) {
                        const value = Number(values[i])
                        if (preValue != null) {
                            if (Math.abs(preValue - value) != step) {
                                return false
                            }
                        }
                        preValue = value
                    }
                }
                return true
            case "INC_EQ": // Non-decreasing (allows equal).
                let preV: number | null = null
                for (let i = 0; i < values.length; i++) {
                    const value = Number(values[i])
                    if (preV != null) {
                        if (step == 0.0) { // No step applied.
                            if (preV > value) {
                                return false
                            }
                        } else {
                            if (preV != value && preV + step != value) {
                                return false
                            }
                        }
                    }
                    preV = value
                }
                return true
            case "DESC_EQ": // Non-increasing (allows equal).
                return this.validateSeries("INC_EQ", step, values.reverse())
            case "INC_EQ_DESC_EQ": // Non-decreasing then non-increasing.
                const maxValueStartIndex = this.maxValueIndex(values)
                const maxValue = values[maxValueStartIndex]
                if (maxValueStartIndex == 0 || maxValueStartIndex == values.length - 1) {
                    return false
                }
                let maxValueEndIndex = maxValueStartIndex
                for (let index = maxValueStartIndex; index < values.length; index++) {
                    if (values[index] == maxValue) {
                        maxValueEndIndex = index
                    } else {
                        break
                    }
                }
                const incEqValues = values.slice(0, maxValueStartIndex + 1)
                const incEqPass = this.validateSeries("INC_EQ", step, incEqValues)
                if (incEqPass) {
                    const descEqValues = values.slice(maxValueEndIndex, values.length)
                    return this.validateSeries("DESC_EQ", step, descEqValues)
                } else {
                    return false
                }
            case "DESC_EQ_INC_EQ": // Non-increasing then non-decreasing.
                const minValueStartIndex = this.minValueIndex(values)
                const minValue = values[minValueStartIndex]
                if (minValueStartIndex == 0 || minValueStartIndex == values.length - 1) {
                    return false
                }
                let minValueEndIndex = minValueStartIndex
                for (let index = minValueStartIndex; index < values.length; index++) {
                    if (values[index] == minValue) {
                        minValueEndIndex = index
                    } else {
                        break
                    }
                }
                const descEqValues = values.slice(0, minValueStartIndex + 1)
                const descEqPass = this.validateSeries("DESC_EQ", step, descEqValues)
                if (descEqPass) {
                    const incEqValues = values.slice(minValueEndIndex, values.length)
                    return this.validateSeries("INC_EQ", step, incEqValues)
                } else {
                    return false
                }
            case "EQ": // All equal.
                return new Set(values).size == 1
        }
        return false
    }

    private maxValueIndex(values: Array<number>): number {
        let maxValueIndex = 0
        let maxValue: number | null = null
        values.forEach((value, index) => {
            if (maxValue == null) {
                maxValue = value
            } else {
                if (value > maxValue) {
                    maxValue = value
                    maxValueIndex = index
                }
            }
        })
        return maxValueIndex
    }

    private minValueIndex(values: Array<number>): number {
        let minValueIndex = 0
        let minValue: number | null = null
        values.forEach((value, index) => {
            if (minValue == null) {
                minValue = value
            } else {
                if (value < minValue) {
                    minValue = value
                    minValueIndex = index
                }
            }
        })
        return minValueIndex
    }

}
