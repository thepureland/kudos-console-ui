<!-- Domain detail -->
<template>
  <SectionedDetailDialog
    :model-value="visible"
    title-key="domainDetail.title"
    empty-key="domainDetail.empty"
    width="67%"
    :rows-with-sections="rowsWithSections"
    :detail="detail"
    :format-field-value="formatFieldValue"
    @update:model-value="(v) => { if (v === false) close(); }"
  />
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue';
import { tGlobal } from '../../../i18n';
import {
  type FieldConfig,
  type SectionConfig,
} from '../../../components/pages/detail';
import { backendRequest, getApiResponseData, getApiResponseMessage, resolveApiResponseMessage } from '../../../utils/backendRequest';
import { ElMessage } from 'element-plus';
import { BaseDetailPage } from '../../../components/pages/core';
import type { PageContext, PageProps } from '../../../components/pages/core';
import { commonDetailDialogEmits, commonDetailDialogProps, useDetailPageRidSync, useDetailPageSetupBase, SectionedDetailDialog } from '../../../components/pages/detail';
import type { DetailPageViewModel } from '../../../components/pages/detail';

/**
 * Section break points into ROW_FIELDS (0-indexed row numbers):
 *   rows 0-2  → basicInfo   (id/domain, subSystemCode/tenantId, tenantName)
 *   rows 3-4  → audit       (createTime/updateTime, createUser/updateUser)
 *   rows 5+   → otherInfo   (active/builtIn, remark)
 */
const SECTION_MAP: SectionConfig[] = [
  { start: 0, titleKey: 'domainDetail.sections.basicInfo' },
  { start: 3, titleKey: 'domainDetail.sections.audit' },
  { start: 5, titleKey: 'domainDetail.sections.otherInfo' },
];

const ROW_FIELDS: FieldConfig[][] = [
  [
    { labelKey: 'domainDetail.fields.id', key: 'id' },
    { labelKey: 'domainDetail.fields.domain', key: 'domain' },
  ],
  [
    { labelKey: 'domainDetail.fields.subSystemCode', key: 'subSystemCode', type: 'atomicService' },
    { labelKey: 'domainDetail.fields.tenantId', key: 'tenantId' },
  ],
  [
    { labelKey: 'domainDetail.fields.tenantName', key: 'tenantName' },
  ],
  [
    { labelKey: 'domainDetail.fields.createTime', key: 'createTime', type: 'date' },
    { labelKey: 'domainDetail.fields.updateTime', key: 'updateTime', type: 'date' },
  ],
  [
    { labelKey: 'domainDetail.fields.createUser', key: 'createUser' },
    { labelKey: 'domainDetail.fields.updateUser', key: 'updateUser' },
  ],
  [
    { labelKey: 'domainDetail.fields.active', key: 'active', type: 'boolean' },
    { labelKey: 'domainDetail.fields.builtIn', key: 'builtIn', type: 'boolean' },
  ],
  [
    { labelKey: 'domainDetail.fields.remark', key: 'remark', valueSpan: 3 },
  ],
];

class DomainDetailPage extends BaseDetailPage {
  protected async preLoad(): Promise<void> {
    await this.loadAtomicServices();
  }

  protected getRootActionPath(): string {
    return 'sys/domain';
  }

  protected createDetailLoadParams(): Record<string, unknown> {
    return { id: String(this.state.rid || this.props.rid || ''), pageNo: 1, pageSize: 1 };
  }

  /**
   * Fetches the domain record by id. The endpoint returns a single object
   * (not a list), so we validate the shape before handing off to
   * postLoadDataSuccessfully. Any non-object payload is treated as an error.
   */
  protected async loadData(): Promise<void> {
    const params = this.createDetailLoadParams();
    const result = await backendRequest({ url: this.getDetailLoadUrl(), method: 'get', params });
    const payload = getApiResponseData<Record<string, unknown>>(result);
    if (payload != null && typeof payload === 'object' && !Array.isArray(payload)) {
      this.postLoadDataSuccessfully(payload);
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || tGlobal('listPage.loadDataFailed'));
    }
  }

  /**
   * Normalises optional fields that the template always renders so that the
   * detail dialog never shows "undefined" or blank-renders a boolean cell.
   */
  protected postLoadDataSuccessfully(data: Record<string, unknown> | null): void {
    if (data) {
      if (data.updateTime == null) data.updateTime = null;
      if (data.createUser == null) data.createUser = '';
      if (data.updateUser == null) data.updateUser = '';
      if (data.builtIn == null) data.builtIn = false;
      if (data.remark == null) data.remark = '';
      this.state.detail = data;
    } else {
      this.state.detail = null;
    }
    if (this.showAfterLoadData()) {
      this.render();
    }
  }
}

export default defineComponent({
  name: 'DomainDetailPage',
  components: { SectionedDetailDialog },
  props: {
    ...commonDetailDialogProps,
  },
  emits: commonDetailDialogEmits,
  setup(props: PageProps, context: PageContext) {
    // reactive() wraps the class instance so Vue tracks mutations to this.state
    // inside class methods. The cast restores the concrete type for type-checking.
    const page = reactive(new DomainDetailPage(props, context)) as DomainDetailPage & DetailPageViewModel;

    const { rowsWithSections, formatFieldValue, pageRefs, stateRefs } = useDetailPageSetupBase(page, ROW_FIELDS, SECTION_MAP, {
      emptyKey: 'domainDetail.empty',
      yesNoKey: 'domainList.common',
    });

    useDetailPageRidSync(props, page);

    return {
      ...pageRefs,
      ...stateRefs,
      rowsWithSections,
      formatFieldValue,
    };
  },
});
</script>
