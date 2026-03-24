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
  code: string
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
  const maybeTranslator = (globalThis as { __kudosTranslateBackendMessageAsync?: AsyncBackendMessageTranslator }).__kudosTranslateBackendMessageAsync
  if (typeof maybeTranslator === "function") return maybeTranslator(text)
  return getUserFacingMessage(text)
}

export function isApiResponse(result: unknown): result is ApiResponse {
  if (result == null || typeof result !== "object" || Array.isArray(result)) return false
  const o = result as Record<string, unknown>
  return typeof o.success === "boolean" && typeof o.code === "string"
}

export function isApiSuccessResponse(result: unknown): boolean {
  return isApiResponse(result) && result.success === true
}

export function getApiResponseMessage(result: unknown): string | null {
  if (isApiResponse(result)) return getUserFacingMessage(result.message)
  if (result != null && typeof result === "object" && !Array.isArray(result)) {
    const o = result as Record<string, unknown>
    if (typeof o.message === "string") return getUserFacingMessage(o.message)
    if (typeof o.msg === "string") return getUserFacingMessage(o.msg)
  }
  return null
}

export async function resolveApiResponseMessage(result: unknown): Promise<string | null> {
  if (isApiResponse(result)) return resolveUserFacingMessage(result.message)
  if (result != null && typeof result === "object" && !Array.isArray(result)) {
    const o = result as Record<string, unknown>
    if (typeof o.message === "string") return resolveUserFacingMessage(o.message)
    if (typeof o.msg === "string") return resolveUserFacingMessage(o.msg)
  }
  return null
}

/** 仅当统一响应明确表示失败时，才取 message 作为给用户的失败提示。 */
export function getApiFailureMessage(result: unknown): string | null {
  if (isApiResponse(result)) {
    return result.success === false ? getUserFacingMessage(result.message) : null
  }
  return null
}

/** 异步版失败提示解析：先确保默认后端消息国际化已加载，再取失败 message。 */
export async function resolveApiFailureMessage(result: unknown): Promise<string | null> {
  if (isApiResponse(result)) {
    return result.success === false ? resolveUserFacingMessage(result.message) : null
  }
  return null
}

export function getApiResponseData<T = unknown>(result: unknown): T | null {
  if (isApiResponse(result)) {
    return (result.data ?? null) as T | null
  }
  return (result ?? null) as T | null
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
