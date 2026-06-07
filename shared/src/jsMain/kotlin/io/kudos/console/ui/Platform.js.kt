package io.kudos.console.ui

// Kotlin/JS actual implementation of the Platform interface for the browser target.
class JsPlatform: Platform {
    override val name: String = "Web with Kotlin/JS"
}

actual fun getPlatform(): Platform = JsPlatform()
