import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Pair } from "../model/Pair";
import { backendRequest, getApiResponseData, isApiSuccessResponse } from "../../utils/backendRequest";
import { i18n, loadMessagesForConfig } from "../../i18n";
import type { I18nLoadConfig } from "../../i18n";
import { DictService } from "./DictService";

/** 原子服务（微服务）缓存项，与后端 SysMicroServiceCacheItem 一致 */
export interface SysMicroServiceCacheItem {
  id: string;
  code: string;
  name: string;
  context?: string | null;
  atomicService: boolean;
  parentCode?: string | null;
  remark?: string | null;
  active: boolean;
  builtIn: boolean;
}

/**
 * 页面处理抽象基类，被列表页、详情页、添加/编辑页继承。
 * 提供字典、原子服务、i18n 日期/布尔格式化及通用 close 等能力。
 *
 * @author K
 * @since 1.0.0
 */
export abstract class BasePage {

    /** 字典服务（加载、缓存、翻译） */
    protected readonly dictService: DictService
    /** 字典缓存引用（等价于 dictService.cache），供需要直接访问缓存的场景使用 */
    public get dictCache(): Map<string, Record<string, string>> {
        return this.dictService.cache
    }
    /** 页面响应式状态，由 initBaseState + initState 合并得到 */
    public state: Record<string, any>
    /** 控制页面/弹窗是否显示 */
    public visible = ref(false)

    protected props: Record<string, any>
    protected context: { emit: (event: string, ...args: any[]) => void }

    /** 原子服务列表（GET sys/microService/getAllActiveAtomicServices），由 loadAtomicServices 拉取 */
    public atomicServiceList: SysMicroServiceCacheItem[] = []

    /** @internal 子类通过 super(props, context) 调用；初始化字典服务、state、convertThis，并根据 showAfterLoadData 决定是否立即 render */
    protected constructor(props: Record<string, any>, context: { emit: (event: string, ...args: any[]) => void }) {
        this.props = props
        this.context = context
        this.dictService = new DictService()
        const win = window as unknown as { __kudosAtomicServices?: SysMicroServiceCacheItem[] }
        this.state = reactive(this.initBaseState())
        if (win.__kudosAtomicServices?.length) {
            this.state.atomicServiceList = win.__kudosAtomicServices
            this.atomicServiceList = win.__kudosAtomicServices
        }
        const initState = this.initState()
        if (initState) {
            const additionalState = reactive(initState)
            Object.assign(this.state, additionalState)
        }
        const i18nConfigs = this.getI18nConfig()
        if (i18nConfigs?.length) loadMessagesForConfig(i18nConfigs)
        this.convertThis()
        if (!this.showAfterLoadData()) {
            this.render()
        }
    }

    /** 控制页面可见并触发渲染；子类可在数据加载后调用 */
    protected render() {
        const v = this.visible as unknown as { value?: boolean } | boolean
        if (v && typeof v === 'object' && 'value' in v) {
            v.value = true
        } else {
            ;(this as unknown as { visible: boolean }).visible = true
        }
    }

    /** 子类重写以指定本页需加载的国际化（namespace + atomicServiceCode）；不重写则不加载 */
    protected getI18nConfig(): I18nLoadConfig[] | undefined {
        return undefined
    }

    /** 子类返回的扩展 state，会与 initBaseState 合并 */
    protected abstract initState(): any

    /** 子类可重写以提供基础 state 字段。atomicServiceList 放 state 以保证异步加载后视图更新。 */
    protected initBaseState(): any {
        return { atomicServiceList: [] as SysMicroServiceCacheItem[] }
    }

    /** 接口根路径，如 'sys/cache'，用于拼接待办接口地址 */
    protected abstract getRootActionPath(): string

    /** 为 true 时构造函数中不立即 render，由子类在数据加载后调用 render */
    protected showAfterLoadData(): boolean {
        return false
    }

    /** 根据原子服务编码+字典类型+编码翻译为显示名称（绑定到 dictService.transDict） */
    public transDict: (atomicServiceCode: string, type: string, code: string) => string

    /** 加载单个字典，已存在则跳过 */
    protected async loadDict(atomicServiceCode: string, dictType: string) {
        await this.dictService.loadDict(atomicServiceCode, dictType)
    }

    /** 批量加载字典，仅加载尚未缓存的项 */
    protected async loadDicts(dictTypes: string[], atomicServiceCode: string) {
        await this.dictService.loadDicts(dictTypes, atomicServiceCode)
    }

    /** 批量加载多组字典（不同 atomicServiceCode 时使用） */
    protected async loadDictsBatch(configs: Array<{ dictTypes: string[]; atomicServiceCode: string }>) {
        await this.dictService.loadDictsBatch(configs)
    }

    /** 返回字典项列表 [Pair(编码, 名称)]，供 el-select 等使用；需先 loadDict/loadDicts */
    public getDictItems = (atomicServiceCode: string, dictType: string): Array<Pair> => {
        return this.dictService.getDictItems(atomicServiceCode, dictType)
    }

    /** 加载原子服务列表（GET sys/microService/getAllActiveAtomicServiceCodes）。后端返回 List<String> 编码，前端转为 { code, name: code }。 */
    protected async loadAtomicServices(): Promise<void> {
        const win = window as unknown as { __kudosAtomicServices?: SysMicroServiceCacheItem[] }
        const result = await backendRequest({ url: 'sys/microService/getAllActiveAtomicServiceCodes' })
        const payload = getApiResponseData<string[]>(result)
        const raw = Array.isArray(payload) ? payload : null
        const list = raw?.length
            ? raw.map((code) => ({
                id: code,
                code,
                name: code,
                context: null as string | null,
                atomicService: true,
                parentCode: null as string | null,
                remark: null as string | null,
                active: true,
                builtIn: true,
              }))
            : null
        if (list?.length) {
            win.__kudosAtomicServices = list
            this.atomicServiceList = list
            this.state.atomicServiceList = list
        } else {
            if (!win.__kudosAtomicServices?.length && !isApiSuccessResponse(result)) {
                ElMessage.error('原子服务列表加载失败')
            }
            const fallback = win.__kudosAtomicServices ?? []
            this.atomicServiceList = fallback
            this.state.atomicServiceList = fallback
        }
    }

    /** 获取原子服务列表，用于下拉等（需先调用 loadAtomicServices）。从 state 取以保证响应式更新。 */
    public getAtomicServices = (): SysMicroServiceCacheItem[] => {
        return (this.state?.atomicServiceList ?? this.atomicServiceList) ?? []
    }

    /** 根据 code 显示原子服务名称（非字典） */
    public transAtomicService = (code: string | null | undefined): string => {
        if (!code) return ''
        const item = this.atomicServiceList.find((x) => x.code === code)
        return item ? item.name : code
    }

    /** 布尔转「是/否」文案 */
    public formatBool = (value: boolean) => {
        return value ? "是" : "否"
    }

    /** 按当前语言格式显示日期时间（使用 vue-i18n datetimeFormats.datetime） */
    public formatDate = (date: unknown) => {
        const parsed = this.toDate(date)
        if (!parsed) return ''
        return i18n.global.d(parsed, 'datetime')
    }

    /** 延迟指定毫秒的 Promise，用于串行请求等 */
    public sleep = (delay: number) => {
        return new Promise<void>((resolve) => window.setTimeout(resolve, delay))
    }

    /** 关闭页面/弹窗（绑定到 doClose） */
    public close: () => void

    /** 隐藏 visible 并 emit update:modelValue false */
    protected doClose() {
        const v = this.visible as unknown as { value?: boolean } | boolean
        if (v && typeof v === 'object' && 'value' in v) {
            v.value = false
        } else {
            ;(this as unknown as { visible: boolean }).visible = false
        }
        this.context.emit('update:modelValue', false)
    }

    /** 将 transDict、close 等绑定到实例方法，避免模板中 this 丢失 */
    protected convertThis() {
        this.transDict = (atomicServiceCode: string, type: string, code: string) => {
            return this.dictService.transDict(atomicServiceCode, type, code)
        }
        this.close = () => {
            this.doClose()
        }
    }

    /** 将后端返回的日期值（数组或字符串）转为 Date，无法解析则返回 null */
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
