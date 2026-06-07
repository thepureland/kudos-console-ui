package io.kudos.console.ui.login

import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.serialization.Serializable

/**
 * Login request model (KMP shared).
 * Reused by the web form and later by native clients.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
    val totpCode: String
) {
    /**
     * Validates all three credential fields and returns a [LoginValidation] that
     * holds a non-null error string for every field that fails.
     * Returns [LoginValidation.isValid] == true only when all three pass.
     */
    fun validate(): LoginValidation {
        val usernameErr = when {
            username.isBlank() -> "Please enter username"
            username.length < 2 -> "Username must be at least 2 characters" // minimum length guard
            else -> null
        }
        val passwordErr = when {
            password.isBlank() -> "Please enter password"
            password.length < 6 -> "Password must be at least 6 characters" // minimum length guard
            else -> null
        }
        // TOTP codes from Google Authenticator are always exactly 6 decimal digits.
        val totpErr = when {
            totpCode.isBlank() -> "Please enter the Google Authenticator code"
            totpCode.length != 6 || !totpCode.all { it.isDigit() } -> "Verification code must be 6 digits"
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
