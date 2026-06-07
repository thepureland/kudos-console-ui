package io.kudos.console.ui.api

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
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
 * General-purpose backend request API exposed to the frontend ([createBackendHttpClient], separate from the Auth client).
 * GET/DELETE use query parameters, POST uses a JSON body; returns the response body as a JSON string parsed on the TS side.
 *
 * @author K
 * @since 1.0.0
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class BackendApiExposed {
    private val client = createBackendHttpClient()
    private val scope = MainScope()
    private val json = Json { ignoreUnknownKeys = true }

    private fun baseUrl(): String {
        val win = rawWindow()
        val direct = win.__KUDOS_API_BASE__ as? String
        if (!direct.isNullOrBlank()) return direct.removeSuffix("/")
        return win.location.origin.unsafeCast<String>()
    }

    private fun fullPath(url: String): String {
        // Ensure the path starts with "/" so concatenation is always valid.
        val path = if (url.startsWith("/")) url else "/$url"
        return baseUrl() + "/api/admin" + path
    }

    /**
     * Deserialises [paramsJson] and appends each key/value pair via [append].
     * Only JSON objects are valid as query-parameter sources; arrays or primitives are silently ignored.
     */
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
            else -> { /* GET/DELETE only supports top-level JSON object parameters. */ }
        }
    }

    /**
     * Recursively converts a single JSON element to one or more query-parameter entries.
     * - Primitives  → single "key=value" entry.
     * - Arrays      → repeated "key=value" entries (multi-value param), matching Spring's default binding.
     * - Objects     → serialised as a JSON string under the key (last-resort; rarely needed).
     */
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
     * Issues a request and returns the response body as a string (the TS side calls JSON.parse).
     * @param url relative path, e.g. "sys/dictItem/getDictItemMap"
     * @param method "get" | "post" | "put" | "delete"
     * @param paramsJson query parameters for GET/DELETE; body by default for POST/PUT, query when paramsInQuery=true
     * @param paramsInQuery when true, POST/PUT also place paramsJson on the URL query rather than in the body
     */
    fun request(url: String, method: String, paramsJson: String?, paramsInQuery: Boolean = false) = scope.promise {
        val t0 = perfNow()
        val path = fullPath(url)
        val t1 = perfNow()
        val methodLower = method.lowercase()
        val response = when (methodLower) {
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
                if (paramsInQuery) {
                    client.post(path) {
                        url {
                            appendJsonToUrlBuilder(paramsJson) { name, value ->
                                parameters.append(name, value)
                            }
                        }
                    }.body<String>()
                } else {
                    client.post(path) {
                        header(HttpHeaders.ContentType, ContentType.Application.Json)
                        setBody(paramsJson ?: "{}")
                    }.body<String>()
                }
            }
            "put" -> {
                if (paramsInQuery) {
                    client.put(path) {
                        url {
                            appendJsonToUrlBuilder(paramsJson) { name, value ->
                                parameters.append(name, value)
                            }
                        }
                    }.body<String>()
                } else {
                    client.put(path) {
                        header(HttpHeaders.ContentType, ContentType.Application.Json)
                        setBody(paramsJson ?: "{}")
                    }.body<String>()
                }
            }
            // Unrecognised method: fall back to GET so the call never throws silently.
            else -> client.get(path).body<String>()
        }
        val t2 = perfNow()
        val total = (t2 - t0).toInt()
        // Warn in the browser console when end-to-end time exceeds 1 s so slow
        // endpoints are immediately visible during development.
        if (total > 1000) {
            logSlow("[BackendApi] slow request ${total}ms: $method $url | fullPath=${(t1 - t0).toInt()}ms network=${(t2 - t1).toInt()}ms")
        }
        response
    }

    /** Wraps `performance.now()` via raw JS because the Kotlin stdlib has no multiplatform equivalent here. */
    private fun perfNow(): Double = js("performance.now()").unsafeCast<Double>()

    /**
     * Issues a `console.warn` via explicit JS interop.
     * `js("console").warn(msg)` shorthand is avoided because the Kotlin/JS compiler
     * does not guarantee the `this` binding is preserved in that form.
     */
    private fun logSlow(msg: String) {
        js("console.warn").call(js("console"), msg)
    }
}
