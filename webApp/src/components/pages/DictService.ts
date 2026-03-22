import { ElMessage } from "element-plus";
import { Pair } from "../model/Pair";
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from "../../utils/backendRequest";

const DICT_CACHE_KEY = "__kudosDictCache";

const BATCH_GET_DICT_ITEM_MAP_URL = "sys/dictItem/batchGetDictItemMap";

/**
 * 字典服务：负责字典的加载、缓存与翻译。
 * 缓存 key 格式：原子服务编码---字典类型
 * 请求：POST /api/admin/sys/dictItem/batchGetDictItemMap，body 为 dictTypesByAtomicServiceCode: Map<原子服务编码, Collection<字典类型>>
 * 返回：Map<原子服务编码, Map<字典类型, Record<编码, 译文或i18n key>>>
 * 字典项译文（当 value 为 i18n key 时）由各页 getI18nConfig() 指定从 batchGetI18ns 拉取，类型 dict-item、命名空间为字典类型编码（如 cache_strategy）。
 *
 * @author K
 * @author AI: Cursor
 * @since 1.0.0
 */
export class DictService {
    /** 字典缓存：key 为 "原子服务编码---字典类型"，value 为 编码->名称（或 i18n key） */
    public readonly cache: Map<string, Record<string, string>>;

    constructor() {
        const win = window as unknown as { [key: string]: Map<string, Record<string, string>> | undefined };
        if (!win[DICT_CACHE_KEY]) {
            win[DICT_CACHE_KEY] = new Map();
        }
        this.cache = win[DICT_CACHE_KEY];
    }

    /** 根据原子服务编码+字典类型+编码翻译为显示名称 */
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

    /** 加载单个字典，已存在则跳过 */
    async loadDict(atomicServiceCode: string, dictType: string): Promise<void> {
        await this.loadDicts([dictType], atomicServiceCode);
    }

    /**
     * 批量加载字典，仅加载尚未缓存的项。
     * 请求体：dictTypesByAtomicServiceCode = { [atomicServiceCode]: toLoad }
     * 返回：Map<原子服务编码, Map<字典类型, Record<编码, 译文或i18n key>>>
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
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || "批量加载字典项失败！");
        }
    }

    /** 批量加载多组字典（不同 atomicServiceCode 时使用），合并为一次 POST */
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
            ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || "批量加载字典项失败！");
        }
    }

    /** 解析批量字典接口返回：可能为 { code, data } 或直接为 data */
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

    /** 返回字典项列表 [Pair(编码, 名称)]，供 el-select 等使用；需先 loadDict/loadDicts */
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
