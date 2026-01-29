package io.kudos.console.ui.api

import io.kudos.console.ui.login.LoginRequest
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.promise

private const val TOKEN_KEY = "kudos_token"

// JS interop: direct access to window for localStorage and env flags.
internal fun rawWindow(): dynamic = js("window")

/** 仅 jsMain 使用：浏览器 localStorage 存取 token */
internal object TokenStorage {
    fun get(): String? = rawWindow().localStorage.getItem(TOKEN_KEY) as? String

    fun set(s: String) {
        rawWindow().localStorage.setItem(TOKEN_KEY, s)
    }

    fun clear() {
        rawWindow().localStorage.removeItem(TOKEN_KEY)
    }
}

// Shared API wrapper used by JS consumers.
private val authApi = AuthApi(createHttpClient())

/**
 * 暴露给 Vue 的认证 API（登录后自动存 token，logout 清 token）
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
class AuthApiExposed {
    private val scope = MainScope()

    // Return Promises for JS/TS callers (no suspend export).
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
