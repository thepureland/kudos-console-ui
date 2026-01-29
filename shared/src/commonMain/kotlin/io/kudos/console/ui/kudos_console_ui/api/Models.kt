package io.kudos.console.ui.kudos_console_ui.api

import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlinx.serialization.Serializable

/** 登录成功响应（KMP 共享，与后端约定） */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class LoginResponse(
    val token: String,
    val user: User
)

/** 当前用户信息 */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class User(
    val id: String,
    val username: String,
    val displayName: String,
    val roles: List<String>
)

/** 菜单项（支持嵌套） */
@OptIn(ExperimentalJsExport::class)
@JsExport
@Serializable
data class MenuItem(
    val path: String,
    val name: String,
    val icon: String? = null,
    val children: List<MenuItem>? = null
)
