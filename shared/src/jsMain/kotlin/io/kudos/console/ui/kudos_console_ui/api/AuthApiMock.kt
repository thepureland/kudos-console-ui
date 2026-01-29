package io.kudos.console.ui.kudos_console_ui.api

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf

// Simple auth check to mimic protected endpoints.
private fun hasAuth(headers: Headers): Boolean {
    val auth = headers[HttpHeaders.Authorization] ?: return false
    return auth.startsWith("Bearer ")
}

// Responds using JSON fixtures loaded into MockJsonStore at build time.
internal fun createMockEngine(): MockEngine = MockEngine { request ->
    val path = request.url.encodedPath
    val headers = headersOf(HttpHeaders.ContentType, "application/json")
    when (path) {
        "/api/auth/login" -> {
            val body = MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/api/me", "/api/menus" -> {
            if (!hasAuth(request.headers)) {
                respond("{}", HttpStatusCode.Unauthorized, headers)
            } else {
                val body = MockJsonStore.byPath[path] ?: "{}"
                respond(body, HttpStatusCode.OK, headers)
            }
        }
        else -> {
            val body = MockJsonStore.byPath[path]
            if (body == null) {
                respond("{}", HttpStatusCode.NotFound, headers)
            } else {
                respond(body, HttpStatusCode.OK, headers)
            }
        }
    }
}
