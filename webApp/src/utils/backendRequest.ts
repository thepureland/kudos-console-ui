import { AuthApiFactory } from "shared"
import { ajax } from "./ajax"

export type BackendRequestOptions = {
  url: string
  method?: string
  params?: Record<string, any> | any[] | null
}

/**
 * 通过 shared 中 Kotlin 的 BackendApi 请求后端（与 Auth 同源、同 Token）。
 * 若 shared 未暴露 getBackendApi，则回退到本地 ajax（同 Token、同行为）。
 *
 * @author K
 * @since 1.0.0
 */
function getBackendApiInstance(): { request: (url: string, method: string, paramsJson: string | null) => Promise<string> } | null {
  try {
    const factory = AuthApiFactory.getInstance()
    const getBackendApi = factory.getBackendApi
    if (getBackendApi == null) return null
    const api = typeof getBackendApi === "function" ? getBackendApi() : getBackendApi
    if (api && typeof api.request === "function") return api
  } catch {
    // shared 未包含 getBackendApi 或未正确构建
  }
  return null
}

const sharedBackendApi = getBackendApiInstance()

export async function backendRequest(options: BackendRequestOptions): Promise<any> {
  if (sharedBackendApi) {
    const method = (options.method ?? "get").toLowerCase()
    const paramsJson =
      options.params != null ? JSON.stringify(options.params) : null
    const raw = await sharedBackendApi.request(options.url, method, paramsJson)
    const data = typeof raw === "string" ? JSON.parse(raw) : raw
    return data ?? { code: 0, data: null }
  }
  return ajax(options)
}
