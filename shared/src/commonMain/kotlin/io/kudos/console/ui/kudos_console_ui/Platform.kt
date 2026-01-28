package io.kudos.console.ui.kudos_console_ui

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform