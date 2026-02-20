package io.kudos.console.ui.api

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import io.ktor.utils.io.readRemaining
import io.ktor.utils.io.core.readText
import kotlin.math.min
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Simple auth check to mimic protected endpoints.
private fun hasAuth(headers: Headers): Boolean {
    val auth = headers[HttpHeaders.Authorization] ?: return false
    return auth.startsWith("Bearer ")
}

private val json = Json { ignoreUnknownKeys = true }

private suspend fun requestBodyText(body: OutgoingContent): String =
    when (body) {
        is OutgoingContent.ByteArrayContent -> body.bytes().decodeToString()
        is OutgoingContent.ReadChannelContent -> runCatching {
            body.readFrom().readRemaining().readText()
        }.getOrDefault("")
        is OutgoingContent.NoContent -> ""
        else -> body.toString()
    }

private fun parseJsonObjectOrEmpty(raw: String): JsonObject {
    if (raw.isBlank()) return JsonObject(emptyMap())
    val first = runCatching { json.parseToJsonElement(raw) }.getOrElse { return JsonObject(emptyMap()) }
    return when {
        first is JsonObject -> first
        first is JsonPrimitive && first.isString -> {
            val unwrapped = first.contentOrNull ?: return JsonObject(emptyMap())
            runCatching { json.parseToJsonElement(unwrapped).jsonObject }.getOrElse { JsonObject(emptyMap()) }
        }
        else -> JsonObject(emptyMap())
    }
}

private fun primitiveString(obj: JsonObject, key: String): String? =
    obj[key]?.jsonPrimitive?.contentOrNull

private fun primitiveInt(obj: JsonObject, key: String): Int? =
    obj[key]?.jsonPrimitive?.intOrNull

private fun primitiveBoolean(obj: JsonObject, key: String): Boolean? {
    val primitive = obj[key]?.jsonPrimitive ?: return null
    primitive.booleanOrNull?.let { return it }
    val content = primitive.contentOrNull ?: return null
    return when (content.lowercase()) {
        "true" -> true
        "false" -> false
        else -> null
    }
}

private data class CacheSearchParams(
    val name: String,
    val atomicServiceCode: String,
    val strategyDictCode: String,
    val active: Boolean?,
    val writeOnBoot: Boolean?,
    val writeInTime: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private const val MAX_PAGE_SIZE = 200
private val CACHE_SEARCH_ALLOWED_KEYS = setOf(
    "name",
    "atomicServiceCode",
    "strategyDictCode",
    "active",
    "writeOnBoot",
    "writeInTime",
    "pageNo",
    "pageSize",
    "orders",
)
private val CACHE_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "name",
    "atomicServiceCode",
    "strategyDictCode",
    "writeOnBoot",
    "writeInTime",
    "ttl",
    "remark",
    "active",
)

private fun parseOptionalStringParam(params: JsonObject, key: String): String? {
    val element = params[key] ?: return ""
    if (element is JsonNull) return ""
    if (element !is JsonPrimitive || !element.isString) return null
    return element.contentOrNull?.trim() ?: ""
}

private fun parseOptionalBooleanParam(params: JsonObject, key: String): Boolean? {
    val element = params[key] ?: return null
    if (element is JsonNull) return null
    if (element !is JsonPrimitive) return null
    element.booleanOrNull?.let { return it }
    if (!element.isString) return null
    return when (element.contentOrNull?.lowercase()) {
        "true" -> true
        "false" -> false
        else -> null
    }
}

private fun parsePositiveIntParam(params: JsonObject, key: String, defaultValue: Int): Int? {
    val element = params[key] ?: return defaultValue
    if (element is JsonNull) return defaultValue
    if (element !is JsonPrimitive) return null
    val value = element.intOrNull ?: return null
    if (value <= 0) return null
    return value
}

private fun parseSortParam(params: JsonObject): Pair<String?, String>? {
    val element = params["orders"] ?: return null to "ASC"
    if (element !is JsonArray) return null
    val first = element.firstOrNull() ?: return null to "ASC"
    if (first !is JsonObject) return null
    val property = first["property"]
    val direction = first["direction"]
    if (property !is JsonPrimitive || !property.isString) return null
    val propertyValue = property.contentOrNull ?: return null
    if (propertyValue !in CACHE_SEARCH_ALLOWED_SORT_PROPERTIES) return null
    val directionValue = if (direction is JsonPrimitive && direction.isString) {
        (direction.contentOrNull ?: "ASC").uppercase()
    } else {
        "ASC"
    }
    if (directionValue != "ASC" && directionValue != "DESC") return null
    return propertyValue to directionValue
}

private fun validateAndParseCacheSearchParams(params: JsonObject): CacheSearchParams {
    // 白名单策略：只解析允许字段；未知字段直接忽略，避免影响查询可用性

    val name = parseOptionalStringParam(params, "name") ?: ""
    val atomicServiceCode = parseOptionalStringParam(params, "atomicServiceCode") ?: ""
    val strategyDictCode = parseOptionalStringParam(params, "strategyDictCode") ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val writeOnBoot = parseOptionalBooleanParam(params, "writeOnBoot")
    val writeInTime = parseOptionalBooleanParam(params, "writeInTime")

    val pageNo = parsePositiveIntParam(params, "pageNo", 1) ?: 1
    val pageSizeRaw = parsePositiveIntParam(params, "pageSize", 20) ?: 20
    val pageSize = pageSizeRaw.coerceAtMost(MAX_PAGE_SIZE)

    val sortPair = parseSortParam(params) ?: (null to "ASC")

    return CacheSearchParams(
        name = name,
        atomicServiceCode = atomicServiceCode,
        strategyDictCode = strategyDictCode,
        active = active,
        writeOnBoot = writeOnBoot,
        writeInTime = writeInTime,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

private fun applySort(rows: List<JsonObject>, orderProperty: String?, orderDirection: String): List<JsonObject> {
    if (orderProperty.isNullOrBlank()) return rows

    val sorted = rows.sortedBy { row ->
        val value: JsonElement? = row[orderProperty]
        when (value) {
            is JsonPrimitive -> value.contentOrNull ?: ""
            else -> ""
        }
    }
    return if (orderDirection == "DESC") sorted.reversed() else sorted
}

private fun buildCacheSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = validateAndParseCacheSearchParams(paramsObj)

    var filtered = allRows.filter { row ->
        val rowName = primitiveString(row, "name").orEmpty()
        val rowAtomic = primitiveString(row, "atomicServiceCode").orEmpty()
        val rowStrategy = primitiveString(row, "strategyDictCode").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        val rowWriteOnBoot = primitiveBoolean(row, "writeOnBoot")
        val rowWriteInTime = primitiveBoolean(row, "writeInTime")
        (params.name.isEmpty() || rowName.contains(params.name, ignoreCase = true)) &&
            (params.atomicServiceCode.isEmpty() || rowAtomic == params.atomicServiceCode) &&
            (params.strategyDictCode.isEmpty() || rowStrategy == params.strategyDictCode) &&
            (params.active == null || rowActive == params.active) &&
            (params.writeOnBoot == null || rowWriteOnBoot == params.writeOnBoot) &&
            (params.writeInTime == null || rowWriteInTime == params.writeInTime)
    }

    filtered = applySort(filtered, params.orderProperty, params.orderDirection)

    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList() else filtered.subList(fromIndex, toIndex)

    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

// Responds using JSON fixtures loaded into MockJsonStore at build time.
internal fun createMockEngine(): MockEngine = MockEngine { request ->
    val path = request.url.encodedPath
    val headers = headersOf(HttpHeaders.ContentType, "application/json")
    when (path) {
        "/api/auth/login" -> {
            val body = MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/api/me", "/api/menus" -> {
            if (!hasAuth(request.headers)) {
                respond("{}", HttpStatusCode.Unauthorized, headers)
            } else {
                val body = MockJsonStore.byPath[path] ?: "{}"
                respond(body, HttpStatusCode.OK, headers)
            }
        }
        "/sys/cache/search", "/api/sys/cache/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildCacheSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        else -> {
            val body = MockJsonStore.byPath[path]
            if (body == null) {
                respond("{}", HttpStatusCode.NotFound, headers)
            } else {
                respond(body, HttpStatusCode.OK, headers)
            }
        }
    }
}
