import { ElMessage } from "element-plus";
import { Pair } from "../../model/Pair";
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from "../../../utils/backendRequest";

const DICT_CACHE_KEY = "__kudosDictCache";

const BATCH_GET_DICT_ITEM_MAP_URL = "sys/dictItem/batchGetDictItemMap";

/**
 * Dictionary service: responsible for loading, caching, and translating dictionaries.
 * Cache key format: atomicServiceCode---dictType
 * Request: POST /api/admin/sys/dictItem/batchGetDictItemMap, body is dictTypesByAtomicServiceCode: Map<atomicServiceCode, Collection<dictType>>
 * Response: Map<atomicServiceCode, Map<dictType, Record<code, translation or i18n key>>>
 * Dictionary item translations (when value is an i18n key) are fetched via batchGetI18ns as specified by each page's getI18nConfig(), with type dict-item and namespace being the dictType code (e.g. cache_strategy).
 *
 * @author K
 * @author AI: Cursor
 * @since 1.0.0
 */
export class DictService {
    /** Dictionary cache: key is "atomicServiceCode---dictType", value is code->name (or i18n key) */
    public readonly cache: Map<string, Record<string, string>>;

    constructor() {
        const win = window as unknown as { [key: string]: Map<string, Record<string, string>> | undefined };
        if (!win[DICT_CACHE_KEY]) {
            win[DICT_CACHE_KEY] = new Map();
        }
        this.cache = win[DICT_CACHE_KEY];
    }

    /** Translate to display name based on atomicServiceCode + dictType + code */
    transDict(atomicServiceCode: string, dictType: string, code: string): string {
        if (!code) return "";
        const key = this.toCacheKey(atomicServiceCode, dictType);
        const itemMap = this.cache.get(key);
        if (itemMap) {
            const name = itemMap[code];
            return name != null ? name : code;
        }
        return code;
    }

    /** Load a single dictionary, skip if already cached */
    async loadDict(atomicServiceCode: string, dictType: string): Promise<void> {
        await this.loadDicts([dictType], atomicServiceCode);
    }

    /**
     * Batch-load dictionaries, only loading items not yet cached.
     * Request body: dictTypesByAtomicServiceCode = { [atomicServiceCode]: toLoad }
     * Response: Map<atomicServiceCode, Map<dictType, Record<code, translation or i18n key>>>
     */
    async loadDicts(dictTypes: string[], atomicServiceCode: string): Promise<void> {
        const cacheKeyPrefix = atomicServiceCode + "---";
        const toLoad = dictTypes.filter((dt) => !this.cache.has(cacheKeyPrefix + dt));
        if (toLoad.length === 0) return;

        const dictTypesByAtomicServiceCode: Record<string, string[]> = {
            [atomicServiceCode]: toLoad,
        };
        const result = await backendRequest({
            url: BATCH_GET_DICT_ITEM_MAP_URL,
            method: "post",
            params: dictTypesByAtomicServiceCode,
        });

        const data = this.normalizeBatchDictResponse(result);
        if (data && typeof data === "object") {
            const byAtomic = data as Record<string, Record<string, Record<string, string>>>;
            for (const [atomic, dictTypeMap] of Object.entries(byAtomic)) {
                if (dictTypeMap && typeof dictTypeMap === "object") {
                    const prefix = atomic + "---";
                    for (const [dictType, itemMap] of Object.entries(dictTypeMap)) {
                        if (itemMap && typeof itemMap === "object") {
                            this.cache.set(prefix + dictType, itemMap);
                        }
                    }
                }
            }
        } else if (!isApiSuccessResponse(result)) {
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || "Failed to batch-load dictionary items!");
        }
    }

    /** Batch-load multiple dictionary groups (used when atomicServiceCode differs), merged into one POST */
    async loadDictsBatch(configs: Array<{ dictTypes: string[]; atomicServiceCode: string }>): Promise<void> {
        const dictTypesByAtomicServiceCode: Record<string, string[]> = {};
        for (const c of configs) {
            const prefix = c.atomicServiceCode + "---";
            const toLoad = c.dictTypes.filter((dt) => !this.cache.has(prefix + dt));
            if (toLoad.length === 0) continue;
            const existing = dictTypesByAtomicServiceCode[c.atomicServiceCode] ?? [];
            dictTypesByAtomicServiceCode[c.atomicServiceCode] = [...new Set([...existing, ...toLoad])];
        }
        if (Object.keys(dictTypesByAtomicServiceCode).length === 0) return;

        const result = await backendRequest({
            url: BATCH_GET_DICT_ITEM_MAP_URL,
            method: "post",
            params: dictTypesByAtomicServiceCode,
        });

        const data = this.normalizeBatchDictResponse(result);
        if (data && typeof data === "object") {
            const byAtomic = data as Record<string, Record<string, Record<string, string>>>;
            for (const [atomic, dictTypeMap] of Object.entries(byAtomic)) {
                if (dictTypeMap && typeof dictTypeMap === "object") {
                    const prefix = atomic + "---";
                    for (const [dictType, itemMap] of Object.entries(dictTypeMap)) {
                        if (itemMap && typeof itemMap === "object") {
                            this.cache.set(prefix + dictType, itemMap);
                        }
                    }
                }
            }
        } else if (!isApiSuccessResponse(result)) {
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || "Failed to batch-load dictionary items!");
        }
    }

    /** Parse batch dictionary API response: may be { code, data } or data directly */
    private normalizeBatchDictResponse(result: unknown): Record<string, Record<string, Record<string, string>>> | null {
        const payload = getApiResponseData(result)
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            return payload as Record<string, Record<string, Record<string, string>>>;
        }
        if (result && typeof result === "object" && !Array.isArray(result) && !("success" in result)) {
            return result as Record<string, Record<string, Record<string, string>>>;
        }
        return null;
    }

    /** Returns dictionary item list [Pair(code, name)] for use by el-select, etc.; requires prior loadDict/loadDicts */
    getDictItems(atomicServiceCode: string, dictType: string): Array<Pair> {
        const key = this.toCacheKey(atomicServiceCode, dictType);
        const map = this.cache.get(key);
        const pairs: Array<Pair> = [];
        if (map) {
            for (const k in map) {
                pairs.push(new Pair(k, map[k]));
            }
        }
        return pairs;
    }

    private toCacheKey(atomicServiceCode: string, dictType: string): string {
        return atomicServiceCode + "---" + dictType;
    }
}
