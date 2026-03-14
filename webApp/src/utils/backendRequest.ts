import { AuthApiFactory } from "shared"

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

export async function backendRequest(options: BackendRequestOptions): Promise<any> {
  const t0 = LOG_SLOW_REQUESTS ? now() : 0;
  const api = getBackendApi();
  const t1 = LOG_SLOW_REQUESTS ? now() : 0;
  const method = (options.method ?? "get").toLowerCase();
  const paramsJson =
    options.params != null ? JSON.stringify(options.params) : null;
  const paramsInQuery = options.paramsInQuery === true;
  const raw = await api.request(options.url, method, paramsJson, paramsInQuery);
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
