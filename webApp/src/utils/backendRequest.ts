import { AuthApiFactory } from "shared"

export type ApiErrorDetail = {
  code?: string | null
  field?: string | null
  target?: string | null
  message: string
  rejectedValue?: unknown
}

export type ApiResponse<T = unknown> = {
  success: boolean
  /** 后端可能为字符串或数字（JSON 数字）；个别网关层可能仅在内层对象上带 code */
  code: string | number
  message?: string | null
  data?: T | null
  timestamp?: number
  errors?: ApiErrorDetail[] | null
  traceId?: string | null
}

export type BackendRequestOptions = {
  url: string
  method?: string
  params?: Record<string, any> | any[] | null
  /** 为 true 时 GET/DELETE 以外的方法也将 params 放在 URL query，不放在 body */
  paramsInQuery?: boolean
}

/**
 * 通过 shared 中 Kotlin 的 BackendApi（Ktor HttpClient）请求后端，与 Auth 同源、同 Token。
 *
 * @author K
 * @since 1.0.0
 */
function getBackendApi() {
  const factory = AuthApiFactory.getInstance()
  const api = factory.getBackendApi()
  if (!api || typeof api.request !== "function") {
    throw new Error("[backendRequest] shared BackendApi 不可用，请确保 shared 已正确构建并包含 getBackendApi")
  }
  return api
}

/** 开发时打印慢请求（>1s）及各阶段耗时，便于排查代理/后端耗时 */
const LOG_SLOW_REQUESTS = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

type BackendMessageTranslator = (message: string) => string
type AsyncBackendMessageTranslator = (message: string) => Promise<string>

function translateBackendMessage(message: string): string {
  const text = String(message ?? "").trim()
  if (text === "") return text
  const maybeTranslator = (globalThis as { __kudosTranslateBackendMessage?: BackendMessageTranslator }).__kudosTranslateBackendMessage
  return typeof maybeTranslator === "function" ? maybeTranslator(text) : text
}

export function getUserFacingMessage(message: unknown): string | null {
  if (typeof message !== "string") return null
  const text = String(message).trim()
  if (text === "") return null
  return translateBackendMessage(text)
}

export async function resolveUserFacingMessage(message: unknown): Promise<string | null> {
  if (typeof message !== "string") return null
  const text = String(message).trim()
  if (text === "") return null
  try {
    const maybeTranslator = (globalThis as { __kudosTranslateBackendMessageAsync?: AsyncBackendMessageTranslator })
      .__kudosTranslateBackendMessageAsync
    if (typeof maybeTranslator === "function") {
      const out = await maybeTranslator(text)
      if (typeof out === "string" && out.trim() !== "") return out
    }
  } catch {
    /* ensureAppMessagesLoaded 等失败时退回同步翻译 */
  }
  return getUserFacingMessage(text)
}

function asRecord(o: unknown): Record<string, unknown> | null {
  if (o == null || typeof o !== "object" || Array.isArray(o)) return null
  return o as Record<string, unknown>
}

/** 与后端/网关可能返回的 success 形态对齐（含字符串布尔、0/1） */
function readApiSuccessFlag(o: Record<string, unknown>): boolean | undefined {
  const s = o.success
  if (s === true || s === false) return s
  if (s === 0 || s === "0") return false
  if (s === 1 || s === "1") return true
  if (s === "true") return true
  if (s === "false") return false
  return undefined
}

function parseNestedJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const t = value.trim()
  if (t.length < 2) return value
  const c = t[0]
  if (c !== "{" && c !== "[") return value
  try {
    return JSON.parse(t) as unknown
  } catch {
    return value
  }
}

function readErrorsArray(o: Record<string, unknown>): unknown[] | null {
  const e = o.errors
  return Array.isArray(e) ? e : null
}

function pickFirstNonBlank(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") return String(c).trim()
  }
  return null
}

function coalesceI18nKey(m: unknown): string | null {
  if (typeof m === "string" && m.trim() !== "") return m.trim()
  if (typeof m === "number" || typeof m === "boolean") return String(m)
  return null
}

/**
 * 从统一失败响应中取出待国际化的 message 键：优先 errors[0].message（与校验错误体一致），否则顶层 message。
 * 供列表/表单等公共失败提示使用，与 cache、访问规则等模块共用。
 */
function extractApiFailureMessageKey(o: Record<string, unknown>): string | null {
  const errors = readErrorsArray(o)
  if (errors != null) {
    for (const item of errors) {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const row = item as Record<string, unknown>
        const key = coalesceI18nKey(row.message)
        if (key != null) return key
      }
    }
  }
  return coalesceI18nKey(o.message)
}

function isApiFailureEnvelope(o: Record<string, unknown>): boolean {
  return readApiSuccessFlag(o) === false
}

/**
 * 统一剥出「业务层」ApiResponse：
 * - 常见：顶层即 { success, code, message, errors, data }
 * - 网关/网关式包装：顶层 success=true、code=200，真实结果在 data（对象或 JSON 字符串）里；若 data 内仍有 success，必须以 **内层** 为准（否则保存失败会误判成功且读不到 errors）。
 * - 再兼容一层 data 嵌套。
 */
export function unwrapApiResult(result: unknown): unknown {
  let cur: unknown = result
  if (typeof cur === "string") {
    try {
      cur = JSON.parse(cur) as unknown
    } catch {
      return result
    }
  }

  const top = asRecord(cur)
  if (top == null) return result

  const tryInner = (r: Record<string, unknown>): Record<string, unknown> | null => {
    const inner = asRecord(parseNestedJson(r.data))
    if (inner == null) return null
    return readApiSuccessFlag(inner) !== undefined ? inner : null
  }

  const first = tryInner(top)
  if (first != null) {
    const second = tryInner(first)
    return second ?? first
  }

  const topFlag = readApiSuccessFlag(top)
  if (topFlag === true || topFlag === false) return top

  const inner = asRecord(parseNestedJson(top.data))
  if (inner == null) return top
  const innerFlag = readApiSuccessFlag(inner)
  if (innerFlag === true || innerFlag === false) return inner

  const deep = asRecord(parseNestedJson(inner.data))
  if (deep != null && readApiSuccessFlag(deep) !== undefined) return deep

  return top
}

export function isApiResponse(result: unknown): result is ApiResponse {
  const o = asRecord(result)
  if (o == null) return false
  const code = o.code
  const codeOk = typeof code === "string" || typeof code === "number"
  if (!codeOk) return false
  const sf = readApiSuccessFlag(o)
  return sf === true || sf === false
}

export function isApiSuccessResponse(result: unknown): boolean {
  const body = unwrapApiResult(result)
  if (!isApiResponse(body)) return false
  return readApiSuccessFlag(body as Record<string, unknown>) === true
}

export function getApiResponseMessage(result: unknown): string | null {
  const body = unwrapApiResult(result)
  if (isApiResponse(body)) {
    const key = coalesceI18nKey((body as ApiResponse).message)
    if (key != null) return getUserFacingMessage(key)
  }
  const o = asRecord(body)
  if (o != null) {
    const km = coalesceI18nKey(o.message)
    if (km != null) return getUserFacingMessage(km)
    const kmsg = coalesceI18nKey(o.msg)
    if (kmsg != null) return getUserFacingMessage(kmsg)
  }
  return null
}

export async function resolveApiResponseMessage(result: unknown): Promise<string | null> {
  const body = unwrapApiResult(result)
  if (isApiResponse(body)) {
    const key = coalesceI18nKey((body as ApiResponse).message)
    if (key != null) return resolveUserFacingMessage(key)
  }
  const o = asRecord(body)
  if (o != null) {
    const km = coalesceI18nKey(o.message)
    if (km != null) return resolveUserFacingMessage(km)
    const kmsg = coalesceI18nKey(o.msg)
    if (kmsg != null) return resolveUserFacingMessage(kmsg)
  }
  return null
}

/** 仅当统一响应明确表示失败时，才取 message 作为给用户的失败提示。 */
export function getApiFailureMessage(result: unknown): string | null {
  const body = unwrapApiResult(result)
  const o = asRecord(body)
  if (o == null) return null
  if (!isApiFailureEnvelope(o)) return null
  const raw = extractApiFailureMessageKey(o)
  return raw != null ? getUserFacingMessage(raw) : null
}

/** 异步版失败提示解析：先确保默认后端消息国际化已加载，再取失败 message（含 errors 数组）。 */
export async function resolveApiFailureMessage(result: unknown): Promise<string | null> {
  const body = unwrapApiResult(result)
  const o = asRecord(body)
  if (o == null) return null
  if (!isApiFailureEnvelope(o)) return null
  const raw = extractApiFailureMessageKey(o)
  if (raw == null) return null
  return await resolveUserFacingMessage(raw)
}

/**
 * 表单保存失败：从 unwrap 后的统一响应取 errors/message 键并做国际化；无译文时至少展示原始 key。
 */
export async function resolveSaveFailureHint(result: unknown): Promise<string | null> {
  const body = unwrapApiResult(result)
  const o = asRecord(body)
  const key = o != null ? extractApiFailureMessageKey(o) ?? coalesceI18nKey(o.msg) : null
  if (key == null) return null
  let asyncText: string | null = null
  try {
    asyncText = await resolveUserFacingMessage(key)
  } catch {
    asyncText = null
  }
  return pickFirstNonBlank(asyncText, getUserFacingMessage(key), key)
}

export function getApiResponseData<T = unknown>(result: unknown): T | null {
  const body = unwrapApiResult(result)
  if (isApiResponse(body)) {
    return (body.data ?? null) as T | null
  }
  return (body ?? null) as T | null
}

export async function backendRequest(options: BackendRequestOptions): Promise<any> {
  const t0 = LOG_SLOW_REQUESTS ? now() : 0;
  const api = getBackendApi();
  const t1 = LOG_SLOW_REQUESTS ? now() : 0;
  const method = (options.method ?? "get").toLowerCase();
  const paramsJson =
    options.params != null ? JSON.stringify(options.params) : null;
  const paramsInQuery = options.paramsInQuery === true;
  let raw: unknown
  try {
    raw = await api.request(options.url, method, paramsJson, paramsInQuery);
  } catch (error) {
    const recovered = extractErrorPayload(error)
    if (recovered !== undefined) {
      raw = recovered
    } else {
      throw error
    }
  }
  const t2 = LOG_SLOW_REQUESTS ? now() : 0;
  let result: unknown
  if (typeof raw !== "string") {
    result = raw
  } else {
    try {
      result = JSON.parse(raw)
    } catch {
      // 非 JSON 时原样返回字符串（如仅返回主键的纯文本）
      result = raw
    }
  }
  const t3 = LOG_SLOW_REQUESTS ? now() : 0;
  if (LOG_SLOW_REQUESTS && t0 > 0) {
    const total = Math.round(t3 - t0);
    if (total > 1000) {
      const getApi = Math.round(t1 - t0);
      const ktor = Math.round(t2 - t1);
      const parse = Math.round(t3 - t2);
      console.warn(
        `[backendRequest] 慢请求 ${total}ms: ${options.method ?? "GET"} ${options.url}`,
        "\n  阶段耗时:",
        `getBackendApi=${getApi}ms`,
        `ktor请求=${ktor}ms`,
        `JSON.parse=${parse}ms`
      );
    }
  }
  return result;
}

function extractErrorPayload(error: unknown): unknown {
  const candidates: unknown[] = []
  if (error != null && typeof error === "object") {
    const e = error as {
      response?: { data?: unknown }
      data?: unknown
      message?: unknown
    }
    if (e.response?.data !== undefined) candidates.push(e.response.data)
    if (e.data !== undefined) candidates.push(e.data)
    if (e.message !== undefined) candidates.push(e.message)
  }
  for (const candidate of candidates) {
    const parsed = parseMaybeJson(candidate)
    if (parsed != null && (
      isApiResponse(parsed)
      || (typeof parsed === "object" && !Array.isArray(parsed) && "message" in (parsed as Record<string, unknown>))
      || typeof parsed === "string"
    )) {
      return parsed
    }
  }
  return undefined
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function getThrownErrorMessage(error: unknown): string | null {
  const payload = extractErrorPayload(error)
  if (typeof payload === "string") return getUserFacingMessage(payload)
  return getApiFailureMessage(payload) || getApiResponseMessage(payload)
}

export async function resolveThrownErrorMessage(error: unknown): Promise<string | null> {
  const payload = extractErrorPayload(error)
  if (typeof payload === "string") return resolveUserFacingMessage(payload)
  return await resolveApiFailureMessage(payload) || await resolveApiResponseMessage(payload)
}
