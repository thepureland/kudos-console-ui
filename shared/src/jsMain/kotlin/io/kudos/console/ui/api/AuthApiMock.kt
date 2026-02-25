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

private data class ParamSearchParams(
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
    val module = parseOptionalStringParam(params, "module") ?: ""
    val paramName = parseOptionalStringParam(params, "paramName") ?: ""
    val paramValue = parseOptionalStringParam(params, "paramValue") ?: ""
    val active = parseOptionalBooleanParam(params, "active")
    val pageNo = parsePositiveIntParam(params, "pageNo", 1) ?: 1
    val pageSizeRaw = parsePositiveIntParam(params, "pageSize", 10) ?: 10
    val pageSize = pageSizeRaw.coerceAtMost(MAX_PAGE_SIZE)
    val sortPair = parseSortParamForParam(params)
    return ParamSearchParams(
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

private fun buildParamSearchResponse(path: String, requestJson: String): String {
    val fixture = MockJsonStore.byPath[path] ?: return "{\"code\":404,\"data\":null}"
    val fixtureObj = parseJsonObjectOrEmpty(fixture)
    val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
    val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
    val paramsObj = parseJsonObjectOrEmpty(requestJson)
    val params = parseParamSearchParams(paramsObj)

    var filtered = allRows.filter { row ->
        val rowModule = primitiveString(row, "module").orEmpty()
        val rowParamName = primitiveString(row, "paramName").orEmpty()
        val rowParamValue = primitiveString(row, "paramValue").orEmpty()
        val rowActive = primitiveBoolean(row, "active")
        (params.module.isEmpty() || rowModule == params.module) &&
            (params.paramName.isEmpty() || rowParamName.contains(params.paramName, ignoreCase = true)) &&
            (params.paramValue.isEmpty() || rowParamValue.contains(params.paramValue, ignoreCase = true)) &&
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
            put("module", JsonPrimitive("module"))
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
            put("module", JsonPrimitive("module"))
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
        parentId == null -> listOf(
            buildJsonObject { put("id", JsonPrimitive("module")); put("code", JsonPrimitive("module")) },
            buildJsonObject { put("id", JsonPrimitive("sub_sys")); put("code", JsonPrimitive("sub_sys")) },
            buildJsonObject { put("id", JsonPrimitive("resource_type")); put("code", JsonPrimitive("resource_type")) },
            buildJsonObject { put("id", JsonPrimitive("cache_strategy")); put("code", JsonPrimitive("cache_strategy")) },
            buildJsonObject { put("id", JsonPrimitive("dict_type")); put("code", JsonPrimitive("dict_type")) },
        )
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

/** Mock 资源树：根=资源类型，第二层=子系统，第三层=资源节点（从 search fixture 取）。 */
private fun buildResourceLoadTreeNodesResponse(requestJson: String): String {
    val params = parseJsonObjectOrEmpty(requestJson)
    val level = primitiveInt(params, "level") ?: 0
    val parentId = primitiveString(params, "parentId")?.takeIf { it.isNotBlank() }
    val resourceTypeDictCode = primitiveString(params, "resourceTypeDictCode")?.takeIf { it.isNotBlank() }
    val subSysDictCode = primitiveString(params, "subSysDictCode")?.takeIf { it.isNotBlank() }

    val nodes: List<JsonObject> = when {
        level == 0 || (parentId == null && resourceTypeDictCode == null) -> listOf(
            buildJsonObject { put("id", JsonPrimitive("menu")); put("name", JsonPrimitive("菜单")) },
            buildJsonObject { put("id", JsonPrimitive("button")); put("name", JsonPrimitive("按钮")) },
        )
        level == 1 || (resourceTypeDictCode != null && subSysDictCode == null) -> listOf(
            buildJsonObject { put("id", JsonPrimitive("console")); put("name", JsonPrimitive("控制台")) },
            buildJsonObject { put("id", JsonPrimitive("service_a")); put("name", JsonPrimitive("服务A")) },
        )
        else -> {
            val fixture = MockJsonStore.byPath["/sys/resource/search"] ?: return "{\"code\":200,\"data\":[]}"
            val fixtureObj = parseJsonObjectOrEmpty(fixture)
            val dataObj = fixtureObj["data"]?.jsonObject ?: JsonObject(emptyMap())
            val allRows = dataObj["first"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
            allRows.take(5).map { row ->
                buildJsonObject {
                    put("id", row["id"] ?: JsonPrimitive(""))
                    put("name", row["name"] ?: JsonPrimitive(""))
                }
            }
        }
    }
    val response = buildJsonObject {
        put("code", JsonPrimitive(200))
        put("data", JsonArray(nodes))
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
        "/sys/dataSource/search", "/api/sys/dataSource/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildDataSourceSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/param/search", "/api/sys/param/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildParamSearchResponse(path, requestJson)
            respond(body, HttpStatusCode.OK, headers)
        }
        "/sys/resource/search", "/api/sys/resource/search" -> {
            val requestJson = requestBodyText(request.body)
            val body = buildResourceSearchResponse(path, requestJson)
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
        "/sys/dict/loadDictTypes", "/api/sys/dict/loadDictTypes" -> {
            val data = JsonArray(
                listOf(
                    JsonPrimitive("module"),
                    JsonPrimitive("sub_sys"),
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
        "/sys/dict/getDict", "/api/sys/dict/getDict" -> {
            val id = request.url.parameters["id"] ?: ""
            val isDict = request.url.parameters["isDict"]?.toBooleanStrictOrNull() == true
            val row = buildJsonObject {
                put("dictId", JsonPrimitive("dict_$id"))
                put("dictType", JsonPrimitive("dict_type"))
                put("dictName", JsonPrimitive(if (isDict) "字典类型" else "字典项"))
                put("module", JsonPrimitive("module"))
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
