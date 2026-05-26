package io.kudos.console.ui.api

import io.kudos.console.ui.login.LoginRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders

/**
 * Authentication and user/menu API (KMP shared).
 * Logic that talks to the server is centralized here; Web/Android/iOS share the same implementation.
 */
class AuthApi(private val client: HttpClient) {

    suspend fun login(request: LoginRequest): LoginResponse =
        client.post("/api/auth/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json)
            setBody(request)
        }.body<LoginResponse>()

    suspend fun getMe(): User =
        client.get("/api/me").body<User>()

    suspend fun getMenus(): List<MenuItem> =
        client.get("/api/menus").body<List<MenuItem>>()
}
