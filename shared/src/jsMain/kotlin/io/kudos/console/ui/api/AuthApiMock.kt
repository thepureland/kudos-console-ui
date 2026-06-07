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
    val hash: Boolean?,
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
    "hash",
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
    "hash",
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

/**
 * Parse the first element of the `orders` array into a (property, direction) pair.
 * Returns null (rather than a default) on structural errors so callers can distinguish
 * "no sort requested" from "invalid sort input".
 * Note: nearly-identical copies exist as [parseSortParamForParam], [parseSortParamForResource],
 * and [parseSortParamWithAllowed] — each validates against a different allowed-property set.
 */
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
    // Whitelist strategy: parse only allowed fields; unknown fields are ignored to avoid impacting query availability.

    val name = parseOptionalStringParam(params, "name") ?: ""
    val atomicServiceCode = parseOptionalStringParam(params, "atomicServiceCode") ?: ""
    val strategyDictCode = parseOptionalStringParam(params, "strategyDictCode") ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val hash = parseOptionalBooleanParam(params, "hash")
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
        hash = hash,
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

private data class DataSourceSearchParams(
    val subSystemCode: String?,
    val tenantId: String?,
    val microserviceCode: String?,
    val name: String,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
)

private fun parseDataSourceSearchParams(params: JsonObject): DataSourceSearchParams {
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val microserviceCode = primitiveString(params, "microServiceCode")?.takeIf { it.isNotBlank() }
    val name = parseOptionalStringParam(params, "name").orEmpty()
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    return DataSourceSearchParams(subSystemCode, tenantId, microserviceCode, name, active, pageNo, pageSize)
}

private fun buildDataSourceSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = parseDataSourceSearchParams(paramsObj)

    val filtered = allRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSystemCode")?.takeIf { it.isNotBlank() }
            ?: primitiveString(row, "subSystemCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowMicroservice = primitiveString(row, "microServiceCode")?.takeIf { it.isNotBlank() }
            ?: primitiveString(row, "microservice").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.subSystemCode == null || params.subSystemCode == rowSubSys) &&
            (params.tenantId == null || params.tenantId == rowTenantId) &&
            (params.microserviceCode == null || params.microserviceCode == rowMicroservice) &&
            (params.name.isEmpty() || rowName.contains(params.name, ignoreCase = true)) &&
            (params.active == null || rowActive == params.active)
    }

    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList() else filtered.subList(fromIndex, toIndex)

    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/**
 * I18n detail: look up a single row by id from the same inline mock data used by
 * [buildI18nSearchResponse].  The data is duplicated here rather than loaded from
 * [MockJsonStore] because the detail endpoint appends audit fields (createTime, updateTime, etc.)
 * that are absent from the search fixture — keeping them separate avoids mutating shared state.
 */
private fun buildI18nGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("i18n_1"))
            put("key", JsonPrimitive("common.save"))
            put("value", JsonPrimitive("Save"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_2"))
            put("key", JsonPrimitive("common.cancel"))
            put("value", JsonPrimitive("Cancel"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict_item"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_3"))
            put("key", JsonPrimitive("common.save"))
            put("value", JsonPrimitive("Save"))
            put("locale", JsonPrimitive("en-US"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_4"))
            put("key", JsonPrimitive("sys.i18n.title"))
            put("value", JsonPrimitive("I18n Management"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("view"))
            put("atomicServiceCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("builtIn", JsonPrimitive(false))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_5"))
            put("key", JsonPrimitive("sys.i18n.key"))
            put("value", JsonPrimitive("Key"))
            put("locale", JsonPrimitive("zh-TW"))
            put("i18nTypeDictCode", JsonPrimitive("dict_item"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(false))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** DataSource detail: look up a single row by id from the search fixture; returns 404 if no fixture or not found. */
private fun buildDataSourceGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/dataSource/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/dataSource/search"]
        ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val row = allRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/**
 * Normalise an incoming request path so that `/api/admin/...` and `/api/...` both resolve
 * to the same fixture key stored under `/api/...` in [MockJsonStore].
 * Paths that do not start with `/api/admin` are returned unchanged.
 */
private fun resolveFixturePath(path: String): String = when {
    path.startsWith("/api/admin") -> "/api" + path.removePrefix("/api/admin")
    else -> path
}

/**
 * Build the paginated, filtered, sorted cache search response.
 * NOTE: unlike other search helpers, the top-level JSON returned here does NOT include a
 * "code" field — it wraps only {data, totalCount}. This is intentional to match the cache
 * endpoint contract used by the frontend table component.
 */
private fun buildCacheSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = validateAndParseCacheSearchParams(paramsObj)

    var filtered = allRows.filter { row ->
        val rowName = primitiveString(row, "name").orEmpty()
        val rowAtomic = primitiveString(row, "atomicServiceCode").orEmpty()
        val rowStrategy = primitiveString(row, "strategyDictCode").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        val rowHash = primitiveBoolean(row, "hash")
        val rowWriteOnBoot = primitiveBoolean(row, "writeOnBoot")
        val rowWriteInTime = primitiveBoolean(row, "writeInTime")
        (params.name.isEmpty() || rowName.contains(params.name, ignoreCase = true)) &&
            (params.atomicServiceCode.isEmpty() || rowAtomic == params.atomicServiceCode) &&
            (params.strategyDictCode.isEmpty() || rowStrategy == params.strategyDictCode) &&
            (params.active == null || rowActive == params.active) &&
            (params.hash == null || rowHash == params.hash) &&
            (params.writeOnBoot == null || rowWriteOnBoot == params.writeOnBoot) &&
            (params.writeInTime == null || rowWriteInTime == params.writeInTime)
    }

    filtered = applySort(filtered, params.orderProperty, params.orderDirection)

    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList() else filtered.subList(fromIndex, toIndex)

    val response = buildJsonObject {
        put("data", JsonArray(pageRows))
        put("totalCount", JsonPrimitive(total))
    }
    return response.toString()
}

/** Look up the matching row in the cache search data by request id and return its detail; falls back to the static getDetail text when not found. */
private fun buildCacheGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/cache/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/cache/search"]
        ?: return (MockJsonStore.byPath["/sys/cache/getDetail"] ?: MockJsonStore.byPath["/api/sys/cache/getDetail"])
            ?: "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val row = allRows.firstOrNull { primitiveString(it, "id") == requestId }
    if (row == null) {
        return (MockJsonStore.byPath["/sys/cache/getDetail"] ?: MockJsonStore.byPath["/api/sys/cache/getDetail"])
            ?: "{\"code\":404,\"data\":null}"
    }
    val detailObj = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        if (!row.containsKey("createTime")) put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        if (!row.containsKey("updateTime")) put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        if (!row.containsKey("createUser")) put("createUser", JsonPrimitive(""))
        if (!row.containsKey("updateUser")) put("updateUser", JsonPrimitive(""))
    }
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", detailObj)
    }
    return response.toString()
}

private data class ParamSearchParams(
    val id: String,
    val module: String,
    val paramName: String,
    val paramValue: String,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val PARAM_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "paramName", "paramValue", "defaultValue", "module", "seqNo", "active", "remark",
)

private fun parseParamSearchParams(params: JsonObject): ParamSearchParams {
    val id = parseOptionalStringParam(params, "id")?.trim() ?: ""
    val module = parseOptionalStringParam(params, "module") ?: ""
    val paramName = parseOptionalStringParam(params, "paramName") ?: ""
    val paramValue = parseOptionalStringParam(params, "paramValue") ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = parsePositiveIntParam(params, "pageNo", 1) ?: 1
    val pageSizeRaw = parsePositiveIntParam(params, "pageSize", 10) ?: 10
    val pageSize = pageSizeRaw.coerceAtMost(MAX_PAGE_SIZE)
    val sortPair = parseSortParamForParam(params)
    return ParamSearchParams(
        id = id,
        module = module.trim(),
        paramName = paramName.trim(),
        paramValue = paramValue.trim(),
        active = active,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

// NOTE: this is a hand-rolled duplicate of parseSortParamWithAllowed; it predates that
// function and cannot be removed without touching the Kotlin module build.
private fun parseSortParamForParam(params: JsonObject): Pair<String?, String> {
    val element = params["orders"] ?: return null to "ASC"
    if (element !is JsonArray) return null to "ASC"
    val first = element.firstOrNull() ?: return null to "ASC"
    if (first !is JsonObject) return null to "ASC"
    val property = first["property"]
    val direction = first["direction"]
    if (property !is JsonPrimitive || !property.isString) return null to "ASC"
    val propertyValue = property.contentOrNull ?: return null to "ASC"
    if (propertyValue !in PARAM_SEARCH_ALLOWED_SORT_PROPERTIES) return null to "ASC"
    val directionValue = if (direction is JsonPrimitive && direction.isString) {
        (direction.contentOrNull ?: "ASC").uppercase()
    } else "ASC"
    return if (directionValue == "DESC") propertyValue to "DESC" else propertyValue to "ASC"
}

/** Param list inline data; returned after filtering, sorting, and paging by module/paramName/paramValue/active. */
private fun buildParamSearchResponse(requestJson: String): String {
    val params = parseParamSearchParams(parseJsonObjectOrEmpty(requestJson))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("1"))
            put("paramName", JsonPrimitive("sys.name"))
            put("paramValue", JsonPrimitive("Kudos Console"))
            put("defaultValue", JsonPrimitive("Kudos"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("System display name"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("2"))
            put("paramName", JsonPrimitive("sys.pageSize"))
            put("paramValue", JsonPrimitive("20"))
            put("defaultValue", JsonPrimitive("10"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(2))
            put("remark", JsonPrimitive("Default page size"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("3"))
            put("paramName", JsonPrimitive("sys.cache.ttl"))
            put("paramValue", JsonPrimitive("3600"))
            put("defaultValue", JsonPrimitive("1800"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(3))
            put("remark", JsonPrimitive("Cache expiration time (seconds)"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("4"))
            put("paramName", JsonPrimitive("log.level"))
            put("paramValue", JsonPrimitive("INFO"))
            put("defaultValue", JsonPrimitive("WARN"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(2) { "auth" }))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("Log level"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("5"))
            put("paramName", JsonPrimitive("job.enabled"))
            put("paramValue", JsonPrimitive("true"))
            put("defaultValue", JsonPrimitive("false"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(3) { "msg" }))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("Whether to enable task scheduling"))
            put("active", JsonPrimitive(false))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowId = primitiveString(row, "id").orEmpty()
        val rowModule = primitiveString(row, "module").orEmpty()
        val rowParamName = primitiveString(row, "paramName").orEmpty()
        val rowParamValue = primitiveString(row, "paramValue").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.id.isEmpty() || rowId == params.id) &&
            (params.module.isEmpty() || rowModule == params.module) &&
            (params.paramName.isEmpty() || rowParamName.contains(params.paramName, ignoreCase = true)) &&
            (params.paramValue.isEmpty() || rowParamValue.contains(params.paramValue, ignoreCase = true)) &&
            (params.active == null || rowActive == params.active)
    }
    filtered = applySort(filtered, params.orderProperty, params.orderDirection)
    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Param detail: look up a single row by id from data consistent with search and fill in fields like createTime. */
private fun buildParamGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        "1" to mapOf(
            "paramName" to "sys.name",
            "paramValue" to "Kudos Console",
            "defaultValue" to "Kudos",
            "remark" to "System display name",
            "seqNo" to 1,
            "active" to true,
        ),
        "2" to mapOf(
            "paramName" to "sys.pageSize",
            "paramValue" to "20",
            "defaultValue" to "10",
            "remark" to "Default page size",
            "seqNo" to 2,
            "active" to true,
        ),
        "3" to mapOf(
            "paramName" to "sys.cache.ttl",
            "paramValue" to "3600",
            "defaultValue" to "1800",
            "remark" to "Cache expiration time (seconds)",
            "seqNo" to 3,
            "active" to true,
        ),
        "4" to mapOf(
            "paramName" to "log.level",
            "paramValue" to "INFO",
            "defaultValue" to "WARN",
            "remark" to "Log level",
            "seqNo" to 1,
            "active" to true,
        ),
        "5" to mapOf(
            "paramName" to "job.enabled",
            "paramValue" to "true",
            "defaultValue" to "false",
            "remark" to "Whether to enable task scheduling",
            "seqNo" to 1,
            "active" to false,
        ),
    )
    val base = mockRows.firstOrNull { it.first == requestId }?.second
        ?: mapOf(
            "paramName" to "param",
            "paramValue" to "",
            "defaultValue" to "",
            "remark" to "",
            "seqNo" to 0,
            "active" to true,
        )
    val row = buildJsonObject {
        put("id", JsonPrimitive(requestId))
        put("paramName", JsonPrimitive(base["paramName"] as String))
        put("paramValue", JsonPrimitive(base["paramValue"] as String))
        put("defaultValue", JsonPrimitive(base["defaultValue"] as String))
        put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
        put("seqNo", JsonPrimitive((base["seqNo"] as Int)))
        put("active", JsonPrimitive(base["active"] as Boolean))
        put("builtIn", JsonPrimitive(false))
        put("remark", JsonPrimitive(base["remark"] as String))
        put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

private data class ResourceSearchParams(
    val subSystemCode: String,
    val resourceTypeDictCode: String,
    val name: String,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val RESOURCE_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "name", "url", "icon", "seqNo", "active", "subSystemCode", "resourceTypeDictCode",
)

private fun parseResourceSearchParams(params: JsonObject): ResourceSearchParams {
    val subSystemCode = parseOptionalStringParam(params, "subSystemCode")?.trim() ?: ""
    val resourceTypeDictCode = parseOptionalStringParam(params, "resourceTypeDictCode")?.trim() ?: ""
    val name = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = parsePositiveIntParam(params, "pageNo", 1) ?: 1
    val pageSizeRaw = parsePositiveIntParam(params, "pageSize", 10) ?: 10
    val pageSize = pageSizeRaw.coerceAtMost(MAX_PAGE_SIZE)
    val sortPair = parseSortParamForResource(params)
    return ResourceSearchParams(
        subSystemCode = subSystemCode,
        resourceTypeDictCode = resourceTypeDictCode,
        name = name,
        active = active,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

// NOTE: this is a hand-rolled duplicate of parseSortParamWithAllowed; it predates that
// function and cannot be removed without touching the Kotlin module build.
private fun parseSortParamForResource(params: JsonObject): Pair<String?, String> {
    val element = params["orders"] ?: return null to "ASC"
    if (element !is JsonArray) return null to "ASC"
    val first = element.firstOrNull() ?: return null to "ASC"
    if (first !is JsonObject) return null to "ASC"
    val property = first["property"]
    val direction = first["direction"]
    if (property !is JsonPrimitive || !property.isString) return null to "ASC"
    val propertyValue = property.contentOrNull ?: return null to "ASC"
    if (propertyValue !in RESOURCE_SEARCH_ALLOWED_SORT_PROPERTIES) return null to "ASC"
    val directionValue = if (direction is JsonPrimitive && direction.isString) {
        (direction.contentOrNull ?: "ASC").uppercase()
    } else "ASC"
    return if (directionValue == "DESC") propertyValue to "DESC" else propertyValue to "ASC"
}

private fun buildResourceSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = parseResourceSearchParams(paramsObj)

    var filtered = allRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSystemCode").orEmpty()
        val rowType = primitiveString(row, "resourceTypeDictCode").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.subSystemCode.isEmpty() || rowSubSys == params.subSystemCode) &&
            (params.resourceTypeDictCode.isEmpty() || rowType == params.resourceTypeDictCode) &&
            (params.name.isEmpty() || rowName.contains(params.name, ignoreCase = true)) &&
            (params.active == null || rowActive == params.active)
    }

    filtered = applySort(filtered, params.orderProperty, params.orderDirection)

    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList() else filtered.subList(fromIndex, toIndex)

    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Resource detail: look up a single row by id from the search fixture and fill in parentIds for cascading edit prefill. */
private fun buildResourceGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/resource/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/resource/search"]
        ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = (dataObj["data"] ?: dataObj["first"])?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val row = allRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    val resourceType = primitiveString(row, "resourceTypeDictCode").orEmpty()
    val subSys = primitiveString(row, "subSystemCode").orEmpty()
    val parentId = primitiveString(row, "parentId")?.takeIf { it.isNotBlank() }
    val parentIds = JsonArray(
        listOf(JsonPrimitive(resourceType), JsonPrimitive(subSys)) +
            if (parentId != null) listOf(JsonPrimitive(parentId)) else emptyList()
    )
    val detailRow = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("parentIds", parentIds)
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", detailRow)
    }.toString()
    return body
}

private data class DomainSearchParams(
    val id: String,
    val domain: String,
    val subSystemCode: String?,
    val tenantId: String?,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val DOMAIN_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "domain", "subSystemCode", "tenantName", "active", "remark", "createTime",
)

private fun parseDomainSearchParams(params: JsonObject): DomainSearchParams {
    val id = parseOptionalStringParam(params, "id")?.trim() ?: ""
    val domain = parseOptionalStringParam(params, "domain")?.trim() ?: ""
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, DOMAIN_SEARCH_ALLOWED_SORT_PROPERTIES)
    return DomainSearchParams(
        id = id,
        domain = domain,
        subSystemCode = subSystemCode,
        tenantId = tenantId,
        active = active,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

/**
 * Generic sort-parameter parser that validates the sort property against a caller-supplied
 * allowlist.  This is the canonical version; [parseSortParamForParam] and
 * [parseSortParamForResource] are older duplicates that predate this function.
 */
private fun parseSortParamWithAllowed(params: JsonObject, allowed: Set<String>): Pair<String?, String> {
    val element = params["orders"] ?: return null to "ASC"
    if (element !is JsonArray) return null to "ASC"
    val first = element.firstOrNull() ?: return null to "ASC"
    if (first !is JsonObject) return null to "ASC"
    val property = first["property"]
    val direction = first["direction"]
    if (property !is JsonPrimitive || !property.isString) return null to "ASC"
    val propertyValue = property.contentOrNull ?: return null to "ASC"
    if (propertyValue !in allowed) return null to "ASC"
    val directionValue = if (direction is JsonPrimitive && direction.isString) {
        (direction.contentOrNull ?: "ASC").uppercase()
    } else "ASC"
    return if (directionValue == "DESC") propertyValue to "DESC" else propertyValue to "ASC"
}

private data class TenantSearchParams(
    val name: String,
    val subSystemCode: String?,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val TENANT_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "name", "subSystemCode", "active", "createTime",
)

/** Mock account list search: filter by username/subSystemCode/tenantId/organizationId, then sort and paginate. */
private fun buildAccountSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val username = parseOptionalStringParam(params, "username")?.trim() ?: ""
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val organizationId = primitiveString(params, "organizationId")?.takeIf { it.isNotBlank() }
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, setOf("username", "createTime", "lastLoginTime"))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("acc_1"))
            put("username", JsonPrimitive("admin"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("default"))
            put("tenantName", JsonPrimitive("Default Tenant"))
            put("organizationId", JsonPrimitive("org_1"))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("ADMIN"))
            put("lastLoginTime", JsonPrimitive("2024-02-01 09:00:00"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_2"))
            put("username", JsonPrimitive("user1"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t1"))
            put("tenantName", JsonPrimitive("Tenant 1"))
            put("organizationId", JsonPrimitive("org_2"))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonNull)
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_3"))
            put("username", JsonPrimitive("user2"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("1"))
            put("tenantName", JsonPrimitive("Tenant A1"))
            put("organizationId", JsonPrimitive("org_3"))
            put("userStatusDictCode", JsonPrimitive("LOCKED"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonPrimitive("2024-01-15 14:00:00"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowUsername = primitiveString(row, "username").orEmpty()
        val rowSubSys = primitiveString(row, "subSystemCode").orEmpty()
        val rowOrgId = primitiveString(row, "organizationId").orEmpty()
        (username.isEmpty() || rowUsername.contains(username, ignoreCase = true)) &&
            (subSystemCode == null || subSystemCode == rowSubSys) &&
            // tenantId filtering is intentionally skipped here: account rows in the search list
        // store a display tenantId that may differ from the one used by the detail endpoint.
        // The detail mock normalises the value (see buildAccountGetDetailResponse).
        (tenantId == null || true) &&
            (organizationId == null || organizationId == rowOrgId)
    }
    filtered = applySort(filtered, sortPair.first, sortPair.second)
    val total = filtered.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Account detail: look up a single row by id from mock data consistent with search and fill in detail fields. tenantId must match getAllActiveTenants (console -> t6/default/tenant_2, service_a -> t5/1). */
private fun buildAccountGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("acc_1"))
            put("username", JsonPrimitive("admin"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t6"))
            put("organizationId", JsonPrimitive("org_1"))
            put("parentIds", JsonArray(listOf(JsonPrimitive("org_1"))))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("ADMIN"))
            put("lastLoginTime", JsonPrimitive("2024-02-01 09:00:00"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_2"))
            put("username", JsonPrimitive("user1"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("default"))
            put("organizationId", JsonPrimitive("org_2"))
            put("parentIds", JsonArray(listOf(JsonPrimitive("org_1"), JsonPrimitive("org_2"))))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonNull)
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_3"))
            put("username", JsonPrimitive("user2"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("t5"))
            put("organizationId", JsonPrimitive("org_3"))
            put("parentIds", JsonArray(listOf(JsonPrimitive("org_1"), JsonPrimitive("org_3"))))
            put("userStatusDictCode", JsonPrimitive("LOCKED"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonPrimitive("2024-01-15 14:00:00"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        if (!row.containsKey("userStatusReason")) put("userStatusReason", JsonPrimitive(""))
        if (!row.containsKey("builtIn")) put("builtIn", JsonPrimitive(false))
        if (!row.containsKey("lockTimeStart")) put("lockTimeStart", JsonNull)
        if (!row.containsKey("lockTimeEnd")) put("lockTimeEnd", JsonNull)
        if (!row.containsKey("lastLogoutTime")) put("lastLogoutTime", JsonNull)
        if (!row.containsKey("lastLoginIp")) put("lastLoginIp", JsonPrimitive(""))
        if (!row.containsKey("lastLoginTerminalDictCode")) put("lastLoginTerminalDictCode", JsonPrimitive(""))
        if (!row.containsKey("totalOnlineTime")) put("totalOnlineTime", JsonNull)
        if (!row.containsKey("dynamicAuthKey")) put("dynamicAuthKey", JsonPrimitive(""))
        if (!row.containsKey("registerIp")) put("registerIp", JsonPrimitive(""))
        if (!row.containsKey("registerUrl")) put("registerUrl", JsonPrimitive(""))
        if (!row.containsKey("remark")) put("remark", JsonPrimitive(""))
        if (!row.containsKey("tenantId")) put("tenantId", JsonPrimitive(""))
        if (!row.containsKey("tenantName")) put("tenantName", JsonPrimitive(""))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock organization tree: returns an id/name/children structure. */
private fun buildOrganizationLoadTreeResponse(subSystemCode: String?, tenantId: String?): String {
    val nodes = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("org_1"))
            put("name", JsonPrimitive("HQ"))
            put("children", JsonArray(listOf(
                buildJsonObject {
                    put("id", JsonPrimitive("org_2"))
                    put("name", JsonPrimitive("R&D Dept"))
                    put("children", JsonArray(emptyList()))
                },
                buildJsonObject {
                    put("id", JsonPrimitive("org_3"))
                    put("name", JsonPrimitive("Marketing Dept"))
                    put("children", JsonArray(emptyList()))
                },
            )))
        },
    )
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(nodes))
    }
    return response.toString()
}

private val ROLE_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "roleCode", "roleName", "subSystemCode", "active", "createTime",
)

/** Mock role list search: filter by subSystemCode/tenantId/roleCode/roleName/active, then sort and paginate. */
private fun buildRoleSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val roleCode = parseOptionalStringParam(params, "roleCode")?.trim() ?: ""
    val roleName = parseOptionalStringParam(params, "roleName")?.trim() ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, ROLE_SEARCH_ALLOWED_SORT_PROPERTIES)
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("role_1"))
            put("roleCode", JsonPrimitive("ADMIN"))
            put("roleName", JsonPrimitive("Administrator"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("System administrator role"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_2"))
            put("roleCode", JsonPrimitive("USER"))
            put("roleName", JsonPrimitive("Regular User"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t1"))
            put("remark", JsonPrimitive("Tenant regular user"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_3"))
            put("roleCode", JsonPrimitive("GUEST"))
            put("roleName", JsonPrimitive("Guest"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("Read-only guest"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSystemCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowCode = primitiveString(row, "roleCode").orEmpty()
        val rowName = primitiveString(row, "roleName").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (subSystemCode == null || subSystemCode == rowSubSys) &&
            (tenantId == null || tenantId == rowTenantId) &&
            (roleCode.isEmpty() || rowCode.contains(roleCode, ignoreCase = true)) &&
            (roleName.isEmpty() || rowName.contains(roleName, ignoreCase = true)) &&
            (active == null || rowActive == active)
    }
    filtered = applySort(filtered, sortPair.first, sortPair.second)
    val total = filtered.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Role detail: look up a single row by id from mock data consistent with search and fill in detail fields. */
private fun buildRoleGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("role_1"))
            put("roleCode", JsonPrimitive("ADMIN"))
            put("roleName", JsonPrimitive("Administrator"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("System administrator role"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_2"))
            put("roleCode", JsonPrimitive("USER"))
            put("roleName", JsonPrimitive("Regular User"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t1"))
            put("remark", JsonPrimitive("Tenant regular user"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_3"))
            put("roleCode", JsonPrimitive("GUEST"))
            put("roleName", JsonPrimitive("Guest"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("Read-only guest"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("tenantName", JsonPrimitive(if (primitiveString(row, "tenantId") == "t1") "Tenant 1" else ""))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
        put("builtIn", JsonPrimitive(false))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

private val USER_GROUP_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "groupCode", "groupName", "active", "createTime",
)

/** Mock user group (group management) list search: filter by groupCode/groupName/active, then sort and paginate. */
private fun buildUserGroupSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val groupCode = parseOptionalStringParam(params, "groupCode")?.trim() ?: ""
    val groupName = parseOptionalStringParam(params, "groupName")?.trim() ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, USER_GROUP_SEARCH_ALLOWED_SORT_PROPERTIES)
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("group_1"))
            put("groupCode", JsonPrimitive("ADMIN_GROUP"))
            put("groupName", JsonPrimitive("Administrator Group"))
            put("remark", JsonPrimitive("System administrator user group"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_2"))
            put("groupCode", JsonPrimitive("DEV_GROUP"))
            put("groupName", JsonPrimitive("Development Group"))
            put("remark", JsonPrimitive("Development team"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_3"))
            put("groupCode", JsonPrimitive("GUEST_GROUP"))
            put("groupName", JsonPrimitive("Guest Group"))
            put("remark", JsonPrimitive("Read-only guest"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowCode = primitiveString(row, "groupCode").orEmpty()
        val rowName = primitiveString(row, "groupName").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (groupCode.isEmpty() || rowCode.contains(groupCode, ignoreCase = true)) &&
            (groupName.isEmpty() || rowName.contains(groupName, ignoreCase = true)) &&
            (active == null || rowActive == active)
    }
    filtered = applySort(filtered, sortPair.first, sortPair.second)
    val total = filtered.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** User group detail: look up a single row by id from mock data consistent with search and fill in detail fields. */
private fun buildUserGroupGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("group_1"))
            put("groupCode", JsonPrimitive("ADMIN_GROUP"))
            put("groupName", JsonPrimitive("Administrator Group"))
            put("remark", JsonPrimitive("System administrator user group"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_2"))
            put("groupCode", JsonPrimitive("DEV_GROUP"))
            put("groupName", JsonPrimitive("Development Group"))
            put("remark", JsonPrimitive("Development team"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_3"))
            put("groupCode", JsonPrimitive("GUEST_GROUP"))
            put("groupName", JsonPrimitive("Guest Group"))
            put("remark", JsonPrimitive("Read-only guest"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("subSystemCode", JsonPrimitive("console"))
        put("ownerId", JsonPrimitive(""))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
        put("builtIn", JsonPrimitive(false))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock organization list tree searchTree: like the role list, parses subSystemCode/tenantId from the body and returns different trees filtered by tenantId; returns empty when tenantId is absent. */
private fun buildOrganizationSearchTreeResponse(requestJson: String, tenantIdFromQuery: String? = null): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    // Consistent with buildRoleSearchResponse: first read tenantId / subSystemCode from the body.
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    var tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    if (tenantId.isNullOrBlank()) {
        // `subSysOrTenant` is a two-element array [subSystemCode, tenantId] sent by the
        // cascading subsystem/tenant picker in the organization search form.
        tenantId = (params["subSysOrTenant"] as? JsonArray)?.getOrNull(1)?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
    }
    if (tenantId.isNullOrBlank()) {
        tenantId = tenantIdFromQuery?.takeIf { it.isNotBlank() }
    }
    val activeOnly = parseOptionalBooleanParam(params, "active") == true
    if (tenantId.isNullOrBlank()) {
        return buildJsonObject {
            put("code", JsonPrimitive(200))
            put("data", JsonArray(emptyList<JsonObject>()))
        }.toString()
    }
    fun node(id: String, name: String, abbr: String, orgType: String, seq: Int, active: Boolean, createTime: String, children: List<JsonObject>) = buildJsonObject {
        put("id", JsonPrimitive(id))
        put("name", JsonPrimitive(name))
        put("abbrName", JsonPrimitive(abbr))
        put("orgTypeDictCode", JsonPrimitive(orgType))
        put("seqNo", JsonPrimitive(seq))
        put("active", JsonPrimitive(active))
        put("createTime", JsonPrimitive(createTime))
        put("children", JsonArray(children))
    }
    // Consistent with getAllActiveTenants: under console there are t1..t6, default, tenant_2; each tenant returns a different name for distinction.
    val names = when (tenantId) {
        "t1" -> listOf("HQ (Tenant 1)", "R&D Dept", "Marketing Dept", "Disabled Dept")
        "t2" -> listOf("HQ (Tenant 2)", "Dept A", "Dept B", "Dept C")
        "t3" -> listOf("HQ (Tenant 3)", "Tech Dept", "Sales Dept", "Disabled")
        "t4" -> listOf("HQ (Tenant 4)", "Sub Dept 1", "Sub Dept 2", "Sub Dept 3")
        "t5" -> listOf("HQ (Tenant 5)", "Operations Dept", "Finance Dept", "Disabled")
        "t6" -> listOf("HQ (Tenant 6)", "R&D Dept", "Marketing Dept", "Disabled Dept")
        "default" -> listOf("HQ (Default Tenant)", "Dept A", "Dept B", "Dept C")
        "tenant_2" -> listOf("HQ (Tenant 2 CN)", "Tech Dept", "Sales Dept", "Disabled")
        "1" -> listOf("HQ (Tenant A1)", "Dept X", "Dept Y", "Disabled")
        else -> listOf("HQ ($tenantId)", "Sub Dept 1", "Sub Dept 2", "Sub Dept 3")
    }
    val rootName = names[0]
    val c1Name = names[1]
    val c2Name = names[2]
    val c3Name = names[3]
    val c1 = node("org_2", c1Name, c1Name.take(2), "dept", 1, true, "2024-01-02 10:00:00", emptyList())
    val c2 = node("org_3", c2Name, c2Name.take(2), "dept", 2, true, "2024-01-03 10:00:00", emptyList())
    val c3 = node("org_4", c3Name, c3Name.take(2), "dept", 3, false, "2024-01-04 10:00:00", emptyList())
    val root = node("org_1", rootName, rootName.take(2), "company", 0, true, "2024-01-01 10:00:00", listOf(c1, c2, c3))
    fun filterByActiveOnly(obj: JsonObject): JsonObject? {
        if (activeOnly) {
            val a = primitiveBoolean(obj, "active") ?: return null
            if (!a) return null
        }
        val rawChildren = obj["children"]?.jsonArray?.mapNotNull { e -> (e as? JsonObject)?.let { filterByActiveOnly(it) } }.orEmpty()
        return buildJsonObject {
            obj.forEach { (k, v) -> if (k != "children") put(k, v) }
            put("children", JsonArray(rawChildren))
        }
    }
    val filteredRoot = filterByActiveOnly(root)
    val roots = if (filteredRoot != null) listOf(filteredRoot) else emptyList<JsonObject>()
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(roots))
    }
    return response.toString()
}

/** Organization detail: return a single row by id (the id matches the list searchTree and loadTree as org_1/org_2/org_3/org_4); on edit you get exactly the row you clicked. */
private fun buildOrganizationGetDetailResponse(requestId: String): String {
    val nameBySuffix = mapOf(
        "1" to "HQ", "2" to "R&D Dept", "3" to "Marketing Dept", "4" to "Disabled Dept"
    )
    val suffix = requestId.substringAfterLast('_', requestId)
    val name = nameBySuffix[suffix] ?: "Organization"
    val abbr = when (suffix) {
        "1" -> "HQ"
        "2" -> "R&D"
        "3" -> "Marketing"
        "4" -> "Disabled"
        else -> "—"
    }
    // Consistent with loadTree: org_1 (HQ) is the root with null parent; org_2/org_3/org_4 have org_1 as parent; for prefixed ids (e.g. org_console_t6_1) the suffix is used to detect the root.
    val isRoot = suffix == "1"
    val parentIds = if (isRoot) emptyList<String>() else listOf("org_1")
    val row = buildJsonObject {
        put("id", JsonPrimitive(requestId))
        put("name", JsonPrimitive(name))
        put("abbrName", JsonPrimitive(abbr))
        put("orgTypeDictCode", JsonPrimitive(if (suffix == "1") "company" else "dept"))
        put("seqNo", JsonPrimitive(suffix.toIntOrNull() ?: 0))
        put("active", JsonPrimitive(suffix != "4"))
        put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        put("subSystemCode", JsonPrimitive("console"))
        put("tenantId", JsonPrimitive("t6"))
        put("tenantName", JsonPrimitive("Tenant 1"))
        put("parentId", if (isRoot) JsonNull else JsonPrimitive("org_1"))
        put("parentIds", JsonArray(parentIds.map { JsonPrimitive(it) }))
        put("remark", JsonPrimitive(""))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
        put("builtIn", JsonPrimitive(false))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock subsystem list tree query searchTree: filter by code/name/active/subSystem and build the tree by parentCode. */
private fun buildSubsysSearchTreeResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val codeFilter = parseOptionalStringParam(params, "code")?.trim() ?: ""
    val nameFilter = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val activeOnly = parseOptionalBooleanParam(params, "active") == true
    val subSystemOnly = parseOptionalBooleanParam(params, "subSystem") == true
    fun node(
        id: String,
        code: String,
        name: String,
        parentCode: String?,
        subSystem: Boolean,
        active: Boolean,
        builtIn: Boolean,
        remark: String
    ) = buildJsonObject {
        put("id", JsonPrimitive(id))
        put("code", JsonPrimitive(code))
        put("name", JsonPrimitive(name))
        put("parentCode", if (parentCode != null) JsonPrimitive(parentCode) else JsonNull)
        put("subSystem", JsonPrimitive(subSystem))
        put("active", JsonPrimitive(active))
        put("builtIn", JsonPrimitive(builtIn))
        put("remark", JsonPrimitive(remark))
    }
    val flat = listOf(
        node("sys_1", "service_a", "Subsystem 1", null, true, true, true, "Business Service A"),
        node("sys_2", "console", "Subsystem 2", null, true, true, true, "Main Console"),
        node("sys_3", "service_b", "Subsystem 3", "console", true, false, true, "Business Service B"),
        node("sys_4", "module_x", "Module X", "service_a", false, true, false, "Submodule"),
        node("sys_5", "module_y", "Module Y", "service_a", false, true, false, ""),
    )
    fun filterNode(obj: JsonObject): Boolean {
        val rowCode = primitiveString(obj, "code").orEmpty()
        val rowName = primitiveString(obj, "name").orEmpty()
        val rowActive = primitiveBoolean(obj, "active")
        val rowSubSystem = primitiveBoolean(obj, "subSystem")
        if (codeFilter.isNotEmpty() && !rowCode.contains(codeFilter, ignoreCase = true)) return false
        if (nameFilter.isNotEmpty() && !rowName.contains(nameFilter, ignoreCase = true)) return false
        if (activeOnly && rowActive != true) return false
        if (subSystemOnly && rowSubSystem != true) return false
        return true
    }
    val filtered = flat.filter { filterNode(it) }
    val filteredCodes = filtered.map { primitiveString(it, "code")!! }.toSet()
    fun addChildren(parentCode: String?): List<JsonObject> {
        return filtered
            .filter { obj ->
                val p = primitiveString(obj, "parentCode").orEmpty()
                // A node becomes a root (parentCode == null) when its own parentCode is either
                // blank or points to a node that was removed by the filter, so it would be
                // orphaned if placed as a child.
                (parentCode == null && (p.isEmpty() || p !in filteredCodes)) ||
                    (parentCode != null && p == parentCode)
            }
            .map { obj ->
                val c = primitiveString(obj, "code")!!
                val children = addChildren(c)
                if (children.isEmpty()) obj
                else buildJsonObject {
                    obj.forEach { (k, v) -> if (k != "children") put(k, v) }
                    put("children", JsonArray(children))
                }
            }
    }
    val roots = addChildren(null)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(roots))
    }
    return response.toString()
}

/** Subsystem detail: look up a single row by id from the flat data consistent with searchTree. */
private fun buildSubsysGetDetailResponse(requestId: String): String {
    fun node(
        id: String,
        code: String,
        name: String,
        parentCode: String?,
        subSystem: Boolean,
        active: Boolean,
        builtIn: Boolean,
        remark: String
    ) = buildJsonObject {
        put("id", JsonPrimitive(id))
        put("code", JsonPrimitive(code))
        put("name", JsonPrimitive(name))
        put("parentCode", if (parentCode != null) JsonPrimitive(parentCode) else JsonNull)
        put("subSystem", JsonPrimitive(subSystem))
        put("active", JsonPrimitive(active))
        put("builtIn", JsonPrimitive(builtIn))
        put("remark", JsonPrimitive(remark))
    }
    val flat = listOf(
        node("sys_1", "service_a", "Subsystem 1", null, true, true, true, "Business Service A"),
        node("sys_2", "console", "Subsystem 2", null, true, true, true, "Main Console"),
        node("sys_3", "service_b", "Subsystem 3", "console", true, false, true, "Business Service B"),
        node("sys_4", "module_x", "Module X", "service_a", false, true, false, "Submodule"),
        node("sys_5", "module_y", "Module Y", "service_a", false, true, false, ""),
    )
    var row = flat.firstOrNull { primitiveString(it, "id") == requestId }
        ?: buildJsonObject {
            put("id", JsonPrimitive(requestId))
            put("code", JsonPrimitive(""))
            put("name", JsonPrimitive(""))
            put("parentCode", JsonNull)
            put("subSystem", JsonPrimitive(false))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(false))
            put("remark", JsonPrimitive(""))
        }
    // Audit info fields (shown on the detail page).
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock microservice list tree query searchTree: filter by code/name/active/atomicService and build the tree by parentCode. */
private fun buildMicroserviceSearchTreeResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val codeFilter = parseOptionalStringParam(params, "code")?.trim() ?: ""
    val nameFilter = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val activeOnly = parseOptionalBooleanParam(params, "active") == true
    val atomicServiceOnly = parseOptionalBooleanParam(params, "atomicService") == true
    fun node(
        id: String,
        code: String,
        name: String,
        parentCode: String?,
        atomicService: Boolean,
        context: String,
        active: Boolean,
        builtIn: Boolean,
        remark: String
    ) = buildJsonObject {
        put("id", JsonPrimitive(id))
        put("code", JsonPrimitive(code))
        put("name", JsonPrimitive(name))
        put("parentCode", if (parentCode != null) JsonPrimitive(parentCode) else JsonNull)
        put("atomicService", JsonPrimitive(atomicService))
        put("context", JsonPrimitive(context))
        put("active", JsonPrimitive(active))
        put("builtIn", JsonPrimitive(builtIn))
        put("remark", JsonPrimitive(remark))
    }
    val flat = listOf(
        node("ms_1", "gateway", "Gateway", null, true, "/gateway", true, true, "Unified gateway"),
        node("ms_2", "user-service", "User Service", "gateway", true, "/user", true, false, "User center"),
        node("ms_3", "order-service", "Order Service", "gateway", true, "/order", true, false, "Order center"),
        node("ms_4", "order-worker", "Order Worker", "order-service", false, "/order/worker", true, false, ""),
        node("ms_5", "legacy-api", "Legacy API", "gateway", false, "/legacy", false, true, "Legacy system"),
    )
    fun filterNode(obj: JsonObject): Boolean {
        val rowCode = primitiveString(obj, "code").orEmpty()
        val rowName = primitiveString(obj, "name").orEmpty()
        val rowActive = primitiveBoolean(obj, "active")
        val rowAtomicService = primitiveBoolean(obj, "atomicService")
        if (codeFilter.isNotEmpty() && !rowCode.contains(codeFilter, ignoreCase = true)) return false
        if (nameFilter.isNotEmpty() && !rowName.contains(nameFilter, ignoreCase = true)) return false
        if (activeOnly && rowActive != true) return false
        if (atomicServiceOnly && rowAtomicService != true) return false
        return true
    }
    val filtered = flat.filter { filterNode(it) }
    val filteredCodes = filtered.map { primitiveString(it, "code")!! }.toSet()
    fun addChildren(parentCode: String?): List<JsonObject> {
        return filtered
            .filter { obj ->
                val p = primitiveString(obj, "parentCode").orEmpty()
                // Same orphan-becomes-root logic as buildSubsysSearchTreeResponse:
                // a node is treated as a root when its parent was excluded by the active filter.
                (parentCode == null && (p.isEmpty() || p !in filteredCodes)) ||
                    (parentCode != null && p == parentCode)
            }
            .map { obj ->
                val c = primitiveString(obj, "code")!!
                val children = addChildren(c)
                if (children.isEmpty()) obj
                else buildJsonObject {
                    obj.forEach { (k, v) -> if (k != "children") put(k, v) }
                    put("children", JsonArray(children))
                }
            }
    }
    val roots = addChildren(null)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(roots))
    }
    return response.toString()
}

/** Microservice detail: look up a single row by id from the flat data consistent with searchTree. */
private fun buildMicroserviceGetDetailResponse(requestId: String): String {
    fun node(
        id: String,
        code: String,
        name: String,
        parentCode: String?,
        atomicService: Boolean,
        context: String,
        active: Boolean,
        builtIn: Boolean,
        remark: String
    ) = buildJsonObject {
        put("id", JsonPrimitive(id))
        put("code", JsonPrimitive(code))
        put("name", JsonPrimitive(name))
        put("parentCode", if (parentCode != null) JsonPrimitive(parentCode) else JsonNull)
        put("atomicService", JsonPrimitive(atomicService))
        put("context", JsonPrimitive(context))
        put("active", JsonPrimitive(active))
        put("builtIn", JsonPrimitive(builtIn))
        put("remark", JsonPrimitive(remark))
    }
    val flat = listOf(
        node("ms_1", "gateway", "Gateway", null, true, "/gateway", true, true, "Unified gateway"),
        node("ms_2", "user-service", "User Service", "gateway", true, "/user", true, false, "User center"),
        node("ms_3", "order-service", "Order Service", "gateway", true, "/order", true, false, "Order center"),
        node("ms_4", "order-worker", "Order Worker", "order-service", false, "/order/worker", true, false, ""),
        node("ms_5", "legacy-api", "Legacy API", "gateway", false, "/legacy", false, true, "Legacy system"),
    )
    var row = flat.firstOrNull { primitiveString(it, "id") == requestId }
        ?: buildJsonObject {
            put("id", JsonPrimitive(requestId))
            put("code", JsonPrimitive(""))
            put("name", JsonPrimitive(""))
            put("parentCode", JsonNull)
            put("atomicService", JsonPrimitive(false))
            put("context", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(false))
            put("remark", JsonPrimitive(""))
        }
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
        put("createUser", JsonPrimitive(""))
        put("updateUser", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

private val I18N_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "key", "value", "locale", "i18nTypeDictCode", "atomicServiceCode", "active", "builtIn",
)

/** Mock i18n list search: filter by key/i18nTypeDictCode/atomicServiceCode/locale/active, then sort and paginate. */
private fun buildI18nSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val keyFilter = parseOptionalStringParam(params, "key")?.trim() ?: ""
    val i18nTypeDictCode = parseOptionalStringParam(params, "i18nTypeDictCode")?.takeIf { it.isNotBlank() }
    val atomicServiceCode = parseOptionalStringParam(params, "atomicServiceCode")?.takeIf { it.isNotBlank() }
    val locale = parseOptionalStringParam(params, "locale")?.takeIf { it.isNotBlank() }
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, I18N_SEARCH_ALLOWED_SORT_PROPERTIES)
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("i18n_1"))
            put("key", JsonPrimitive("common.save"))
            put("value", JsonPrimitive("Save"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_2"))
            put("key", JsonPrimitive("common.cancel"))
            put("value", JsonPrimitive("Cancel"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict_item"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_3"))
            put("key", JsonPrimitive("common.save"))
            put("value", JsonPrimitive("Save"))
            put("locale", JsonPrimitive("en-US"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_4"))
            put("key", JsonPrimitive("sys.i18n.title"))
            put("value", JsonPrimitive("I18n Management"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("view"))
            put("atomicServiceCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("builtIn", JsonPrimitive(false))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_5"))
            put("key", JsonPrimitive("sys.i18n.key"))
            put("value", JsonPrimitive("Key"))
            put("locale", JsonPrimitive("zh-TW"))
            put("i18nTypeDictCode", JsonPrimitive("dict_item"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(false))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowKey = primitiveString(row, "key").orEmpty()
        val rowType = primitiveString(row, "i18nTypeDictCode").orEmpty()
        val rowAtomic = primitiveString(row, "atomicServiceCode").orEmpty()
        val rowLocale = primitiveString(row, "locale").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (keyFilter.isEmpty() || rowKey.contains(keyFilter, ignoreCase = true)) &&
            (i18nTypeDictCode == null || rowType == i18nTypeDictCode) &&
            (atomicServiceCode == null || rowAtomic == atomicServiceCode) &&
            (locale == null || rowLocale == locale) &&
            (active == null || rowActive == active)
    }
    filtered = applySort(filtered, sortPair.first, sortPair.second)
    val total = filtered.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock tenant list search: filter by id/name/subSystemCode/active, then sort and paginate. */
private fun buildTenantSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val id = parseOptionalStringParam(params, "id")?.trim() ?: ""
    val name = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val subSystemCode = primitiveString(params, "subSystemCode")?.takeIf { it.isNotBlank() }
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, TENANT_SEARCH_ALLOWED_SORT_PROPERTIES)
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("tenant_1"))
            put("name", JsonPrimitive("Default Tenant"))
            put("subSystemCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_2"))
            put("name", JsonPrimitive("Tenant A"))
            put("subSystemCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_3"))
            put("name", JsonPrimitive("Tenant B"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowId = primitiveString(row, "id").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowSubSys = primitiveString(row, "subSystemCode").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (id.isEmpty() || rowId == id) &&
            (name.isEmpty() || rowName.contains(name, ignoreCase = true)) &&
            (subSystemCode == null || subSystemCode == rowSubSys) &&
            (active == null || rowActive == active)
    }
    filtered = applySort(filtered, sortPair.first, sortPair.second)
    val total = filtered.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock tenant single fetch: return edit data by id for sys/tenant/get. */
private fun buildTenantGetResponse(id: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("tenant_1"))
            put("name", JsonPrimitive("Default Tenant"))
            put("subSystemCode", JsonPrimitive("console"))
            put("remark", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_2"))
            put("name", JsonPrimitive("Tenant A"))
            put("subSystemCode", JsonPrimitive("console"))
            put("remark", JsonPrimitive("Remark A"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_3"))
            put("name", JsonPrimitive("Tenant B"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("remark", JsonPrimitive("Remark B"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    val row = mockRows.firstOrNull { primitiveString(it, "id") == id }
        ?: buildJsonObject {
            put("id", JsonPrimitive(id))
            put("name", JsonPrimitive(""))
            put("subSystemCode", JsonPrimitive(""))
            put("remark", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive(""))
        }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock domain list search: filter by domain/subSystemCode/tenantId/active, then sort and paginate. tenantId is consistent with getAllActiveTenants. */
private fun buildDomainSearchResponse(requestJson: String): String {
    val params = parseDomainSearchParams(parseJsonObjectOrEmpty(requestJson))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("domain_1"))
            put("domain", JsonPrimitive("console.example.com"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t6"))
            put("tenantName", JsonPrimitive("Tenant 6"))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("Console domain"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_2"))
            put("domain", JsonPrimitive("api.example.com"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("tenantName", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("API domain"))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_3"))
            put("domain", JsonPrimitive("service-a.example.com"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("t5"))
            put("tenantName", JsonPrimitive("Tenant 5"))
            put("active", JsonPrimitive(false))
            put("remark", JsonPrimitive("Service A domain"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowId = primitiveString(row, "id").orEmpty()
        val rowDomain = primitiveString(row, "domain").orEmpty()
        val rowSubSys = primitiveString(row, "subSystemCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.id.isEmpty() || rowId == params.id) &&
            (params.domain.isEmpty() || rowDomain.contains(params.domain, ignoreCase = true)) &&
            (params.subSystemCode == null || params.subSystemCode == rowSubSys) &&
            (params.tenantId == null || params.tenantId == rowTenantId) &&
            (params.active == null || rowActive == params.active)
    }
    filtered = applySort(filtered, params.orderProperty, params.orderDirection)
    val total = filtered.size
    val fromIndex = ((params.pageNo - 1) * params.pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + params.pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else filtered.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock domain single fetch: return edit data by id for sys/domain/get. tenantId must match getAllActiveTenants (console -> t6, service_a -> t5). */
private fun buildDomainGetResponse(id: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("domain_1"))
            put("domain", JsonPrimitive("console.example.com"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t6"))
            put("tenantName", JsonPrimitive("Tenant 6"))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("Console domain"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_2"))
            put("domain", JsonPrimitive("api.example.com"))
            put("subSystemCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("tenantName", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("API domain"))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_3"))
            put("domain", JsonPrimitive("service-a.example.com"))
            put("subSystemCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("t5"))
            put("tenantName", JsonPrimitive("Tenant 5"))
            put("active", JsonPrimitive(false))
            put("remark", JsonPrimitive("Service A domain"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    val row = mockRows.firstOrNull { primitiveString(it, "id") == id }
        ?: buildJsonObject {
        put("id", JsonPrimitive(id))
        put("domain", JsonPrimitive(""))
        put("subSystemCode", JsonPrimitive(""))
        put("tenantId", JsonNull)
        put("tenantName", JsonPrimitive(""))
        put("active", JsonPrimitive(true))
        put("remark", JsonPrimitive(""))
        put("createTime", JsonPrimitive(""))
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
}

/** Mock dictionary list search: returns first=row list and second=total count after filtering by module, dictType, and other criteria. */
private fun buildDictSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, 500)
    val filterModule = primitiveString(params, "module")?.takeIf { it.isNotBlank() }
    val filterDictType = primitiveString(params, "dictType")?.takeIf { it.isNotBlank() }
    val allRows = listOf(
        buildJsonObject {
            put("dictId", JsonPrimitive("dict_1"))
            put("dictType", JsonPrimitive("dict_type"))
            put("dictName", JsonPrimitive("Dictionary Type"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("itemId", JsonNull)
            put("itemCode", JsonNull)
            put("itemName", JsonNull)
            put("parentCode", JsonNull)
            put("seqNo", JsonNull)
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("dictId", JsonPrimitive("dict_2"))
            put("dictType", JsonPrimitive("user_status"))
            put("dictName", JsonPrimitive("User Status"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(1) { "user" }))
            put("itemId", JsonNull)
            put("itemCode", JsonNull)
            put("itemName", JsonNull)
            put("parentCode", JsonNull)
            put("seqNo", JsonNull)
            put("active", JsonPrimitive(true))
        },
    )
    val mockRows = allRows.filter { row ->
        (filterModule == null || primitiveString(row, "module") == filterModule) &&
        (filterDictType == null || primitiveString(row, "dictType") == filterDictType)
    }
    val total = mockRows.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else mockRows.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("data", JsonArray(pageRows))
            put("totalCount", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock dictionary tree query: same first/second structure as search; supplies table data when tree nodes are expanded. */
private fun buildDictSearchByTreeResponse(requestJson: String): String = buildDictSearchResponse(requestJson)

/** Dictionary types (id, code) listed by atomic service (module), consistent with buildDictSearchResponse; the tree second level shows code only without translation. */
private val MOCK_DICT_TYPES_BY_MODULE: Map<String, List<Pair<String, String>>> = mapOf(
    "sys" to listOf("dict_1" to "dict_type"),
    "user" to listOf("dict_2" to "user_status"),
)

/** Mock dictionary tree: level 1 = atomic service, level 2 = dictionary type (code only), level 3 = dictionary item. */
private fun buildDictLoadTreeNodesResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val parentId = primitiveString(params, "parentId")?.takeIf { it.isNotBlank() }
    val firstLevel = primitiveBoolean(params, "firstLevel") == true

    val nodes: List<JsonObject> = when {
        parentId == null -> ATOMIC_SERVICE_CODES_ORDERED.map { code ->
            buildJsonObject {
                put("id", JsonPrimitive(code))
                put("code", JsonPrimitive(code))
                put("name", JsonPrimitive(ATOMIC_SERVICE_DISPLAY[code]!!))
            }
        }
        firstLevel -> (MOCK_DICT_TYPES_BY_MODULE[parentId] ?: emptyList()).map { (dictId, dictType) ->
            buildJsonObject {
                put("id", JsonPrimitive(dictId))
                put("code", JsonPrimitive(dictType))
                put("name", JsonPrimitive(dictType))
            }
        }
        else -> listOf(
            buildJsonObject {
                put("id", JsonPrimitive("item_${parentId}_1"))
                put("code", JsonPrimitive("item_1"))
                put("name", JsonPrimitive("item_1"))
            },
            buildJsonObject {
                put("id", JsonPrimitive("item_${parentId}_2"))
                put("code", JsonPrimitive("item_2"))
                put("name", JsonPrimitive("item_2"))
            },
        )
    }
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(nodes))
    }
    return response.toString()
}

/** Subsystem list (consistent with buildSubsysSearchTreeResponse); reused for level 2 of the resource tree and elsewhere. */
private fun buildResourceSubsystemLevelNodes(): List<JsonObject> = listOf(
    buildJsonObject { put("id", JsonPrimitive("service_a")); put("name", JsonPrimitive("Subsystem 1")) },
    buildJsonObject { put("id", JsonPrimitive("console")); put("name", JsonPrimitive("Subsystem 2")) },
    buildJsonObject { put("id", JsonPrimitive("service_b")); put("name", JsonPrimitive("Subsystem 3")) },
)

/** Mock resource tree: only two levels - level 1 = resource type (menu/button), level 2 = subsystem; branches strictly by level. */
private fun buildResourceLoadTreeNodesResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val level = primitiveInt(params, "level") ?: 0

    val nodes: List<JsonObject> = when (level) {
        0 -> listOf(
            buildJsonObject { put("id", JsonPrimitive("menu")); put("name", JsonPrimitive("Menu")) },
            buildJsonObject { put("id", JsonPrimitive("button")); put("name", JsonPrimitive("Button")) },
        )
        1 -> buildResourceSubsystemLevelNodes()
        else -> emptyList()
    }
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(nodes))
    }
    return response.toString()
}

/** Atomic service list: used by getAtomicServices, the "atomic service" filter in the dictionary list, and so on; when selecting a tenant the first level also reuses this list (semantically subsystem = atomic service). */
private val ATOMIC_SERVICE_CODES_ORDERED = listOf("sys", "user", "auth", "msg", "service_a", "console")
private val ATOMIC_SERVICE_DISPLAY = mapOf(
    "sys" to "Atomic Service 1",
    "user" to "Atomic Service 2",
    "auth" to "Atomic Service 3",
    "msg" to "Atomic Service 4",
    "service_a" to "Atomic Service 5",
    "console" to "Atomic Service 6",
)

/** Atomic service list API response: not a dictionary, this is a dedicated endpoint. */
private fun buildAtomicServicesResponse(): String {
    val data = ATOMIC_SERVICE_CODES_ORDERED.map { code ->
        buildJsonObject {
            put("code", JsonPrimitive(code))
            put("name", JsonPrimitive(ATOMIC_SERVICE_DISPLAY[code]!!))
        }
    }
    return buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(data))
    }.toString()
}

/** Preset dictionary item mock: module---dictType -> code->name. The name values are all i18n keys; the frontend renders them via t(name). */
private val MOCK_DICT_ITEM_MAP = mapOf(
    "sys---resource_type" to mapOf(
        "menu" to "resource_type.menu",
        "button" to "resource_type.button",
    ),
    "sys---cache_strategy" to mapOf(
        "SINGLE_LOCAL" to "cache_strategy.SINGLE_LOCAL",
        "REMOTE" to "cache_strategy.REMOTE",
        "LOCAL_REMOTE" to "cache_strategy.LOCAL_REMOTE",
    ),
    "sys---module" to mapOf(
        "sys" to "module.kuark_sys",
        "user" to "module.kuark_user",
        "log" to "module.kuark_log",
        "job" to "module.kuark_job",
    ),
    "user---user_status" to mapOf(
        "NORMAL" to "user_status.NORMAL",
        "LOCKED" to "user_status.LOCKED",
        "DISABLED" to "user_status.DISABLED",
    ),
    "user---user_type" to mapOf(
        "ADMIN" to "user_type.ADMIN",
        "USER" to "user_type.USER",
    ),
    "sys---locale" to mapOf(
        "zh-CN" to "locale.zh_CN",
        "zh-TW" to "locale.zh_TW",
        "en-US" to "locale.en_US",
    ),
    "sys---i18n_type" to mapOf(
        "dict" to "i18n_type.dict",
        "dict_item" to "i18n_type.dict_item",
        "view" to "i18n_type.view",
    ),
    "share---organization_type" to mapOf(
        "company" to "organization_type.company",
        "dept" to "organization_type.dept",
        "group" to "organization_type.group",
    ),
    "user---organization_type" to mapOf(
        "company" to "organization_type.company",
        "dept" to "organization_type.dept",
        "group" to "organization_type.group",
    ),
)

/** Parse dictTypesByAtomicServiceCode from the request body: Map<atomic service code, Collection<dictionary type>>. */
private fun parseDictTypesByAtomicServiceCode(requestJson: String): Map<String, List<String>> {
    if (requestJson.isBlank()) return emptyMap()
    val element = runCatching { json.parseToJsonElement(requestJson) }.getOrNull() ?: return emptyMap()
    if (element !is JsonObject) return emptyMap()
    val result = mutableMapOf<String, MutableList<String>>()
    for ((atomic, value) in element) {
        when (value) {
            is JsonArray -> value.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.let { list ->
                if (list.isNotEmpty()) result[atomic] = list.toMutableList()
            }
            else -> {}
        }
    }
    return result
}

/** Mock batch get dictionary items: request body is dictTypesByAtomicServiceCode; returns data: Map<atomic service, Map<dictionary type, Record<code, name>>>. */
private fun buildBatchGetDictItemMapResponse(requestJson: String): String {
    val byAtomic = parseDictTypesByAtomicServiceCode(requestJson)
    val dataObj = buildJsonObject {
        for ((atomic, dictTypes) in byAtomic) {
            val typeObj = buildJsonObject {
                for (dictType in dictTypes) {
                    val cacheKey = "$atomic---$dictType"
                    val items = MOCK_DICT_ITEM_MAP[cacheKey] ?: emptyMap()
                    val mapObj = buildJsonObject {
                        for ((code, name) in items) {
                            put(code, JsonPrimitive(name))
                        }
                    }
                    put(dictType, mapObj)
                }
            }
            put(atomic, typeObj)
        }
    }
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", dataObj)
    }.toString()
    return body
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
        "/sys/cache/search", "/api/sys/cache/search", "/api/admin/sys/cache/search",
        "/sys/cache/pagingSearch", "/api/sys/cache/pagingSearch", "/api/admin/sys/cache/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildCacheSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/cache/getDetail", "/api/sys/cache/getDetail", "/api/admin/sys/cache/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildCacheGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/cache/getValidationRule", "/api/sys/cache/getValidationRule", "/api/admin/sys/cache/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/search", "/api/sys/dataSource/search", "/api/admin/sys/dataSource/search",
        "/sys/dataSource/pagingSearch", "/api/sys/dataSource/pagingSearch", "/api/admin/sys/dataSource/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDataSourceSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/getDetail", "/api/sys/dataSource/getDetail", "/api/admin/sys/dataSource/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildDataSourceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/getValidationRule", "/api/sys/dataSource/getValidationRule", "/api/admin/sys/dataSource/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/saveOrUpdate", "/api/sys/dataSource/saveOrUpdate", "/api/admin/sys/dataSource/saveOrUpdate",
        "/sys/dataSource/save", "/api/sys/dataSource/save", "/api/admin/sys/dataSource/save",
        "/sys/dataSource/update", "/api/sys/dataSource/update", "/api/admin/sys/dataSource/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "ds_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/search", "/api/sys/param/search", "/api/admin/sys/param/search",
        "/sys/param/pagingSearch", "/api/sys/param/pagingSearch", "/api/admin/sys/param/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildParamSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/getDetail", "/api/sys/param/getDetail", "/api/admin/sys/param/getDetail" -> {
            val id = request.url.parameters["id"] ?: request.url.parameters["paramId"] ?: ""
            val body = buildParamGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/getValidationRule", "/api/sys/param/getValidationRule", "/api/admin/sys/param/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/saveOrUpdate", "/api/sys/param/saveOrUpdate", "/api/admin/sys/param/saveOrUpdate",
        "/sys/param/save", "/api/sys/param/save", "/api/admin/sys/param/save",
        "/sys/param/update", "/api/sys/param/update", "/api/admin/sys/param/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "param_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/search", "/api/sys/resource/search", "/api/admin/sys/resource/search",
        "/sys/resource/pagingSearch", "/api/sys/resource/pagingSearch", "/api/admin/sys/resource/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/getDetail", "/api/sys/resource/getDetail", "/api/admin/sys/resource/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildResourceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/getValidationRule", "/api/sys/resource/getValidationRule", "/api/admin/sys/resource/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/saveOrUpdate", "/api/sys/resource/saveOrUpdate", "/api/admin/sys/resource/saveOrUpdate",
        "/sys/resource/save", "/api/sys/resource/save", "/api/admin/sys/resource/save",
        "/sys/resource/update", "/api/sys/resource/update", "/api/admin/sys/resource/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "res_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/loadDirectChildrenForTree", "/api/sys/resource/loadDirectChildrenForTree", "/api/admin/sys/resource/loadDirectChildrenForTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceLoadTreeNodesResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        // NOTE: this branch is unreachable — the pagingSearch paths are already covered
        // by the earlier combined branch ("/sys/resource/search", ..., "/sys/resource/pagingSearch", ...).
        // Kept here to avoid accidental breakage during future refactors.
        "/sys/resource/pagingSearch", "/api/sys/resource/pagingSearch", "/api/admin/sys/resource/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceSearchResponse("/sys/resource/search", requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/getMenus", "/api/sys/resource/getMenus", "/api/admin/sys/resource/getMenus" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath["/api/sys/resource/getMenus"] ?: "{\"code\":200,\"data\":[]}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/atomicServices", "/api/sys/atomicServices", "/api/admin/sys/atomicServices" -> {
            val body = buildAtomicServicesResponse()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/getAllActiveAtomicServices", "/api/sys/microService/getAllActiveAtomicServices", "/api/admin/sys/microService/getAllActiveAtomicServices" -> {
            val body = buildAtomicServicesResponse()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/getAllActiveAtomicServiceCodes", "/api/sys/microService/getAllActiveAtomicServiceCodes", "/api/admin/sys/microService/getAllActiveAtomicServiceCodes" -> {
            val codes = ATOMIC_SERVICE_CODES_ORDERED
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonArray(codes.map { JsonPrimitive(it) }))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/loadDictTypes", "/api/sys/dict/loadDictTypes", "/api/admin/sys/dict/loadDictTypes" -> {
            val data = JsonArray(
                listOf(
                    JsonPrimitive("module"),
                    JsonPrimitive("resource_type"),
                    JsonPrimitive("cache_strategy"),
                    JsonPrimitive("dict_type"),
                )
            )
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", data)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/loadTreeNodes", "/api/sys/dict/loadTreeNodes", "/api/admin/sys/dict/loadTreeNodes" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictLoadTreeNodesResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/search", "/api/sys/domain/search", "/api/admin/sys/domain/search",
        "/sys/domain/pagingSearch", "/api/sys/domain/pagingSearch", "/api/admin/sys/domain/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDomainSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/get", "/api/sys/domain/get", "/api/admin/sys/domain/get" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildDomainGetResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/getValidationRule", "/api/sys/domain/getValidationRule", "/api/admin/sys/domain/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/saveOrUpdate", "/api/sys/domain/saveOrUpdate", "/api/admin/sys/domain/saveOrUpdate",
        "/sys/domain/save", "/api/sys/domain/save", "/api/admin/sys/domain/save",
        "/sys/domain/update", "/api/sys/domain/update", "/api/admin/sys/domain/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "domain_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/saveOrUpdate", "/api/sys/dict/saveOrUpdate", "/api/admin/sys/dict/saveOrUpdate",
        "/sys/dict/save", "/api/sys/dict/save", "/api/admin/sys/dict/save",
        "/sys/dict/update", "/api/sys/dict/update", "/api/admin/sys/dict/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "dict_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/batchGetDictItemMap", "/api/sys/dict/batchGetDictItemMap", "/api/admin/sys/dict/batchGetDictItemMap",
        "/sys/dictItem/batchGetDictItemMap", "/api/sys/dictItem/batchGetDictItemMap", "/api/admin/sys/dictItem/batchGetDictItemMap" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildBatchGetDictItemMapResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/search", "/api/sys/tenant/search", "/api/admin/sys/tenant/search",
        "/sys/tenant/pagingSearch", "/api/sys/tenant/pagingSearch", "/api/admin/sys/tenant/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildTenantSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/get", "/api/sys/tenant/get", "/api/admin/sys/tenant/get" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildTenantGetResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/getValidationRule", "/api/sys/tenant/getValidationRule", "/api/admin/sys/tenant/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/saveOrUpdate", "/api/sys/tenant/saveOrUpdate", "/api/admin/sys/tenant/saveOrUpdate",
        "/sys/tenant/save", "/api/sys/tenant/save", "/api/admin/sys/tenant/save",
        "/sys/tenant/update", "/api/sys/tenant/update", "/api/admin/sys/tenant/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "tenant_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/search", "/api/sys/i18n/search", "/api/admin/sys/i18n/search",
        "/sys/i18n/pagingSearch", "/api/sys/i18n/pagingSearch", "/api/admin/sys/i18n/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildI18nSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/getDetail", "/api/sys/i18n/getDetail", "/api/admin/sys/i18n/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildI18nGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/getValidationRule", "/api/sys/i18n/getValidationRule", "/api/admin/sys/i18n/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/saveOrUpdate", "/api/sys/i18n/saveOrUpdate", "/api/admin/sys/i18n/saveOrUpdate",
        "/sys/i18n/save", "/api/sys/i18n/save", "/api/admin/sys/i18n/save",
        "/sys/i18n/update", "/api/sys/i18n/update", "/api/admin/sys/i18n/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "i18n_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/batchGetI18ns", "/api/sys/i18n/batchGetI18ns", "/api/admin/sys/i18n/batchGetI18ns" -> {
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", buildJsonObject {
                    put("view", buildJsonObject {
                        put("menu", buildJsonObject {
                            put("home", JsonPrimitive("Home"))
                            put("tabs", JsonPrimitive("Message Center"))
                            put("sys", JsonPrimitive("System Management"))
                            put("sysBasic", JsonPrimitive("Basic Configuration"))
                            put("sysCache", JsonPrimitive("Cache Management"))
                            put("sysDict", JsonPrimitive("Dictionary Management"))
                            put("sysParam", JsonPrimitive("Parameter Configuration"))
                            put("sysDomain", JsonPrimitive("Domain"))
                            put("sysTenant", JsonPrimitive("Tenant"))
                            put("sysSubsys", JsonPrimitive("Subsystem"))
                            put("sysMicroservice", JsonPrimitive("Microservice"))
                            put("sysDatasource", JsonPrimitive("Data Source"))
                            put("sysResource", JsonPrimitive("Resource"))
                            put("sysI18n", JsonPrimitive("I18n"))
                            put("user", JsonPrimitive("Users & Organizations"))
                            put("userAccount", JsonPrimitive("Account Management"))
                            put("userOrganization", JsonPrimitive("Organization Management"))
                            put("rbac", JsonPrimitive("Permission Management"))
                            put("rbacRole", JsonPrimitive("Role Management"))
                            put("rbacGroup", JsonPrimitive("User Group"))
                        })
                    })
                })
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/search", "/api/user/account/search", "/api/admin/user/account/search",
        "/user/account/pagingSearch", "/api/user/account/pagingSearch", "/api/admin/user/account/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildAccountSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/getDetail", "/api/user/account/getDetail", "/api/admin/user/account/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildAccountGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/getValidationRule", "/api/user/account/getValidationRule", "/api/admin/user/account/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/saveOrUpdate", "/api/user/account/saveOrUpdate", "/api/admin/user/account/saveOrUpdate",
        "/user/account/save", "/api/user/account/save", "/api/admin/user/account/save",
        "/user/account/update", "/api/user/account/update", "/api/admin/user/account/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "account_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/search", "/api/rbac/group/search", "/api/admin/rbac/group/search",
        "/rbac/group/pagingSearch", "/api/rbac/group/pagingSearch", "/api/admin/rbac/group/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildUserGroupSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/getDetail", "/api/rbac/group/getDetail", "/api/admin/rbac/group/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildUserGroupGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/getValidationRule", "/api/rbac/group/getValidationRule", "/api/admin/rbac/group/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/saveOrUpdate", "/api/rbac/group/saveOrUpdate", "/api/admin/rbac/group/saveOrUpdate",
        "/rbac/group/save", "/api/rbac/group/save", "/api/admin/rbac/group/save",
        "/rbac/group/update", "/api/rbac/group/update", "/api/admin/rbac/group/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "group_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/search", "/api/rbac/role/search", "/api/admin/rbac/role/search",
        "/rbac/role/pagingSearch", "/api/rbac/role/pagingSearch", "/api/admin/rbac/role/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildRoleSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/getDetail", "/api/rbac/role/getDetail", "/api/admin/rbac/role/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildRoleGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/getValidationRule", "/api/rbac/role/getValidationRule", "/api/admin/rbac/role/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/saveOrUpdate", "/api/rbac/role/saveOrUpdate", "/api/admin/rbac/role/saveOrUpdate",
        "/rbac/role/save", "/api/rbac/role/save", "/api/admin/rbac/role/save",
        "/rbac/role/update", "/api/rbac/role/update", "/api/admin/rbac/role/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "role_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/loadTree", "/api/user/organization/loadTree", "/api/admin/user/organization/loadTree" -> {
            val subSys = request.url.parameters["subSystemCode"]
            val tenant = request.url.parameters["tenantId"]
            val body = buildOrganizationLoadTreeResponse(subSys, tenant)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/searchTree", "user/organization/searchTree", "/api/user/organization/searchTree", "/api/admin/user/organization/searchTree" -> {
            val requestJson = requestBodyText(request.body)
            val tenantFromQuery = request.url.parameters["tenantId"]?.takeIf { it.isNotBlank() }
            val body = buildOrganizationSearchTreeResponse(requestJson, tenantFromQuery)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/getDetail", "/api/user/organization/getDetail", "/api/admin/user/organization/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildOrganizationGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/getValidationRule", "/api/user/organization/getValidationRule", "/api/admin/user/organization/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/saveOrUpdate", "/api/user/organization/saveOrUpdate", "/api/admin/user/organization/saveOrUpdate",
        "/user/organization/save", "/api/user/organization/save", "/api/admin/user/organization/save",
        "/user/organization/update", "/api/user/organization/update", "/api/admin/user/organization/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "org_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/searchTree", "sys/subsys/searchTree", "/api/sys/subsys/searchTree", "/api/admin/sys/subsys/searchTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildSubsysSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/system/search", "sys/system/search", "/api/sys/system/search", "/api/admin/sys/system/search",
        "/sys/system/pagingSearch", "sys/system/pagingSearch", "/api/sys/system/pagingSearch", "/api/admin/sys/system/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildSubsysSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/getDetail", "/api/sys/subsys/getDetail", "/api/admin/sys/subsys/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildSubsysGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/system/getDetail", "/api/sys/system/getDetail", "/api/admin/sys/system/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildSubsysGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/getValidationRule", "/api/sys/subsys/getValidationRule", "/api/admin/sys/subsys/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/system/getValidationRule", "/api/sys/system/getValidationRule", "/api/admin/sys/system/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path]
                ?: """{"code":{"NotBlank":[{"message":"sys.valid-msg.default.NotBlank"}]},"name":{"NotBlank":[{"message":"sys.valid-msg.default.NotBlank"}]}}"""
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/system/getAllActiveSystemCodes", "/api/sys/system/getAllActiveSystemCodes", "/api/admin/sys/system/getAllActiveSystemCodes" -> {
            // Consistent with the flat data from buildSubsysSearchTreeResponse:
            // active nodes where subSystem=false are module_x and module_y.
            val arr = JsonArray(listOf(JsonPrimitive("module_x"), JsonPrimitive("module_y")))
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", arr)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/saveOrUpdate", "/api/sys/subsys/saveOrUpdate", "/api/admin/sys/subsys/saveOrUpdate",
        "/sys/subsys/save", "/api/sys/subsys/save", "/api/admin/sys/subsys/save",
        "/sys/subsys/update", "/api/sys/subsys/update", "/api/admin/sys/subsys/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "sys_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/system/saveOrUpdate", "/api/sys/system/saveOrUpdate", "/api/admin/sys/system/saveOrUpdate",
        "/sys/system/save", "/api/sys/system/save", "/api/admin/sys/system/save",
        "/sys/system/update", "/api/sys/system/update", "/api/admin/sys/system/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "sys_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/searchTree", "sys/microService/searchTree", "/api/sys/microService/searchTree", "/api/admin/sys/microService/searchTree",
        "/sys/microService/search", "sys/microService/search", "/api/sys/microService/search", "/api/admin/sys/microService/search",
        "/sys/microService/pagingSearch", "sys/microService/pagingSearch", "/api/sys/microService/pagingSearch", "/api/admin/sys/microService/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildMicroserviceSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/getDetail", "/api/sys/microService/getDetail", "/api/admin/sys/microService/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildMicroserviceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/getValidationRule", "/api/sys/microService/getValidationRule", "/api/admin/sys/microService/getValidationRule" -> {
            val body = MockJsonStore.byPath[resolveFixturePath(path)] ?: MockJsonStore.byPath[path] ?: "{}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/getAllActiveMicroServiceCodes", "/api/sys/microService/getAllActiveMicroServiceCodes", "/api/admin/sys/microService/getAllActiveMicroServiceCodes" -> {
            // Consistent with buildMicroserviceSearchTreeResponse: the only active node where
            // atomicService=false is "order-worker".
            val arr = JsonArray(listOf(JsonPrimitive("order-worker")))
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", arr)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microService/saveOrUpdate", "/api/sys/microService/saveOrUpdate", "/api/admin/sys/microService/saveOrUpdate",
        "/sys/microService/save", "/api/sys/microService/save", "/api/admin/sys/microService/save",
        "/sys/microService/update", "/api/sys/microService/update", "/api/admin/sys/microService/update" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val id = parseOptionalStringParam(params, "id")?.trim()
            val savedId = if (id.isNullOrEmpty()) "ms_${(1..999999999).random()}" else id
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonPrimitive(savedId))
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/search", "/api/sys/dict/search", "/api/admin/sys/dict/search",
        "/sys/dict/pagingSearch", "/api/sys/dict/pagingSearch", "/api/admin/sys/dict/pagingSearch" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/pagingSearchDict", "/api/sys/dict/pagingSearchDict", "/api/admin/sys/dict/pagingSearchDict" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictSearchByTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/getAllActiveTenants", "/api/sys/tenant/getAllActiveTenants", "/api/admin/sys/tenant/getAllActiveTenants" -> {
            // Returns Map<atomicServiceCode, Map<tenantId, tenantName>>.
            // Each service gets a primary tenant whose id is "t{index+1}" (e.g. sys -> t1, user -> t2 …).
            // "console" and "service_a" get additional tenants to exercise the multi-tenant picker
            // and to keep tenant ids consistent with buildAccountGetDetailResponse and buildDomainGetResponse.
            val data = buildJsonObject {
                ATOMIC_SERVICE_CODES_ORDERED.forEachIndexed { index, code ->
                    put(code, buildJsonObject {
                        put("t${index + 1}", JsonPrimitive("Tenant ${index + 1}"))
                        // Consistent with the dataSource/search fixture, to make subsystem/tenant prefill on edit easier.
                        if (code == "console") {
                            put("default", JsonPrimitive("Default Tenant"))
                            put("tenant_2", JsonPrimitive("Tenant 2 (CN)"))
                        }
                        if (code == "service_a") put("1", JsonPrimitive("Tenant A1"))
                    })
                }
            }
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", data)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/getDict", "/api/sys/dict/getDict", "/api/admin/sys/dict/getDict" -> {
            val id = request.url.parameters["id"] ?: ""
            val isDict = request.url.parameters["isDict"]?.toBooleanStrictOrNull() == true
            val row = buildJsonObject {
                put("dictId", JsonPrimitive("dict_$id"))
                put("dictType", JsonPrimitive("dict_type"))
                put("dictName", JsonPrimitive(if (isDict) "Dictionary Type" else "Dictionary Item"))
                put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
                put("itemId", if (isDict) JsonNull else JsonPrimitive("item_$id"))
                put("itemCode", if (isDict) JsonNull else JsonPrimitive("item_$id"))
                put("itemName", if (isDict) JsonNull else JsonPrimitive("Item name"))
                put("parentCode", JsonNull)
                put("seqNo", if (isDict) JsonNull else JsonPrimitive(0))
                put("active", JsonPrimitive(true))
            }
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", row)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/getDetail", "/api/sys/dict/getDetail", "/api/admin/sys/dict/getDetail" -> {
            val id = request.url.parameters["id"] ?: request.url.parameters["dictId"] ?: ""
            val row = buildJsonObject {
                put("id", JsonPrimitive("dict_$id"))
                put("dictId", JsonPrimitive("dict_$id"))
                put("dictType", JsonPrimitive("dict_type"))
                put("dictName", JsonPrimitive("Dictionary Type"))
                put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
                put("builtIn", JsonPrimitive(false))
                put("remark", JsonPrimitive(""))
                put("createTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
                put("updateTime", JsonArray(listOf(JsonPrimitive(2024), JsonPrimitive(1), JsonPrimitive(1), JsonPrimitive(0), JsonPrimitive(0), JsonPrimitive(0))))
                put("createUser", JsonPrimitive(""))
                put("updateUser", JsonPrimitive(""))
            }
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", row)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dictItem/getDictItemsByDictId", "/api/sys/dictItem/getDictItemsByDictId", "/api/admin/sys/dictItem/getDictItemsByDictId" -> {
            val requestJson = requestBodyText(request.body)
            val params = parseJsonObjectOrEmpty(requestJson)
            val dictId = primitiveString(params, "dictId") ?: ""
            val items = listOf(
                buildJsonObject {
                    put("id", JsonPrimitive("item_${dictId}_1"))
                    put("itemCode", JsonPrimitive("item_1"))
                    put("itemName", JsonPrimitive("Item 1"))
                    put("seqNo", JsonPrimitive(0))
                    put("active", JsonPrimitive(true))
                    put("builtIn", JsonPrimitive(false))
                    put("createTime", JsonNull)
                    put("remark", JsonPrimitive(""))
                },
                buildJsonObject {
                    put("id", JsonPrimitive("item_${dictId}_2"))
                    put("itemCode", JsonPrimitive("item_2"))
                    put("itemName", JsonPrimitive("Item 2"))
                    put("seqNo", JsonPrimitive(1))
                    put("active", JsonPrimitive(true))
                    put("builtIn", JsonPrimitive(false))
                    put("createTime", JsonNull)
                    put("remark", JsonPrimitive(""))
                },
            )
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", JsonArray(items))
            }.toString()
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
