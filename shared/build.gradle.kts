
plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.kotlinSerialization)
}

// Keep shared build outputs under root build/shared
buildDir = rootProject.layout.buildDirectory.dir("shared").get().asFile

val useMockFlag = (project.findProperty("useMock") as String?)?.toBoolean() ?: true
val mockJsonDir = layout.projectDirectory.dir("src/jsMain/resources/mock")
val generatedMockDir = layout.buildDirectory.dir("generated/mock")

kotlin {
    js {
        outputModuleName = "shared"
        browser()
        binaries.library()
        generateTypeScriptDefinitions()
        compilerOptions {
            target = "es2015"
            sourceMap = false
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(libs.ktor.client.core)
                implementation(libs.ktor.client.content.negotiation)
                implementation(libs.ktor.client.serialization)
                implementation(libs.kotlinx.serialization.json)
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(libs.kotlin.test)
            }
        }
        val jsMain by getting {
            kotlin.srcDir(generatedMockDir)
            if (!useMockFlag) {
                resources.exclude("mock/**")
            }
            dependencies {
                implementation(libs.ktor.client.js)
                implementation(libs.ktor.client.mock)
                implementation(npm("typescript", "5.9.3"))
            }
        }
    }
}

abstract class GenerateMockData : DefaultTask() {
    @get:InputDirectory
    abstract val mockDir: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Input
    abstract val useMock: Property<Boolean>

    @TaskAction
    fun generate() {
        val root = mockDir.get().asFile
        val files = if (useMock.get()) {
            root.walkTopDown()
                .filter { it.isFile && it.extension == "json" }
                .sortedBy { it.path }
                .toList()
        } else {
            emptyList()
        }

        val outFile = outputDir.get()
            .file("io/kudos/console/ui/api/MockJsonStore.kt")
            .asFile
        outFile.parentFile.mkdirs()

        // 每个 json 注册两条 path：/api/xxx（AuthApi 等）与 /xxx（BackendApi 如 /sys/cache/search）
        val entries = files.flatMap { file ->
            val rel = root.toPath().relativize(file.toPath()).toString().replace(File.separatorChar, '/')
            val noExt = rel.removeSuffix(".json")
            val json = file.readText().trim()
            val escaped = json
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\$", "\\$")
                .replace("\n", "\\n")
            listOf(
                "\"/api/$noExt\" to \"$escaped\"",
                "\"/$noExt\" to \"$escaped\""
            )
        }.joinToString(",\n")

        outFile.writeText(
            """
            package io.kudos.console.ui.api

            internal object MockJsonStore {
                val byPath: Map<String, String> = mapOf(
            $entries
                )
            }
            """.trimIndent()
        )
    }
}

val generateMockData by tasks.registering(GenerateMockData::class) {
    mockDir.set(mockJsonDir)
    outputDir.set(generatedMockDir)
    useMock.set(useMockFlag)
}

tasks.matching { it.name == "compileKotlinJs" }.configureEach {
    dependsOn(generateMockData)
}