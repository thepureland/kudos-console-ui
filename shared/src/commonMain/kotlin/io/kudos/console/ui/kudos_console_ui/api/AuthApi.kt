package io.kudos.console.ui.kudos_console_ui.api

import io.kudos.console.ui.kudos_console_ui.login.LoginRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders

/**
 * 认证与用户/菜单接口（KMP 共享）
 * 与服务端打交道的逻辑集中在此，Web/Android/iOS 复用同一套
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
