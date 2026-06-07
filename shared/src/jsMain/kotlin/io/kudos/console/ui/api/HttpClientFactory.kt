package io.kudos.console.ui.api

import io.ktor.client.*
import io.ktor.client.engine.js.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

/**
 * Returns true when the mock engine should be used instead of real HTTP.
 *
 * Resolution order:
 *   1. `window.__KUDOS_USE_MOCK__` (boolean) — explicit override, useful in E2E/Storybook.
 *   2. Hostname is `localhost` or `127.0.0.1` — defaults to mock during local development
 *      so the UI can be started without a running backend.
 */
private fun shouldUseMock(): Boolean {
    val window = rawWindow()
    val forced = window.__KUDOS_USE_MOCK__ as? Boolean
    if (forced != null) return forced
    val hostname = window.location.hostname as? String ?: return false
    return hostname == "localhost" || hostname == "127.0.0.1"
}

/**
 * Shared Ktor client configuration applied to every client instance.
 *
 * Notes:
 * - `ignoreUnknownKeys` keeps deserialization resilient to server-side additions.
 * - `defaultRequest.url(origin)` sets the scheme+host so relative paths work
 *   (individual requests can still override with an absolute URL).
 * - The Authorization header is read from [TokenStorage] at call time, so token
 *   refreshes are picked up without recreating the client.
 */
private fun HttpClientConfig<*>.applyKudosDefaults() {
    install(ContentNegotiation) {
        json(Json {
            ignoreUnknownKeys = true
        })
    }
    defaultRequest {
        url(rawWindow().location.origin.unsafeCast<String>())
        TokenStorage.get()?.let { header("Authorization", "Bearer $it") }
    }
}

/** Auth etc.: throws on non-2xx responses. */
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

/** [BackendApi]: expectSuccess=false; 4xx still returns the response body so the frontend can parse business JSON. */
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
