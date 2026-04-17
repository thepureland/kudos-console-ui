package io.kudos.console.ui.api

import io.ktor.client.*
import io.ktor.client.engine.js.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

// Mock is opt-in via window flag; defaults to localhost for dev ergonomics.
private fun shouldUseMock(): Boolean {
    val window = rawWindow()
    val forced = window.__KUDOS_USE_MOCK__ as? Boolean
    if (forced != null) return forced
    val hostname = window.location.hostname as? String ?: return false
    return hostname == "localhost" || hostname == "127.0.0.1"
}

private fun HttpClientConfig<*>.applyKudosDefaults() {
    install(ContentNegotiation) {
        json(Json {
            ignoreUnknownKeys = true
        })
    }
    defaultRequest {
        // Base URL and auth are applied consistently for all requests.
        url(rawWindow().location.origin.unsafeCast<String>())
        TokenStorage.get()?.let { header("Authorization", "Bearer $it") }
    }
}

/** Auth 等：非 2xx 抛错。 */
internal fun createHttpClient(): HttpClient =
    if (shouldUseMock()) {
        HttpClient(createMockEngine()) {
            expectSuccess = true
            applyKudosDefaults()
        }
    } else {
        HttpClient(Js) {
            expectSuccess = true
            applyKudosDefaults()
        }
    }

/** [BackendApi]：expectSuccess=false，4xx 仍返回响应体供前端解析业务 JSON。 */
internal fun createBackendHttpClient(): HttpClient =
    if (shouldUseMock()) {
        HttpClient(createMockEngine()) {
            expectSuccess = false
            applyKudosDefaults()
        }
    } else {
        HttpClient(Js) {
            expectSuccess = false
            applyKudosDefaults()
        }
    }
