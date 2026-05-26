package io.kudos.console.ui.api

import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.serialization.Serializable

/** Successful login response (KMP shared, contract agreed with the backend). */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class LoginResponse(
    val token: String,
    val user: User
)

/** Current user information. */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class User(
    val id: String,
    val username: String,
    val displayName: String,
    val roles: List<String>,
    val unreadMessageCount: Int = 0
)

/** Menu item (supports nesting). */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class MenuItem(
    val path: String,
    val name: String,
    val icon: String? = null,
    val children: List<MenuItem>? = null
)
