package io.kudos.console.ui.kudos_console_ui.api

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val mockJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

private val mockUser = User(
    id = "u_10001",
    username = "admin",
    displayName = "Admin",
    roles = listOf("ADMIN")
)

private val mockMenus = listOf(
    MenuItem(
        path = "/dashboard",
        name = "Dashboard",
        icon = "HomeFilled",
        children = null
    ),
    MenuItem(
        path = "/settings",
        name = "Settings",
        icon = "Setting",
        children = listOf(
            MenuItem(path = "/settings/profile", name = "Profile", icon = "User", children = null),
            MenuItem(path = "/settings/security", name = "Security", icon = "Lock", children = null)
        )
    )
)

private fun hasAuth(headers: Headers): Boolean {
    val auth = headers[HttpHeaders.Authorization] ?: return false
    return auth.startsWith("Bearer ")
}

internal fun createMockEngine(): MockEngine = MockEngine { request ->
    val path = request.url.encodedPath
    val headers = headersOf(HttpHeaders.ContentType, "application/json")
    when (path) {
        "/api/auth/login" -> {
            val response = LoginResponse(token = "mock-token-123", user = mockUser)
            respond(mockJson.encodeToString(response), HttpStatusCode.OK, headers)
        }
        "/api/me" -> {
            if (!hasAuth(request.headers)) {
                respond("{}", HttpStatusCode.Unauthorized, headers)
            } else {
                respond(mockJson.encodeToString(mockUser), HttpStatusCode.OK, headers)
            }
        }
        "/api/menus" -> {
            if (!hasAuth(request.headers)) {
                respond("[]", HttpStatusCode.Unauthorized, headers)
            } else {
                respond(mockJson.encodeToString(mockMenus), HttpStatusCode.OK, headers)
            }
        }
        else -> respond("{}", HttpStatusCode.NotFound, headers)
    }
}
