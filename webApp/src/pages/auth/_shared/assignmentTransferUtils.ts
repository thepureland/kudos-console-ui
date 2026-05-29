/**
 * Shared utilities for assignment-transfer dialogs (role↔user, role↔resource, group↔user, group↔role, etc).
 *
 * All six dialogs follow the same pattern:
 *   1. Load the currently-assigned ID set (one GET per dialog).
 *   2. Resolve those IDs to {key,label} items via the target entity's pagingSearch.
 *   3. Show candidates from the target entity's pagingSearch with server-side search + paging.
 *   4. On submit, diff against the snapshot and call per-id bind/unbind.
 *
 * Using `pageSize: 1000` and client-side filtering doesn't scale beyond a few hundred items;
 * these helpers swap that out for a debounced server-side search (the `filter-method` hook on
 * el-transfer is repurposed to trigger the fetch instead of doing client-side filtering).
 *
 * @author K
 * @since 1.0.0
 */
import {
    backendRequest,
    getApiResponseData,
    getApiResponseMessage,
    isApiSuccessResponse,
    resolveApiResponseMessage,
} from "../../../utils/backendRequest"
import { ElMessage } from "element-plus"

export interface TransferItem {
    key: string
    label: string
}

export interface ResolveItemsOptions {
    /** pagingSearch URL, e.g. 'user/account/pagingSearch'. */
    searchUrl: string
    /** Already-assigned IDs to resolve. */
    ids: string[]
    /** Base search params (e.g. subSystemCode/tenantId). */
    baseParams?: Record<string, unknown>
    /** Build a label from a result row. */
    pickLabel: (row: Record<string, unknown>) => string
    /** Row id field. Defaults to 'id'. */
    idField?: string
}

/** Resolve a set of IDs into {key,label} items by hitting pagingSearch with `ids` filter. */
export async function resolveAssignedItems(opts: ResolveItemsOptions): Promise<TransferItem[]> {
    if (opts.ids.length === 0) return []
    const params: Record<string, unknown> = {
        ...(opts.baseParams ?? {}),
        pageNo: 1,
        pageSize: Math.max(opts.ids.length, 50),
        ids: opts.ids,
    }
    const result = await backendRequest({ url: opts.searchUrl, method: "post", params })
    if (!isApiSuccessResponse(result)) {
        ElMessage.error(
            (await resolveApiResponseMessage(result)) ||
                getApiResponseMessage(result) ||
                "Failed to resolve assigned items",
        )
        return []
    }
    const payload = getApiResponseData<
        { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
    >(result)
    const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : (payload?.data ?? [])
    const idField = opts.idField ?? "id"
    const idSet = new Set(opts.ids.map(String))
    return rows
        .filter((r) => idSet.has(String(r[idField] ?? "")))
        .map((r) => ({
            key: String(r[idField] ?? ""),
            label: opts.pickLabel(r),
        }))
        .filter((it) => it.key !== "")
}

export interface SearchCandidatesOptions {
    /** pagingSearch URL. */
    searchUrl: string
    /** Search keyword from the transfer's filter input. */
    keyword: string
    /** Backend field that the keyword maps to (e.g. 'username' for users, 'name' for resources). */
    keywordField?: string
    /** Base search params; merged into the request. */
    baseParams?: Record<string, unknown>
    /** Page number (1-based). */
    pageNo?: number
    /** Page size. Default 50. */
    pageSize?: number
    /** Build a label from a result row. */
    pickLabel: (row: Record<string, unknown>) => string
    /** Row id field. Defaults to 'id'. */
    idField?: string
}

export interface SearchCandidatesResult {
    items: TransferItem[]
    /** Total candidates available on the server, when the response is paginated. -1 when unknown. */
    totalCount: number
}

/** Issue one pagingSearch for candidates, returning a page of items + total. */
export async function searchCandidates(opts: SearchCandidatesOptions): Promise<SearchCandidatesResult> {
    const params: Record<string, unknown> = {
        ...(opts.baseParams ?? {}),
        pageNo: opts.pageNo ?? 1,
        pageSize: opts.pageSize ?? 50,
    }
    const kw = opts.keyword?.trim()
    if (kw && opts.keywordField) params[opts.keywordField] = kw
    const result = await backendRequest({ url: opts.searchUrl, method: "post", params })
    if (!isApiSuccessResponse(result)) {
        ElMessage.error(
            (await resolveApiResponseMessage(result)) ||
                getApiResponseMessage(result) ||
                "Failed to load candidates",
        )
        return { items: [], totalCount: 0 }
    }
    const payload = getApiResponseData<
        { data?: Array<Record<string, unknown>>; totalCount?: number } | Array<Record<string, unknown>>
    >(result)
    const idField = opts.idField ?? "id"
    let rows: Array<Record<string, unknown>>
    let total: number
    if (Array.isArray(payload)) {
        rows = payload
        total = payload.length
    } else if (payload && Array.isArray(payload.data)) {
        rows = payload.data
        total = typeof payload.totalCount === "number" ? payload.totalCount : payload.data.length
    } else {
        rows = []
        total = 0
    }
    const items = rows
        .map((r) => ({ key: String(r[idField] ?? ""), label: opts.pickLabel(r) }))
        .filter((it) => it.key !== "")
    return { items, totalCount: total }
}

/** Parse a backend response (an array, Set serialized as object, or null/undefined) into a string[]. */
export function normalizeIdSet(data: unknown): string[] {
    if (Array.isArray(data)) return data.map(String)
    if (data && typeof data === "object") {
        return Array.from(Object.values(data as Record<string, unknown>)).map(String)
    }
    return []
}

/** Merge candidates with already-assigned items, deduplicating by key. Used to feed el-transfer's `data` prop. */
export function mergeTransferData(
    candidates: TransferItem[],
    assigned: TransferItem[],
): TransferItem[] {
    const seen = new Set<string>()
    const out: TransferItem[] = []
    for (const arr of [assigned, candidates]) {
        for (const item of arr) {
            if (seen.has(item.key)) continue
            seen.add(item.key)
            out.push(item)
        }
    }
    return out
}

/**
 * Wrap a fn so calls within `delayMs` of the previous invocation are coalesced.
 * Lightweight, dependency-free; the project doesn't pull in lodash.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): T {
    let timer: ReturnType<typeof setTimeout> | null = null
    const wrapped = ((...args: Parameters<T>) => {
        if (timer != null) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            fn(...args)
        }, delayMs)
    }) as T
    return wrapped
}
