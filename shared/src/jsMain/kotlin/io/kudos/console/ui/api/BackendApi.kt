package io.kudos.console.ui.api

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.promise
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * 暴露给前端的通用后端请求 API，与 AuthApi 共用同一 [createHttpClient]（同源 + Bearer Token）。
 * GET/DELETE 使用 query 参数，POST 使用 JSON body；返回响应体 JSON 字符串，由 TS 侧解析。
 *
 * @author K
 * @since 1.0.0
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class BackendApiExposed {
    private val client = createHttpClient()
    private val scope = MainScope()
    private val json = Json { ignoreUnknownKeys = true }

    private fun baseUrl(): String =
        rawWindow().location.origin.unsafeCast<String>()

    private fun fullPath(url: String): String {
        val path = if (url.startsWith("/")) url else "/$url"
        return baseUrl() + path
    }

    private fun appendJsonToUrlBuilder(
        paramsJson: String?,
        append: (name: String, value: String) -> Unit
    ) {
        if (paramsJson.isNullOrBlank()) return
        val element = json.parseToJsonElement(paramsJson)
        when (element) {
            is JsonObject -> element.forEach { (key, value) ->
                appendJsonValue(key, value, append)
            }
            else -> { /* GET/DELETE 仅支持 object 参数 */ }
        }
    }

    private fun appendJsonValue(
        key: String,
        value: JsonElement,
        append: (name: String, value: String) -> Unit
    ) {
        when (value) {
            is JsonPrimitive -> append(key, value.content)
            is JsonArray -> value.forEach { appendJsonValue(key, it, append) }
            is JsonObject -> append(key, value.toString())
        }
    }

    /**
     * 发起请求，返回响应体字符串（TS 侧需 JSON.parse）。
     * @param url 相对路径，如 "sys/dictItem/getDictItemMap"
     * @param method "get" | "post" | "delete"
     * @param paramsJson GET/DELETE 时为 query 参数对象 JSON，POST 时为 body JSON；可为 null
     */
    fun request(url: String, method: String, paramsJson: String?) = scope.promise {
        val path = fullPath(url)
        val methodLower = method.lowercase()
        when (methodLower) {
            "get" -> {
                client.get(path) {
                    url {
                        appendJsonToUrlBuilder(paramsJson) { name, value ->
                            parameters.append(name, value)
                        }
                    }
                }.body<String>()
            }
            "delete" -> {
                client.delete(path) {
                    url {
                        appendJsonToUrlBuilder(paramsJson) { name, value ->
                            parameters.append(name, value)
                        }
                    }
                }.body<String>()
            }
            "post" -> {
                client.post(path) {
                    header(HttpHeaders.ContentType, ContentType.Application.Json)
                    setBody(paramsJson ?: "{}")
                }.body<String>()
            }
            else -> client.get(path).body<String>()
        }
    }
}
