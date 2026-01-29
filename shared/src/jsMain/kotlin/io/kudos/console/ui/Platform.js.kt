package io.kudos.console.ui

// JS platform descriptor for KMP.
class JsPlatform: Platform {
    override val name: String = "Web with Kotlin/JS"
}

actual fun getPlatform(): Platform = JsPlatform()
