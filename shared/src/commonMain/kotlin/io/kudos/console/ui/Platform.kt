package io.kudos.console.ui

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform