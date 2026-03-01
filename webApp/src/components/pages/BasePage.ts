import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Pair } from "../model/Pair";
import { backendRequest } from "../../utils/backendRequest";
import { i18n } from "../../i18n";

/**
 * 列表页面处理抽象父类
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BasePage {

    public dictCache: Map<string, Record<string, string>> // Map<原子服务---字典类型, Map<字典项编码，字典项名称>>
    public state: Record<string, any>
    public visible = ref(false)

    protected props: Record<string, any>
    protected context: { emit: (event: string, ...args: any[]) => void }

    /** 原子服务列表（非字典）：{ code, name }[]，由 loadAtomicServices 拉取 */
    public atomicServiceList: Array<{ code: string; name: string }> = []

    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        this.props = props
        this.context = context
        const win = window as unknown as { __kudosDictCache?: Map<string, Record<string, string>>; __kudosAtomicServices?: Array<{ code: string; name: string }> }
        if (!win.__kudosDictCache) {
            win.__kudosDictCache = new Map()
        }
        this.dictCache = win.__kudosDictCache
        if (win.__kudosAtomicServices) {
            this.atomicServiceList = win.__kudosAtomicServices
        }
        this.state = reactive(this.initBaseState())
        const initState = this.initState()
        if (initState) {
            const additionalState = reactive(initState)
            Object.assign(this.state, additionalState)
        }
        this.convertThis()
        if (!this.showAfterLoadData()) {
            this.render()
        }
    }

    protected render() {
        this.visible.value = true
    }

    protected abstract initState(): any

    protected initBaseState(): any {
        return {}
    }

    protected abstract getRootActionPath(): string

    protected showAfterLoadData(): boolean {
        return false
    }

    public transDict: (module: string | null | undefined, type: string, code: string) => string

    protected doTransDict(module: string | null | undefined, dictType: string, code: string): string {
        if (code) {
            const key = (module ? module : "") + '---' + dictType
            const itemMap = this.dictCache.get(key)
            if (itemMap) {
                const name = itemMap[code]
                return name != null ? name : code
            }
            return code
        }
        return ''
    }

    protected async loadDict(module: string | null | undefined, dictType: string) {
        const key = (module ? module : "") + '---' + dictType
        if (this.dictCache.has(key)) {
            return
        }

        const params = {
            module: module,
            dictType: dictType
        }
        const result = await backendRequest({ url: "sys/dictItem/getDictItemMap", params })
        if (result.code == 200) {
            this.dictCache.set(key, result.data)
        } else {
            ElMessage.error('字典项加载失败！')
        }
    }

    protected async loadDicts(moduleAndTypes: Array<Pair>) {
        const params = []
        for (let obj of moduleAndTypes) {
            const module = obj.first ? obj.first : ""
            const dictType = obj.second
            const key = module + '---' + dictType
            if (!this.dictCache.has(key)) {
                params.push({
                    module: module,
                    dictType: dictType
                })
            }
        }
        if (params.length == 0) return

        const result = await backendRequest({ url: "sys/dictItem/batchGetDictItemMap", method: "post", params })
        if (result.code == 200) {
            for (let key in result.data) {
                const parts = key.slice(1, -1).split(", ")
                this.dictCache.set(parts[0] + "---" + parts[1], result.data[key])
            }
        } else {
            ElMessage.error('批量加载字典项失败！')
        }
    }

    public getDictItems = (module: string | null | undefined, dictType: string): Array<Pair> => {
        const key = (module ? module : "") + '---' + dictType
        const map = this.dictCache.get(key)
        const pairs = []
        if (map) {
            for (let k in map) {
                pairs.push(new Pair(k, map[k]))
            }
        }
        return pairs
    }

    /** 加载原子服务列表（非字典，专用接口），结果缓存在 window.__kudosAtomicServices */
    protected async loadAtomicServices(): Promise<void> {
        const win = window as unknown as { __kudosAtomicServices?: Array<{ code: string; name: string }> }
        if (win.__kudosAtomicServices && win.__kudosAtomicServices.length > 0) {
            this.atomicServiceList = win.__kudosAtomicServices
            return
        }
        const result = await backendRequest({ url: 'sys/atomicServices' }) as { code: number; data?: Array<{ code: string; name: string }> }
        if (result.code === 200 && result.data) {
            win.__kudosAtomicServices = result.data
            this.atomicServiceList = result.data
        } else {
            ElMessage.error('原子服务列表加载失败')
        }
    }

    /** 获取原子服务列表，用于下拉等（需先调用 loadAtomicServices） */
    public getAtomicServices = (): Array<{ code: string; name: string }> => {
        return this.atomicServiceList
    }

    /** 根据 code 显示原子服务名称（非字典） */
    public transAtomicService = (code: string | null | undefined): string => {
        if (!code) return ''
        const item = this.atomicServiceList.find((x) => x.code === code)
        return item ? item.name : code
    }

    public formatBool = (value: boolean) => {
        return value ? "是" : "否"
    }

    /** 按当前语言格式显示日期时间（使用 vue-i18n datetimeFormats.datetime） */
    public formatDate = (date: unknown) => {
        const parsed = this.toDate(date)
        if (!parsed) return ''
        return i18n.global.d(parsed, 'datetime')
    }

    public sleep = (delay: number) => {
        return new Promise<void>((resolve) => window.setTimeout(resolve, delay))
    }

    public close: () => void

    protected doClose() {
        const v = this.visible
        if (v && typeof v === 'object' && 'value' in v) (v as { value: boolean }).value = false
        this.context.emit('update:modelValue', false)
    }

    protected convertThis() {
        this.transDict = (module: string | null | undefined, type: string, code: string) => {
            return this.doTransDict(module, type, code)
        }
        this.close = () => {
            this.doClose()
        }
    }

    private toDate(value: unknown): Date | null {
        if (!value) return null
        if (value instanceof Date) return value
        if (Array.isArray(value)) {
            const parts = value.slice(0, 6)
            const year = Number(parts[0])
            const month = Number(parts[1])
            const day = Number(parts[2])
            const hour = Number(parts[3] ?? 0)
            const minute = Number(parts[4] ?? 0)
            const second = Number(parts[5] ?? 0)
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                return null
            }
            return new Date(year, Math.max(0, month - 1), day, hour, minute, second)
        }
        const parsed = new Date(value as string)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
}
