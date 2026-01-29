package io.kudos.console.ui.kudos_console_ui.api

import io.kudos.console.ui.kudos_console_ui.login.LoginRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.js.Js
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.request.url
import io.ktor.serialization.kotlinx.json.json
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.promise
import kotlinx.serialization.json.Json

private const val TOKEN_KEY = "kudos_token"

private fun rawWindow(): dynamic = js("window")

private fun shouldUseMock(): Boolean {
    val window = rawWindow()
    val forced = window.__KUDOS_USE_MOCK__ as? Boolean
    if (forced != null) return forced
    val hostname = window.location.hostname as? String ?: return false
    return hostname == "localhost" || hostname == "127.0.0.1"
}

/** 仅 jsMain 使用：浏览器 localStorage 存取 token */
private object TokenStorage {
    fun get(): String? = rawWindow().localStorage.getItem(TOKEN_KEY) as? String

    fun set(s: String) {
        rawWindow().localStorage.setItem(TOKEN_KEY, s)
    }

    fun clear() {
        rawWindow().localStorage.removeItem(TOKEN_KEY)
    }
}

private fun createHttpClient(): HttpClient =
    if (shouldUseMock()) {
        HttpClient(createMockEngine()) {
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

private val authApi = AuthApi(createHttpClient())

/**
 * 暴露给 Vue 的认证 API（登录后自动存 token，logout 清 token）
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class AuthApiExposed {
    private val scope = MainScope()

    fun login(request: LoginRequest) = scope.promise {
        val response = authApi.login(request)
        TokenStorage.set(response.token)
        response
    }

    fun getMe() = scope.promise { authApi.getMe() }
    fun getMenus() = scope.promise { authApi.getMenus() }
    fun logout() = TokenStorage.clear()
}

@OptIn(ExperimentalJsExport::class)
@JsExport
object AuthApiFactory {
    fun getAuthApi(): AuthApiExposed = AuthApiExposed()
    fun hasToken(): Boolean = TokenStorage.get() != null
}
