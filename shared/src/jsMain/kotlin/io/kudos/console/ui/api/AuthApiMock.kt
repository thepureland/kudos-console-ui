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

private data class DataSourceSearchParams(
    val subSysDictCode: String?,
    val tenantId: String?,
    val microserviceCode: String?,
    val name: String,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
)

private fun parseDataSourceSearchParams(params: JsonObject): DataSourceSearchParams {
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val microserviceCode = primitiveString(params, "microserviceCode")?.takeIf { it.isNotBlank() }
    val name = parseOptionalStringParam(params, "name").orEmpty()
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    return DataSourceSearchParams(subSysDictCode, tenantId, microserviceCode, name, active, pageNo, pageSize)
}

private fun buildDataSourceSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = parseDataSourceSearchParams(paramsObj)

    val filtered = allRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowMicroservice = primitiveString(row, "microservice").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.subSysDictCode == null || params.subSysDictCode == rowSubSys) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 国际化详情：根据 id 从与 search 一致的 mock 数据中查单条。 */
private fun buildI18nGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("i18n_1"))
            put("key", JsonPrimitive("common.save"))
            put("value", JsonPrimitive("保存"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_2"))
            put("key", JsonPrimitive("common.cancel"))
            put("value", JsonPrimitive("取消"))
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
            put("value", JsonPrimitive("国际化管理"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("view"))
            put("atomicServiceCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("builtIn", JsonPrimitive(false))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_5"))
            put("key", JsonPrimitive("sys.i18n.key"))
            put("value", JsonPrimitive("键"))
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

/** 数据源详情：从 search fixture 中按 id 查单条；无 fixture 或未找到时返回 404。 */
private fun buildDataSourceGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/dataSource/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/dataSource/search"]
        ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val row = allRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    val body = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", row)
    }.toString()
    return body
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

/** 根据请求的 id 从 cache search 数据中查找对应行并返回详情；未找到时回退到静态 getDetail 文案。 */
private fun buildCacheGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/cache/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/cache/search"]
        ?: return (MockJsonStore.byPath["/sys/cache/getDetail"] ?: MockJsonStore.byPath["/api/sys/cache/getDetail"])
            ?: "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
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

/** 参数列表内联数据，按 module/paramName/paramValue/active 筛选、排序、分页后返回。 */
private fun buildParamSearchResponse(requestJson: String): String {
    val params = parseParamSearchParams(parseJsonObjectOrEmpty(requestJson))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("1"))
            put("paramName", JsonPrimitive("sys.name"))
            put("paramValue", JsonPrimitive("Kudos 控制台"))
            put("defaultValue", JsonPrimitive("Kudos"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("系统显示名称"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("2"))
            put("paramName", JsonPrimitive("sys.pageSize"))
            put("paramValue", JsonPrimitive("20"))
            put("defaultValue", JsonPrimitive("10"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(2))
            put("remark", JsonPrimitive("默认分页大小"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("3"))
            put("paramName", JsonPrimitive("sys.cache.ttl"))
            put("paramValue", JsonPrimitive("3600"))
            put("defaultValue", JsonPrimitive("1800"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
            put("seqNo", JsonPrimitive(3))
            put("remark", JsonPrimitive("缓存过期时间(秒)"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("4"))
            put("paramName", JsonPrimitive("log.level"))
            put("paramValue", JsonPrimitive("INFO"))
            put("defaultValue", JsonPrimitive("WARN"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(2) { "auth" }))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("日志级别"))
            put("active", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("5"))
            put("paramName", JsonPrimitive("job.enabled"))
            put("paramValue", JsonPrimitive("true"))
            put("defaultValue", JsonPrimitive("false"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(3) { "msg" }))
            put("seqNo", JsonPrimitive(1))
            put("remark", JsonPrimitive("是否启用任务调度"))
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 参数详情：根据 id 从与 search 一致的数据中查单条并补全 createTime 等字段。 */
private fun buildParamGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        "1" to mapOf(
            "paramName" to "sys.name",
            "paramValue" to "Kudos 控制台",
            "defaultValue" to "Kudos",
            "remark" to "系统显示名称",
            "seqNo" to 1,
            "active" to true,
        ),
        "2" to mapOf(
            "paramName" to "sys.pageSize",
            "paramValue" to "20",
            "defaultValue" to "10",
            "remark" to "默认分页大小",
            "seqNo" to 2,
            "active" to true,
        ),
        "3" to mapOf(
            "paramName" to "sys.cache.ttl",
            "paramValue" to "3600",
            "defaultValue" to "1800",
            "remark" to "缓存过期时间(秒)",
            "seqNo" to 3,
            "active" to true,
        ),
        "4" to mapOf(
            "paramName" to "log.level",
            "paramValue" to "INFO",
            "defaultValue" to "WARN",
            "remark" to "日志级别",
            "seqNo" to 1,
            "active" to true,
        ),
        "5" to mapOf(
            "paramName" to "job.enabled",
            "paramValue" to "true",
            "defaultValue" to "false",
            "remark" to "是否启用任务调度",
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
    val subSysDictCode: String,
    val resourceTypeDictCode: String,
    val name: String,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val RESOURCE_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "name", "url", "icon", "seqNo", "active", "subSysDictCode", "resourceTypeDictCode",
)

private fun parseResourceSearchParams(params: JsonObject): ResourceSearchParams {
    val subSysDictCode = parseOptionalStringParam(params, "subSysDictCode")?.trim() ?: ""
    val resourceTypeDictCode = parseOptionalStringParam(params, "resourceTypeDictCode")?.trim() ?: ""
    val name = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = parsePositiveIntParam(params, "pageNo", 1) ?: 1
    val pageSizeRaw = parsePositiveIntParam(params, "pageSize", 10) ?: 10
    val pageSize = pageSizeRaw.coerceAtMost(MAX_PAGE_SIZE)
    val sortPair = parseSortParamForResource(params)
    return ResourceSearchParams(
        subSysDictCode = subSysDictCode,
        resourceTypeDictCode = resourceTypeDictCode,
        name = name,
        active = active,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

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
    val fixture = MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = parseResourceSearchParams(paramsObj)

    var filtered = allRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowType = primitiveString(row, "resourceTypeDictCode").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.subSysDictCode.isEmpty() || rowSubSys == params.subSysDictCode) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 资源详情：从 search fixture 中按 id 查单条，并补全 parentIds 供编辑回填级联。 */
private fun buildResourceGetDetailResponse(requestId: String): String {
    val searchPath = "/sys/resource/search"
    val fixture = MockJsonStore.byPath[searchPath] ?: MockJsonStore.byPath["/api/sys/resource/search"]
        ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val row = allRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    val resourceType = primitiveString(row, "resourceTypeDictCode").orEmpty()
    val subSys = primitiveString(row, "subSysDictCode").orEmpty()
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
    val subSysDictCode: String?,
    val tenantId: String?,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val DOMAIN_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "domain", "subSysDictCode", "tenantName", "active", "remark", "createTime",
)

private fun parseDomainSearchParams(params: JsonObject): DomainSearchParams {
    val id = parseOptionalStringParam(params, "id")?.trim() ?: ""
    val domain = parseOptionalStringParam(params, "domain")?.trim() ?: ""
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, DOMAIN_SEARCH_ALLOWED_SORT_PROPERTIES)
    return DomainSearchParams(
        id = id,
        domain = domain,
        subSysDictCode = subSysDictCode,
        tenantId = tenantId,
        active = active,
        pageNo = pageNo,
        pageSize = pageSize,
        orderProperty = sortPair.first,
        orderDirection = sortPair.second,
    )
}

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
    val subSysDictCode: String?,
    val active: Boolean?,
    val pageNo: Int,
    val pageSize: Int,
    val orderProperty: String?,
    val orderDirection: String,
)

private val TENANT_SEARCH_ALLOWED_SORT_PROPERTIES = setOf(
    "name", "subSysDictCode", "active", "createTime",
)

/** Mock 账号列表搜索：根据 username/subSysDictCode/tenantId/organizationId 筛选，排序分页。 */
private fun buildAccountSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val username = parseOptionalStringParam(params, "username")?.trim() ?: ""
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val organizationId = primitiveString(params, "organizationId")?.takeIf { it.isNotBlank() }
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, setOf("username", "createTime", "lastLoginTime"))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("acc_1"))
            put("username", JsonPrimitive("admin"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("organizationId", JsonPrimitive("org_1"))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("ADMIN"))
            put("lastLoginTime", JsonPrimitive("2024-02-01 09:00:00"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_2"))
            put("username", JsonPrimitive("user1"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("organizationId", JsonPrimitive("org_2"))
            put("userStatusDictCode", JsonPrimitive("NORMAL"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonNull)
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("acc_3"))
            put("username", JsonPrimitive("user2"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("organizationId", JsonPrimitive("org_3"))
            put("userStatusDictCode", JsonPrimitive("LOCKED"))
            put("userTypeDictCode", JsonPrimitive("USER"))
            put("lastLoginTime", JsonPrimitive("2024-01-15 14:00:00"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowUsername = primitiveString(row, "username").orEmpty()
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowOrgId = primitiveString(row, "organizationId").orEmpty()
        (username.isEmpty() || rowUsername.contains(username, ignoreCase = true)) &&
            (subSysDictCode == null || subSysDictCode == rowSubSys) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 账号详情：根据 id 从与 search 一致的 mock 数据中查单条并补全详情字段。tenantId 需与 getAllActiveTenants 一致（console→t6/default/tenant_2，service_a→t5/1）。 */
private fun buildAccountGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("acc_1"))
            put("username", JsonPrimitive("admin"))
            put("subSysDictCode", JsonPrimitive("console"))
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
            put("subSysDictCode", JsonPrimitive("console"))
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
            put("subSysDictCode", JsonPrimitive("service_a"))
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

/** Mock 组织机构树：返回 id/name/children 结构。 */
private fun buildOrganizationLoadTreeResponse(subSysDictCode: String?, tenantId: String?): String {
    val nodes = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("org_1"))
            put("name", JsonPrimitive("总部"))
            put("children", JsonArray(listOf(
                buildJsonObject {
                    put("id", JsonPrimitive("org_2"))
                    put("name", JsonPrimitive("研发部"))
                    put("children", JsonArray(emptyList()))
                },
                buildJsonObject {
                    put("id", JsonPrimitive("org_3"))
                    put("name", JsonPrimitive("市场部"))
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
    "roleCode", "roleName", "subSysDictCode", "active", "createTime",
)

/** Mock 角色列表搜索：根据 subSysDictCode/tenantId/roleCode/roleName/active 筛选，排序分页。 */
private fun buildRoleSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
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
            put("roleName", JsonPrimitive("管理员"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("系统管理员角色"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_2"))
            put("roleCode", JsonPrimitive("USER"))
            put("roleName", JsonPrimitive("普通用户"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t1"))
            put("remark", JsonPrimitive("租户普通用户"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_3"))
            put("roleCode", JsonPrimitive("GUEST"))
            put("roleName", JsonPrimitive("访客"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("只读访客"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowCode = primitiveString(row, "roleCode").orEmpty()
        val rowName = primitiveString(row, "roleName").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (subSysDictCode == null || subSysDictCode == rowSubSys) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 角色详情：根据 id 从与 search 一致的 mock 数据中查单条并补全详情字段。 */
private fun buildRoleGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("role_1"))
            put("roleCode", JsonPrimitive("ADMIN"))
            put("roleName", JsonPrimitive("管理员"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("系统管理员角色"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_2"))
            put("roleCode", JsonPrimitive("USER"))
            put("roleName", JsonPrimitive("普通用户"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t1"))
            put("remark", JsonPrimitive("租户普通用户"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("role_3"))
            put("roleCode", JsonPrimitive("GUEST"))
            put("roleName", JsonPrimitive("访客"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("tenantId", JsonNull)
            put("remark", JsonPrimitive("只读访客"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("tenantName", JsonPrimitive(if (primitiveString(row, "tenantId") == "t1") "租户1" else ""))
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

/** Mock 用户组（组管理）列表搜索：根据 groupCode/groupName/active 筛选，排序分页。 */
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
            put("groupName", JsonPrimitive("管理员组"))
            put("remark", JsonPrimitive("系统管理员用户组"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_2"))
            put("groupCode", JsonPrimitive("DEV_GROUP"))
            put("groupName", JsonPrimitive("开发组"))
            put("remark", JsonPrimitive("开发团队"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_3"))
            put("groupCode", JsonPrimitive("GUEST_GROUP"))
            put("groupName", JsonPrimitive("访客组"))
            put("remark", JsonPrimitive("只读访客"))
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** 用户组详情：根据 id 从与 search 一致的 mock 数据中查单条并补全详情字段。 */
private fun buildUserGroupGetDetailResponse(requestId: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("group_1"))
            put("groupCode", JsonPrimitive("ADMIN_GROUP"))
            put("groupName", JsonPrimitive("管理员组"))
            put("remark", JsonPrimitive("系统管理员用户组"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_2"))
            put("groupCode", JsonPrimitive("DEV_GROUP"))
            put("groupName", JsonPrimitive("开发组"))
            put("remark", JsonPrimitive("开发团队"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("group_3"))
            put("groupCode", JsonPrimitive("GUEST_GROUP"))
            put("groupName", JsonPrimitive("访客组"))
            put("remark", JsonPrimitive("只读访客"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var row = mockRows.firstOrNull { primitiveString(it, "id") == requestId }
        ?: return "{\"code\":404,\"data\":null}"
    row = buildJsonObject {
        row.forEach { (k, v) -> put(k, v) }
        put("subSysDictCode", JsonPrimitive("console"))
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

/** Mock 组织列表树查询 searchTree：根据 subSysDictCode/tenantId（所选租户）及 active 返回不同树。 */
private fun buildOrganizationSearchTreeResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
    val tenantId = primitiveString(params, "tenantId")?.takeIf { it.isNotBlank() }
    val activeOnly = parseOptionalBooleanParam(params, "active") == true // true = 仅启用
    if (subSysDictCode == null) {
        val emptyResponse = buildJsonObject {
            put("code", JsonPrimitive(200))
            put("data", JsonArray(emptyList<JsonObject>()))
        }
        return emptyResponse.toString()
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
    val prefix = "org_${subSysDictCode}_${tenantId ?: "all"}_"
    val display = ATOMIC_SERVICE_DISPLAY[subSysDictCode] ?: subSysDictCode
    val (rootName, rootAbbr) = when {
        subSysDictCode in ATOMIC_SERVICE_CODES_ORDERED && tenantId == "t1" -> "总部(租户1)" to "租户1"
        subSysDictCode in ATOMIC_SERVICE_CODES_ORDERED && tenantId == "t2" -> "总部(租户2)" to "租户2"
        subSysDictCode in ATOMIC_SERVICE_CODES_ORDERED && (tenantId == null || tenantId.isEmpty()) -> "总部($display)" to display
        else -> "总部($subSysDictCode${if (tenantId != null) "-$tenantId" else ""})" to (tenantId ?: subSysDictCode)
    }
    val c1 = node("${prefix}2", "研发部", "研发", "dept", 1, true, "2024-01-02 10:00:00", emptyList())
    val c2 = node("${prefix}3", "市场部", "市场", "dept", 2, true, "2024-01-03 10:00:00", emptyList())
    val c3 = node("${prefix}4", "已停用部门", "停用", "dept", 3, false, "2024-01-04 10:00:00", emptyList())
    val root = node("${prefix}1", rootName, rootAbbr, "company", 0, true, "2024-01-01 10:00:00", listOf(c1, c2, c3))
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

/** 组织机构详情：根据 id 返回单条，补全详情字段。 */
private fun buildOrganizationGetDetailResponse(requestId: String): String {
    val nameBySuffix = mapOf(
        "1" to "总部", "2" to "研发部", "3" to "市场部", "4" to "已停用部门"
    )
    val suffix = requestId.substringAfterLast('_', requestId)
    val name = nameBySuffix[suffix] ?: "组织"
    val abbr = when (suffix) {
        "1" -> "总部"
        "2" -> "研发"
        "3" -> "市场"
        "4" -> "停用"
        else -> "—"
    }
    val row = buildJsonObject {
        put("id", JsonPrimitive(requestId))
        put("name", JsonPrimitive(name))
        put("abbrName", JsonPrimitive(abbr))
        put("orgTypeDictCode", JsonPrimitive(if (suffix == "1") "company" else "dept"))
        put("seqNo", JsonPrimitive(suffix.toIntOrNull() ?: 0))
        put("active", JsonPrimitive(suffix != "4"))
        put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        put("subSysDictCode", JsonPrimitive("console"))
        put("remark", JsonPrimitive(""))
        put("tenantId", JsonPrimitive(""))
        put("tenantName", JsonPrimitive(""))
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

/** Mock 子系统列表树查询 searchTree：根据 code/name/active/subSystem 筛选，按 parentCode 构建树。 */
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
        node("sys_1", "service_a", "服务A", null, true, true, true, "业务服务A"),
        node("sys_2", "console", "服务B", null, true, true, true, "主控制台"),
        node("sys_3", "service_b", "服务B", "console", true, false, true, "业务服务B"),
        node("sys_4", "module_x", "模块X", "service_a", false, true, false, "子模块"),
        node("sys_5", "module_y", "模块Y", "service_a", false, true, false, ""),
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

/** 子系统详情：根据 id 从与 searchTree 一致的扁平数据中查单条。 */
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
        node("sys_1", "service_a", "服务A", null, true, true, true, "业务服务A"),
        node("sys_2", "console", "服务B", null, true, true, true, "主控制台"),
        node("sys_3", "service_b", "服务B", "console", true, false, true, "业务服务B"),
        node("sys_4", "module_x", "模块X", "service_a", false, true, false, "子模块"),
        node("sys_5", "module_y", "模块Y", "service_a", false, true, false, ""),
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
    // 审计信息字段（详情页展示）
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

/** Mock 微服务列表树查询 searchTree：根据 code/name/active/atomicService 筛选，按 parentCode 构建树。 */
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
        node("ms_1", "gateway", "网关", null, true, "/gateway", true, true, "统一网关"),
        node("ms_2", "user-service", "用户服务", "gateway", true, "/user", true, false, "用户中心"),
        node("ms_3", "order-service", "订单服务", "gateway", true, "/order", true, false, "订单中心"),
        node("ms_4", "order-worker", "订单Worker", "order-service", false, "/order/worker", true, false, ""),
        node("ms_5", "legacy-api", "遗留API", "gateway", false, "/legacy", false, true, "遗留系统"),
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

/** 微服务详情：根据 id 从与 searchTree 一致的扁平数据中查单条。 */
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
        node("ms_1", "gateway", "网关", null, true, "/gateway", true, true, "统一网关"),
        node("ms_2", "user-service", "用户服务", "gateway", true, "/user", true, false, "用户中心"),
        node("ms_3", "order-service", "订单服务", "gateway", true, "/order", true, false, "订单中心"),
        node("ms_4", "order-worker", "订单Worker", "order-service", false, "/order/worker", true, false, ""),
        node("ms_5", "legacy-api", "遗留API", "gateway", false, "/legacy", false, true, "遗留系统"),
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

/** Mock 国际化列表搜索：根据 key/i18nTypeDictCode/atomicServiceCode/locale/active 筛选，排序分页。 */
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
            put("value", JsonPrimitive("保存"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("dict"))
            put("atomicServiceCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("builtIn", JsonPrimitive(true))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_2"))
            put("key", JsonPrimitive("common.cancel"))
            put("value", JsonPrimitive("取消"))
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
            put("value", JsonPrimitive("国际化管理"))
            put("locale", JsonPrimitive("zh-CN"))
            put("i18nTypeDictCode", JsonPrimitive("view"))
            put("atomicServiceCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("builtIn", JsonPrimitive(false))
        },
        buildJsonObject {
            put("id", JsonPrimitive("i18n_5"))
            put("key", JsonPrimitive("sys.i18n.key"))
            put("value", JsonPrimitive("键"))
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock 租户列表搜索：根据 id/name/subSysDictCode/active 筛选，排序分页。 */
private fun buildTenantSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val id = parseOptionalStringParam(params, "id")?.trim() ?: ""
    val name = parseOptionalStringParam(params, "name")?.trim() ?: ""
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, MAX_PAGE_SIZE)
    val sortPair = parseSortParamWithAllowed(params, TENANT_SEARCH_ALLOWED_SORT_PROPERTIES)
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("tenant_1"))
            put("name", JsonPrimitive("默认租户"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_2"))
            put("name", JsonPrimitive("租户A"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_3"))
            put("name", JsonPrimitive("租户B"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowId = primitiveString(row, "id").orEmpty()
        val rowName = primitiveString(row, "name").orEmpty()
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (id.isEmpty() || rowId == id) &&
            (name.isEmpty() || rowName.contains(name, ignoreCase = true)) &&
            (subSysDictCode == null || subSysDictCode == rowSubSys) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock 租户单条获取：按 id 返回编辑用数据，供 sys/tenant/get。 */
private fun buildTenantGetResponse(id: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("tenant_1"))
            put("name", JsonPrimitive("默认租户"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("remark", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_2"))
            put("name", JsonPrimitive("租户A"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("remark", JsonPrimitive("备注A"))
            put("active", JsonPrimitive(true))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("tenant_3"))
            put("name", JsonPrimitive("租户B"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("remark", JsonPrimitive("备注B"))
            put("active", JsonPrimitive(false))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    val row = mockRows.firstOrNull { primitiveString(it, "id") == id }
        ?: buildJsonObject {
            put("id", JsonPrimitive(id))
            put("name", JsonPrimitive(""))
            put("subSysDictCode", JsonPrimitive(""))
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

/** Mock 域名列表搜索：根据 domain/subSysDictCode/tenantId/active 筛选，排序分页。tenantId 与 getAllActiveTenants 一致。 */
private fun buildDomainSearchResponse(requestJson: String): String {
    val params = parseDomainSearchParams(parseJsonObjectOrEmpty(requestJson))
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("domain_1"))
            put("domain", JsonPrimitive("console.example.com"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t6"))
            put("tenantName", JsonPrimitive("租户6"))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("控制台域名"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_2"))
            put("domain", JsonPrimitive("api.example.com"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("tenantName", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("API 域名"))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_3"))
            put("domain", JsonPrimitive("service-a.example.com"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("t5"))
            put("tenantName", JsonPrimitive("租户5"))
            put("active", JsonPrimitive(false))
            put("remark", JsonPrimitive("服务A域名"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    var filtered = mockRows.filter { row ->
        val rowId = primitiveString(row, "id").orEmpty()
        val rowDomain = primitiveString(row, "domain").orEmpty()
        val rowSubSys = primitiveString(row, "subSysDictCode").orEmpty()
        val rowTenantId = primitiveString(row, "tenantId").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.id.isEmpty() || rowId == params.id) &&
            (params.domain.isEmpty() || rowDomain.contains(params.domain, ignoreCase = true)) &&
            (params.subSysDictCode == null || params.subSysDictCode == rowSubSys) &&
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
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock 域名单条获取：按 id 返回编辑用数据，供 sys/domain/get。tenantId 需与 getAllActiveTenants 一致（console→t6，service_a→t5）。 */
private fun buildDomainGetResponse(id: String): String {
    val mockRows = listOf(
        buildJsonObject {
            put("id", JsonPrimitive("domain_1"))
            put("domain", JsonPrimitive("console.example.com"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonPrimitive("t6"))
            put("tenantName", JsonPrimitive("租户6"))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("控制台域名"))
            put("createTime", JsonPrimitive("2024-01-01 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_2"))
            put("domain", JsonPrimitive("api.example.com"))
            put("subSysDictCode", JsonPrimitive("console"))
            put("tenantId", JsonNull)
            put("tenantName", JsonPrimitive(""))
            put("active", JsonPrimitive(true))
            put("remark", JsonPrimitive("API 域名"))
            put("createTime", JsonPrimitive("2024-01-02 10:00:00"))
        },
        buildJsonObject {
            put("id", JsonPrimitive("domain_3"))
            put("domain", JsonPrimitive("service-a.example.com"))
            put("subSysDictCode", JsonPrimitive("service_a"))
            put("tenantId", JsonPrimitive("t5"))
            put("tenantName", JsonPrimitive("租户5"))
            put("active", JsonPrimitive(false))
            put("remark", JsonPrimitive("服务A域名"))
            put("createTime", JsonPrimitive("2024-01-03 10:00:00"))
        },
    )
    val row = mockRows.firstOrNull { primitiveString(it, "id") == id }
        ?: buildJsonObject {
        put("id", JsonPrimitive(id))
        put("domain", JsonPrimitive(""))
        put("subSysDictCode", JsonPrimitive(""))
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

/** Mock 字典列表搜索：返回 first=行列表、second=总数。 */
private fun buildDictSearchResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val pageNo = (primitiveInt(params, "pageNo") ?: 1).coerceAtLeast(1)
    val pageSize = (primitiveInt(params, "pageSize") ?: 10).coerceIn(1, 500)
    val mockRows = listOf(
        buildJsonObject {
            put("dictId", JsonPrimitive("dict_1"))
            put("dictType", JsonPrimitive("dict_type"))
            put("dictName", JsonPrimitive("字典类型"))
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
            put("dictName", JsonPrimitive("用户状态"))
            put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.getOrElse(1) { "user" }))
            put("itemId", JsonNull)
            put("itemCode", JsonNull)
            put("itemName", JsonNull)
            put("parentCode", JsonNull)
            put("seqNo", JsonNull)
            put("active", JsonPrimitive(true))
        },
    )
    val total = mockRows.size
    val fromIndex = ((pageNo - 1) * pageSize).coerceAtLeast(0)
    val toIndex = min(fromIndex + pageSize, total)
    val pageRows = if (fromIndex >= total) emptyList<JsonObject>() else mockRows.subList(fromIndex, toIndex)
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", buildJsonObject {
            put("first", JsonArray(pageRows))
            put("second", JsonPrimitive(total))
        })
    }
    return response.toString()
}

/** Mock 字典按树查询：与 search 相同结构 first/second，供展开树节点时表格数据。 */
private fun buildDictSearchByTreeResponse(requestJson: String): String = buildDictSearchResponse(requestJson)

/** Mock 字典树：根=模块(code)，第二层=字典类型(id+code)，第三层=字典项(id+code)。 */
private fun buildDictLoadTreeNodesResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val parentId = primitiveString(params, "parentId")?.takeIf { it.isNotBlank() }
    val firstLevel = primitiveBoolean(params, "firstLevel") == true

    val nodes: List<JsonObject> = when {
        parentId == null -> ATOMIC_SERVICE_CODES_ORDERED.map { code ->
            buildJsonObject { put("id", JsonPrimitive(code)); put("code", JsonPrimitive(code)) }
        }
        firstLevel -> listOf(
            buildJsonObject { put("id", JsonPrimitive("dict_${parentId}_1")); put("code", JsonPrimitive("dict_${parentId}_1")) },
            buildJsonObject { put("id", JsonPrimitive("dict_${parentId}_2")); put("code", JsonPrimitive("dict_${parentId}_2")) },
        )
        else -> listOf(
            buildJsonObject { put("id", JsonPrimitive("item_${parentId}_1")); put("code", JsonPrimitive("item_1")) },
            buildJsonObject { put("id", JsonPrimitive("item_${parentId}_2")); put("code", JsonPrimitive("item_2")) },
        )
    }
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(nodes))
    }
    return response.toString()
}

/** 子系统列表（与 buildSubsysSearchTreeResponse 一致），供资源树第二级等复用。 */
private fun buildResourceSubsystemLevelNodes(): List<JsonObject> = listOf(
    buildJsonObject { put("id", JsonPrimitive("service_a")); put("name", JsonPrimitive("服务A")) },
    buildJsonObject { put("id", JsonPrimitive("console")); put("name", JsonPrimitive("服务B")) },
    buildJsonObject { put("id", JsonPrimitive("service_b")); put("name", JsonPrimitive("服务B")) },
)

/** Mock 资源树：仅两级——第一级=资源类型（菜单/按钮），第二级=子系统；严格按 level 分支。 */
private fun buildResourceLoadTreeNodesResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val level = primitiveInt(params, "level") ?: 0

    val nodes: List<JsonObject> = when (level) {
        0 -> listOf(
            buildJsonObject { put("id", JsonPrimitive("menu")); put("name", JsonPrimitive("菜单")) },
            buildJsonObject { put("id", JsonPrimitive("button")); put("name", JsonPrimitive("按钮")) },
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

/** 原子服务（sub_sys）统一数据源：顺序与展示名，所有需要原子服务测试数据的 mock 均由此生成。 */
private val ATOMIC_SERVICE_CODES_ORDERED = listOf("sys", "user", "auth", "msg", "service_a", "console")
private val ATOMIC_SERVICE_DISPLAY = mapOf(
    "sys" to "sys",
    "user" to "user",
    "auth" to "auth",
    "msg" to "msg",
    "service_a" to "服务A",
    "console" to "服务B",
)

/** 原子服务列表 API 返回：非字典，专用接口。 */
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

/** 预置字典项 mock：module---dictType -> code->name。前端 batchGetDictItemMap 用 "[module, dictType]" 作 key。原子服务不是字典，不在此处。 */
private val MOCK_DICT_ITEM_MAP = mapOf(
    "kuark:sys---resource_type" to mapOf(
        "menu" to "菜单",
        "button" to "按钮",
    ),
    "kuark:sys---cache_strategy" to mapOf(
        "SINGLE_LOCAL" to "cache_strategy.SINGLE_LOCAL",
        "REMOTE" to "cache_strategy.REMOTE",
        "LOCAL_REMOTE" to "cache_strategy.LOCAL_REMOTE",
    ),
    "kuark:sys---module" to mapOf(
        "kuark:sys" to "系统",
        "kuark:user" to "用户",
        "kuark:log" to "日志",
        "kuark:job" to "任务",
    ),
    "kuark:user---user_status" to mapOf(
        "NORMAL" to "正常",
        "LOCKED" to "锁定",
        "DISABLED" to "禁用",
    ),
    "kuark:user---user_type" to mapOf(
        "ADMIN" to "管理员",
        "USER" to "普通用户",
    ),
    "kuark:sys---locale" to mapOf(
        "zh-CN" to "zh-CN",
        "zh-TW" to "zh-TW",
        "en-US" to "en-US",
    ),
    "kuark:sys---i18n_type" to mapOf(
        "dict" to "i18n_type.dict",
        "dict_item" to "i18n_type.dict_item",
        "view" to "i18n_type.view",
    ),
)

/** 从请求 body 解析出 params 数组：支持直接数组或 { params: [...] } */
private fun parseBatchGetDictItemParams(requestJson: String): List<Pair<String, String>> {
    if (requestJson.isBlank()) return emptyList()
    val element = runCatching { json.parseToJsonElement(requestJson) }.getOrNull() ?: return emptyList()
    val arr = when (element) {
        is JsonArray -> element
        is JsonObject -> element["params"] as? JsonArray ?: return emptyList()
        else -> return emptyList()
    }
    val list = mutableListOf<Pair<String, String>>()
    for (e in arr) {
        if (e !is JsonObject) continue
        val module = primitiveString(e, "module").orEmpty()
        val dictType = primitiveString(e, "dictType").orEmpty()
        if (dictType.isNotEmpty()) list.add(Pair(module, dictType))
    }
    return list
}

/** Mock 批量获取字典项：请求 body 为 [{ module, dictType }, ...] 或 { params: [...] }，返回 data: { "[module, dictType]": { "code": "name", ... }, ... } */
private fun buildBatchGetDictItemMapResponse(requestJson: String): String {
    val params = parseBatchGetDictItemParams(requestJson)
    val dataObj = buildJsonObject {
        for ((module, dictType) in params) {
            val cacheKey = "$module---$dictType"
            val items = MOCK_DICT_ITEM_MAP[cacheKey] ?: emptyMap()
            val mapObj = buildJsonObject {
                for ((code, name) in items) {
                    put(code, JsonPrimitive(name))
                }
            }
            put("[$module, $dictType]", mapObj)
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
        "/sys/cache/search", "/api/sys/cache/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildCacheSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/cache/getDetail", "/api/sys/cache/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildCacheGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/cache/getValidationRule", "/api/sys/cache/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/search", "/api/sys/dataSource/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDataSourceSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/getDetail", "/api/sys/dataSource/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildDataSourceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/getValidationRule", "/api/sys/dataSource/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dataSource/saveOrUpdate", "/api/sys/dataSource/saveOrUpdate" -> {
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
        "/sys/param/search", "/api/sys/param/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildParamSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/getDetail", "/api/sys/param/getDetail" -> {
            val id = request.url.parameters["id"] ?: request.url.parameters["paramId"] ?: ""
            val body = buildParamGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/getValidationRule", "/api/sys/param/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/saveOrUpdate", "/api/sys/param/saveOrUpdate" -> {
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
        "/sys/resource/search", "/api/sys/resource/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/getDetail", "/api/sys/resource/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildResourceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/getValidationRule", "/api/sys/resource/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/saveOrUpdate", "/api/sys/resource/saveOrUpdate" -> {
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
        "/sys/resource/loadTreeNodes", "/api/sys/resource/loadTreeNodes" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceLoadTreeNodesResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/searchByTree", "/api/sys/resource/searchByTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceSearchResponse("/sys/resource/search", requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/atomicServices", "/api/sys/atomicServices" -> {
            val body = buildAtomicServicesResponse()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/loadDictTypes", "/api/sys/dict/loadDictTypes" -> {
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
        "/sys/dict/loadTreeNodes", "/api/sys/dict/loadTreeNodes" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictLoadTreeNodesResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/search", "/api/sys/domain/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDomainSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/get", "/api/sys/domain/get" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildDomainGetResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/getValidationRule", "/api/sys/domain/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/domain/saveOrUpdate", "/api/sys/domain/saveOrUpdate" -> {
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
        "/sys/dictItem/batchGetDictItemMap", "/api/sys/dictItem/batchGetDictItemMap" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildBatchGetDictItemMapResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/search", "/api/sys/tenant/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildTenantSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/get", "/api/sys/tenant/get" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildTenantGetResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/getValidationRule", "/api/sys/tenant/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/saveOrUpdate", "/api/sys/tenant/saveOrUpdate" -> {
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
        "/sys/i18n/search", "/api/sys/i18n/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildI18nSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/getDetail", "/api/sys/i18n/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildI18nGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/getValidationRule", "/api/sys/i18n/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/i18n/saveOrUpdate", "/api/sys/i18n/saveOrUpdate" -> {
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
        "/user/account/search", "/api/user/account/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildAccountSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/getDetail", "/api/user/account/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildAccountGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/getValidationRule", "/api/user/account/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/account/saveOrUpdate", "/api/user/account/saveOrUpdate" -> {
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
        "/rbac/group/search", "/api/rbac/group/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildUserGroupSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/getDetail", "/api/rbac/group/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildUserGroupGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/getValidationRule", "/api/rbac/group/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/group/saveOrUpdate", "/api/rbac/group/saveOrUpdate" -> {
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
        "/rbac/role/search", "/api/rbac/role/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildRoleSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/getDetail", "/api/rbac/role/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildRoleGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/getValidationRule", "/api/rbac/role/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/rbac/role/saveOrUpdate", "/api/rbac/role/saveOrUpdate" -> {
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
        "/user/organization/loadTree", "/api/user/organization/loadTree" -> {
            val subSys = request.url.parameters["subSysDictCode"]
            val tenant = request.url.parameters["tenantId"]
            val body = buildOrganizationLoadTreeResponse(subSys, tenant)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/searchTree", "user/organization/searchTree", "/api/user/organization/searchTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildOrganizationSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/getDetail", "/api/user/organization/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildOrganizationGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/getValidationRule", "/api/user/organization/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/user/organization/saveOrUpdate", "/api/user/organization/saveOrUpdate" -> {
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
        "/sys/subsys/searchTree", "sys/subsys/searchTree", "/api/sys/subsys/searchTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildSubsysSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/getDetail", "/api/sys/subsys/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildSubsysGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/getValidationRule", "/api/sys/subsys/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/subsys/saveOrUpdate", "/api/sys/subsys/saveOrUpdate" -> {
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
        "/sys/microservice/searchTree", "sys/microservice/searchTree", "/api/sys/microservice/searchTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildMicroserviceSearchTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microservice/getDetail", "/api/sys/microservice/getDetail" -> {
            val id = request.url.parameters["id"] ?: ""
            val body = buildMicroserviceGetDetailResponse(id)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microservice/getValidationRule", "/api/sys/microservice/getValidationRule" -> {
            val body = MockJsonStore.byPath[path] ?: "{\"code\":200,\"data\":{}}"
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/microservice/saveOrUpdate", "/api/sys/microservice/saveOrUpdate" -> {
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
        "/sys/dict/search", "/api/sys/dict/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictSearchResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/searchByTree", "/api/sys/dict/searchByTree" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDictSearchByTreeResponse(requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/tenant/getAllActiveTenants", "/api/sys/tenant/getAllActiveTenants" -> {
            val data = buildJsonObject {
                ATOMIC_SERVICE_CODES_ORDERED.forEachIndexed { index, code ->
                    put(code, buildJsonObject {
                        put("t${index + 1}", JsonPrimitive("租户${index + 1}"))
                        // 与 dataSource/search fixture 一致，便于编辑回填子系统/租户
                        if (code == "console") {
                            put("default", JsonPrimitive("默认租户"))
                            put("tenant_2", JsonPrimitive("租户二"))
                        }
                        if (code == "service_a") put("1", JsonPrimitive("租户A1"))
                    })
                }
            }
            val body = buildJsonObject {
                put("code", JsonPrimitive(200))
                put("data", data)
            }.toString()
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/dict/getDict", "/api/sys/dict/getDict" -> {
            val id = request.url.parameters["id"] ?: ""
            val isDict = request.url.parameters["isDict"]?.toBooleanStrictOrNull() == true
            val row = buildJsonObject {
                put("dictId", JsonPrimitive("dict_$id"))
                put("dictType", JsonPrimitive("dict_type"))
                put("dictName", JsonPrimitive(if (isDict) "字典类型" else "字典项"))
                put("module", JsonPrimitive(ATOMIC_SERVICE_CODES_ORDERED.first()))
                put("itemId", if (isDict) JsonNull else JsonPrimitive("item_$id"))
                put("itemCode", if (isDict) JsonNull else JsonPrimitive("item_$id"))
                put("itemName", if (isDict) JsonNull else JsonPrimitive("项名称"))
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
        "/sys/dict/getDetail", "/api/sys/dict/getDetail" -> {
            val id = request.url.parameters["id"] ?: request.url.parameters["dictId"] ?: ""
            val row = buildJsonObject {
                put("id", JsonPrimitive("dict_$id"))
                put("dictId", JsonPrimitive("dict_$id"))
                put("dictType", JsonPrimitive("dict_type"))
                put("dictName", JsonPrimitive("字典类型"))
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
