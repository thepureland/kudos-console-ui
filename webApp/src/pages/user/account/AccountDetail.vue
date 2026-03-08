<!-- 账号详情 -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="accountDetail.title"
    empty-key="accountDetail.empty"
    width="65%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, watch, computed } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';
import SectionedDetailDialog from '../../../components/pages/SectionedDetailDialog.vue';
import {
  type FieldConfig,
  type SectionConfig,
  useSectionedDetail,
} from '../../../components/pages/sectionedDetail';
import { Pair } from '../../../components/model/Pair';

/** 与 CacheDetail 一致：每行最多 2 个字段，每行一条 detail-row 底部分隔线 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'accountDetail.sections.basicInfo' },
  { start: 3, titleKey: 'accountDetail.sections.lockInfo' },
  { start: 4, titleKey: 'accountDetail.sections.loginInfo' },
  { start: 7, titleKey: 'accountDetail.sections.registerInfo' },
  { start: 8, titleKey: 'accountDetail.sections.audit' },
  { start: 10, titleKey: 'accountDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'accountDetail.fields.id', key: 'id' },
    { labelKey: 'accountDetail.fields.username', key: 'username' },
  ],
  [
    { labelKey: 'accountDetail.fields.userStatusDictCode', key: 'userStatusDictCode', type: 'dict', dictModule: 'kuark:user', dictCode: 'user_status' },
    { labelKey: 'accountDetail.fields.userStatusReason', key: 'userStatusReason' },
  ],
  [
    { labelKey: 'accountDetail.fields.userTypeDictCode', key: 'userTypeDictCode', type: 'dict', dictModule: 'kuark:user', dictCode: 'user_type' },
    { labelKey: 'accountDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'accountDetail.fields.lockTimeStart', key: 'lockTimeStart', type: 'date' },
    { labelKey: 'accountDetail.fields.lockTimeEnd', key: 'lockTimeEnd', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.lastLoginTime', key: 'lastLoginTime', type: 'date' },
    { labelKey: 'accountDetail.fields.lastLogoutTime', key: 'lastLogoutTime', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.lastLoginIp', key: 'lastLoginIp' },
    { labelKey: 'accountDetail.fields.lastLoginTerminalDictCode', key: 'lastLoginTerminalDictCode', type: 'dict', dictModule: 'kuark:user', dictCode: 'user_terminal' },
  ],
  [
    { labelKey: 'accountDetail.fields.totalOnlineTime', key: 'totalOnlineTime' },
    { labelKey: 'accountDetail.fields.dynamicAuthKey', key: 'dynamicAuthKey' },
  ],
  [
    { labelKey: 'accountDetail.fields.registerIp', key: 'registerIp' },
    { labelKey: 'accountDetail.fields.registerUrl', key: 'registerUrl' },
  ],
  [
    { labelKey: 'accountDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'accountDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'accountDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'accountDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'accountDetail.fields.subSysDictCode', key: 'subSysDictCode', type: 'atomicService' },
    { labelKey: 'accountDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'accountDetail.fields.tenantName', key: 'tenantName' },
    { labelKey: 'accountDetail.fields.remark', key: 'remark' },
  ],
];

class DetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    if (props.rid) {
      this.state.rid = props.rid as string;
    }
  }

  protected getRootActionPath(): string {
    return 'user/account';
  }

  protected createDetailLoadParams(): { id: string } {
    return { id: String(this.state.rid || this.props.rid || '') };
  }

  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
    await this.loadDictsBatch([
      { dictTypes: ['sys'], atomicServiceCode: 'kuark:sys' },
      { dictTypes: ['user_status', 'user_type', 'user_terminal'], atomicServiceCode: 'kuark:user' },
    ]);
  }
}

export default defineComponent({
  name: 'AccountDetail',
  components: { SectionedDetailDialog },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    rid: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const page = reactive(new DetailPage(props, context)) as DetailPage & {
      state: { detail: Record<string, unknown> | null };
      transAtomicService: (code: string) => string;
      transDict: (module: string, code: string, value: string) => string;
      formatDate: (value: unknown) => string;
    };

    const { rowsWithSections, formatFieldValue } = useSectionedDetail(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'accountDetail.empty',
      yesNoKey: 'accountList.common',
    });

    watch(
      () => props.rid,
      (newRid, oldRid) => {
        const id = newRid ? String(newRid) : '';
        page.state.rid = id;
        if (oldRid !== undefined && id && id !== String(oldRid)) {
          page.state.detail = null;
          page.loadData();
        }
      }
    );

    const visible = computed(() => props.modelValue as boolean);
    function close() {
      context.emit('update:modelValue', false);
    }

    return {
      ...toRefs(page),
      ...toRefs(page.state),
      rowsWithSections,
      formatFieldValue,
      visible,
      close,
    };
  },
});
</script>
