package io.kudos.console.ui.api

import io.kudos.console.ui.login.LoginRequest
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.promise

private const val TOKEN_KEY = "kudos_token"

// JS interop: direct access to window for localStorage and env flags.
internal fun rawWindow(): dynamic = js("window")

/** jsMain only: browser localStorage access for the token. */
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
 * Authentication API exposed to Vue (token is stored automatically after login, cleared on logout).
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

/**
 * JS-facing factory that lets TypeScript code obtain API handles without holding
 * references to Kotlin objects directly.
 *
 * Each call to [getAuthApi] / [getBackendApi] creates a new instance with its own
 * [MainScope] and Ktor client; callers should cache the returned object rather than
 * calling the factory repeatedly.
 *
 * Note: [getInstance] returns the singleton object itself. It exists purely for
 * symmetry with other factory patterns in the JS layer that expect a getInstance()
 * call; it is a no-op in terms of construction.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
object AuthApiFactory {
    fun getInstance(): AuthApiFactory = this
    fun getAuthApi(): AuthApiExposed = AuthApiExposed()
    fun getBackendApi(): BackendApiExposed = BackendApiExposed()
    fun hasToken(): Boolean = TokenStorage.get() != null
}
