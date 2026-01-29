package io.kudos.console.ui.kudos_console_ui.api

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

// Creates a client for JS; uses MockEngine in dev and real JS engine otherwise.
internal fun createHttpClient(): HttpClient =
    if (shouldUseMock()) {
        HttpClient(createMockEngine()) {
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
    } else {
        HttpClient(Js) {
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
    }
