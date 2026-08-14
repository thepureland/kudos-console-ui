import { requestText } from '../api/httpClient'

export type ApiErrorDetail = {
  code?: string | null
  field?: string | null
  target?: string | null
  message: string
  rejectedValue?: unknown
}

export type ApiResponse<T = unknown> = {
  success: boolean
  /** The backend may return a string or a number (JSON number); some gateway layers only carry `code` on the inner object. */
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
  /** When true, methods other than GET/DELETE also place params in the URL query instead of the body. */
  paramsInQuery?: boolean
}

/**
 * Call an admin backend endpoint through the native TypeScript HTTP client, using the
 * same origin and token as authentication.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
function backendPath(url: string): string {
  return `/api/admin/${url.replace(/^\/+/, '')}`
}

/** In development, log slow requests (>1s) and per-phase timing to help diagnose proxy/backend latency. */
const LOG_SLOW_REQUESTS = import.meta.env?.DEV === true;

/** Returns a high-resolution timestamp (ms), falling back to Date.now() outside browser/Node environments. */
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
    /* If ensureAppMessagesLoaded etc. fails, fall back to synchronous translation. */
  }
  return getUserFacingMessage(text)
}

function asRecord(o: unknown): Record<string, unknown> | null {
  if (o == null || typeof o !== "object" || Array.isArray(o)) return null
  return o as Record<string, unknown>
}

/**
 * Align with the various `success` shapes the backend/gateway may return (including string booleans and 0/1).
 * Some legacy endpoints return numeric 0/1 instead of booleans; some gateways serialize as "true"/"false" strings.
 * Returns undefined when the field is absent or has an unrecognised value.
 */
function readApiSuccessFlag(o: Record<string, unknown>): boolean | undefined {
  const s = o.success
  if (s === true || s === false) return s
  if (s === 0 || s === "0") return false
  if (s === 1 || s === "1") return true
  if (s === "true") return true
  if (s === "false") return false
  return undefined
}

/**
 * Attempt to parse a JSON string only when it looks like an object or array (starts with `{` or `[`).
 * Used to unwrap double-encoded `data` fields from gateway responses without eagerly parsing plain strings.
 * Compare `parseMaybeJson`, which tries to parse any string value unconditionally.
 */
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
 * Extract the to-be-translated message key from a unified failure response: prefer errors[0].message (matches validation error bodies); otherwise the top-level message.
 * Used for the shared list/form failure prompts, including modules like cache and access rules.
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
 * Uniformly peel off the "business layer" ApiResponse:
 * - Common case: top level is { success, code, message, errors, data }.
 * - Gateway / gateway-style wrapping: top level has success=true, code=200, and the real result is in `data` (object or JSON string); if `data` still contains `success`, the **inner** value must win (otherwise a save failure would be misread as success and `errors` would be unreachable).
 * - Also tolerate one more level of `data` nesting.
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

/**
 * Synchronous message extractor — tries `message` then `msg` on the unwrapped response envelope.
 * `resolveApiResponseMessage` is the async mirror that goes through i18n loading before translating.
 */
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

/** Only when the unified response explicitly indicates failure, use `message` as the user-facing failure prompt. */
export function getApiFailureMessage(result: unknown): string | null {
  const body = unwrapApiResult(result)
  const o = asRecord(body)
  if (o == null) return null
  if (!isApiFailureEnvelope(o)) return null
  const raw = extractApiFailureMessageKey(o)
  return raw != null ? getUserFacingMessage(raw) : null
}

/** Async failure-prompt resolver: ensure default backend-message i18n is loaded first, then take the failure message (including the errors array). */
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
 * Form-save failure: take errors/message keys from the unwrapped unified response and translate; when no translation exists, at least display the original key.
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

/**
 * Reduce a response to its business payload, throwing when the envelope reports failure.
 *
 * Callers that consume a payload directly — rather than inspecting `success` themselves the way the list/form
 * pages do — need both halves of the contract in one step:
 *
 * - **Unwrapping.** The backend wraps every controller return value in an `ApiResponse`, so the payload lives
 *   under `data`. Endpoints that are still served by the mock backend return bare fixtures instead, and those
 *   must keep working untouched; `getApiResponseData` passes a non-envelope body through unchanged.
 * - **Failure detection.** A declined business rule arrives as **HTTP 200 with `success: false`** (that is what
 *   a wrong password is). Unwrapping alone would hand such a response back as `data: null`, and the caller
 *   would report whatever "the payload is empty" means in its own terms — describing the symptom while hiding
 *   the cause the backend already stated.
 *
 * The failure message goes through {@link resolveApiFailureMessage}, so an i18n key like
 * `sys.error-msg.default.4002` reaches the user translated rather than raw.
 *
 * @param result raw parsed response body
 * @param fallbackMessage used when the envelope reports failure without a usable message
 * @returns the business payload, or null when the response carries none
 * @throws Error when the envelope explicitly reports failure
 */
export async function resolveApiPayload<T = unknown>(result: unknown, fallbackMessage: string): Promise<T | null> {
  const body = unwrapApiResult(result)
  // `isApiResponse` first: for a bare payload `isApiSuccessResponse` is also false, so testing success alone
  // would reject exactly the mock-backed responses this needs to leave alone.
  if (isApiResponse(body) && !isApiSuccessResponse(body)) {
    throw new Error(await resolveApiFailureMessage(body) ?? fallbackMessage)
  }
  return getApiResponseData<T>(body)
}

export async function backendRequest(options: BackendRequestOptions): Promise<any> {
  const t0 = LOG_SLOW_REQUESTS ? now() : 0;
  const t1 = LOG_SLOW_REQUESTS ? now() : 0;
  const method = (options.method ?? "get").toUpperCase();
  const paramsInQuery = options.paramsInQuery === true;
  let raw: unknown
  try {
    const useQuery = method === 'GET' || method === 'DELETE' || paramsInQuery;
    const query = useQuery && options.params != null && !Array.isArray(options.params)
      ? options.params
      : null;
    const body = useQuery ? undefined : options.params ?? {};
    raw = await requestText(backendPath(options.url), { method, query, body });
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
      // Non-JSON: return the string as-is (e.g. when the response is plain text like a primary key).
      result = raw
    }
  }
  const t3 = LOG_SLOW_REQUESTS ? now() : 0;
  if (LOG_SLOW_REQUESTS && t0 > 0) {
    const total = Math.round(t3 - t0);
    if (total > 1000) {
      const getApi = Math.round(t1 - t0);
      const network = Math.round(t2 - t1);
      const parse = Math.round(t3 - t2);
      console.warn(
        `[backendRequest] slow request ${total}ms: ${options.method ?? "GET"} ${options.url}`,
        "\n  phase timings:",
        `prepare=${getApi}ms`,
        `network=${network}ms`,
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

/**
 * Attempt to parse any string value as JSON; non-strings and unparseable strings are returned as-is.
 * Unlike `parseNestedJson`, this does not restrict to object/array shapes — used for error payload extraction
 * where the entire body might be a plain string error message.
 */
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
