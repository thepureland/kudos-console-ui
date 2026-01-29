package io.kudos.console.ui.login

import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.serialization.Serializable

/**
 * 登录请求模型（KMP 共享）
 * 供 Web 端表单与后续 Native 端复用
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
    val totpCode: String
) {
    fun validate(): LoginValidation {
        val usernameErr = when {
            username.isBlank() -> "请输入用户名"
            username.length < 2 -> "用户名至少 2 个字符"
            else -> null
        }
        val passwordErr = when {
            password.isBlank() -> "请输入密码"
            password.length < 6 -> "密码至少 6 个字符"
            else -> null
        }
        val totpErr = when {
            totpCode.isBlank() -> "请输入谷歌动态验证码"
            totpCode.length != 6 || !totpCode.all { it.isDigit() } -> "验证码为 6 位数字"
            else -> null
        }
        return LoginValidation(usernameErr, passwordErr, totpErr)
    }
}

@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class LoginValidation(
    val usernameError: String?,
    val passwordError: String?,
    val totpError: String?
) {
    fun isValid(): Boolean =
        usernameError == null && passwordError == null && totpError == null
}
