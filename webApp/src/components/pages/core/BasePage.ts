import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Pair } from "../../model/Pair";
import { backendRequest, getApiResponseData, isApiSuccessResponse } from "../../../utils/backendRequest";
import { i18n, loadMessagesForConfig } from "../../../i18n";
import type { I18nLoadConfig } from "../../../i18n";
import { DictService } from "./DictService";
import type { PageContext, PageProps } from "./pageTypes";

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
    protected readonly dictService: DictService
    public get dictCache(): Map<string, Record<string, string>> {
        return this.dictService.cache
    }
    public state: Record<string, any>
    public visible = ref(false)

    protected props: PageProps
    protected context: PageContext
    public atomicServiceList: SysMicroServiceCacheItem[] = []

    protected constructor(props: PageProps, context: PageContext) {
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

    protected render() {
        const v = this.visible as unknown as { value?: boolean } | boolean
        if (v && typeof v === 'object' && 'value' in v) {
            v.value = true
        } else {
            ;(this as unknown as { visible: boolean }).visible = true
        }
    }

    protected getI18nConfig(): I18nLoadConfig[] | undefined {
        return undefined
    }

    protected abstract initState(): any

    protected initBaseState(): any {
        return { atomicServiceList: [] as SysMicroServiceCacheItem[] }
    }

    protected abstract getRootActionPath(): string

    protected showAfterLoadData(): boolean {
        return false
    }

    public transDict: (atomicServiceCode: string, type: string, code: string) => string

    protected async loadDict(atomicServiceCode: string, dictType: string) {
        await this.dictService.loadDict(atomicServiceCode, dictType)
    }

    protected async loadDicts(dictTypes: string[], atomicServiceCode: string) {
        await this.dictService.loadDicts(dictTypes, atomicServiceCode)
    }

    protected async loadDictsBatch(configs: Array<{ dictTypes: string[]; atomicServiceCode: string }>) {
        await this.dictService.loadDictsBatch(configs)
    }

    public getDictItems = (atomicServiceCode: string, dictType: string): Array<Pair> => {
        return this.dictService.getDictItems(atomicServiceCode, dictType)
    }

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

    public getAtomicServices = (): SysMicroServiceCacheItem[] => {
        return (this.state?.atomicServiceList ?? this.atomicServiceList) ?? []
    }

    public transAtomicService = (code: string | null | undefined): string => {
        if (!code) return ''
        const item = this.atomicServiceList.find((x) => x.code === code)
        return item ? item.name : code
    }

    public formatBool = (value: boolean) => {
        return value ? "是" : "否"
    }

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
        const v = this.visible as unknown as { value?: boolean } | boolean
        if (v && typeof v === 'object' && 'value' in v) {
            v.value = false
        } else {
            ;(this as unknown as { visible: boolean }).visible = false
        }
        this.context.emit('update:modelValue', false)
    }

    protected convertThis() {
        this.transDict = (atomicServiceCode: string, type: string, code: string) => {
            return this.dictService.transDict(atomicServiceCode, type, code)
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
