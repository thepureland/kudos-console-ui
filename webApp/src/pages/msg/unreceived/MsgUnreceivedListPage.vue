<!--
 * Message unreceived (failed-delivery) list: operator view of unresolved failures for a given send
 * batch. Enter a send id, then resolve or bump-retry individual failures.
 *
 * Backend (kudos-ms-msg, read-only + ops):
 *   GET  msg/unreceived/listUnresolvedBySend?sendId=...  → MsgUnreceivedRow[]
 *   POST msg/unreceived/resolve?id=...                   → mark resolved
 *   POST msg/unreceived/bumpRetry?id=...                 → increment retry count
 *
 * @author: K
 * @author AI: Claude
 * @since 1.0.0
 -->
<template>
  <div class="msg-unreceived-page list-page-common">
    <el-card class="msg-unreceived-card">
      <el-row :gutter="8" class="toolbar">
        <el-col :span="6">
          <el-input v-model="sendId" :placeholder="t('msgUnreceivedList.placeholders.sendId')" clearable @keyup.enter="loadBySend" />
        </el-col>
        <el-col :span="14">
          <el-button type="primary" round @click="loadBySend"><el-icon><Search /></el-icon>{{ t('msgUnreceivedList.actions.search') }}</el-button>
        </el-col>
      </el-row>

      <div ref="tableWrapRef">
        <el-table border stripe :data="tableData" :max-height="tableMaxHeight" :header-cell-style="{ textAlign: 'center' }" v-loading="loading">
          <el-table-column type="index" min-width="50" />
          <el-table-column :label="t('msgUnreceivedList.columns.receiverId')" prop="receiverId" :min-width="columnWidths['receiverId'] ?? 160" show-overflow-tooltip />
          <el-table-column :label="t('msgUnreceivedList.columns.publishMethod')" prop="publishMethodDictCode" :min-width="columnWidths['publishMethodDictCode'] ?? 120" show-overflow-tooltip>
            <template #default="scope">{{ formatDictCell('msg', 'publish_method', scope.row.publishMethodDictCode) }}</template>
          </el-table-column>
          <el-table-column :label="t('msgUnreceivedList.columns.failReason')" prop="failReason" :min-width="columnWidths['failReason'] ?? 220" show-overflow-tooltip />
          <el-table-column :label="t('msgUnreceivedList.columns.retryCount')" prop="retryCount" min-width="90" />
          <el-table-column :label="t('msgUnreceivedList.columns.lastRetryTime')" prop="lastRetryTime" :min-width="columnWidths['lastRetryTime'] ?? 160" show-overflow-tooltip>
            <template #default="scope">{{ formatDate(scope.row.lastRetryTime) }}</template>
          </el-table-column>
          <el-table-column :label="t('msgUnreceivedList.columns.operation')" align="center" fixed="right" min-width="160">
            <template #default="scope">
              <el-button size="small" type="primary" @click="bumpRetry(scope.row)">{{ t('msgUnreceivedList.actions.bumpRetry') }}</el-button>
              <el-button size="small" type="success" @click="resolve(scope.row)">{{ t('msgUnreceivedList.actions.resolve') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { Search } from '@element-plus/icons-vue';
import { BaseListPage } from '../../../components/pages/core';
import type { PageContext, PageProps, ListPageContext, ListPageProps } from '../../../components/pages/core';
import { useListPageLayout, useTableAutoWidthContext } from '../../../components/pages/list';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

class MsgUnreceivedListPage extends BaseListPage {
  constructor(props: PageProps, context: PageContext) {
    super(props, context);
    this.loadDicts(['publish_method'], 'msg');
    this.convertThis();
  }

  protected initState(): Record<string, unknown> {
    return {
      sendId: null as string | null,
      loading: false,
    };
  }

  protected getRootActionPath(): string {
    return 'msg/unreceived';
  }

  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['publish_method'], atomicServiceCode: 'msg' }];
  }

  /** Load unresolved failures for the entered send id (no server pagination — returns a plain list). */
  async loadBySend(): Promise<void> {
    const sendId = this.state.sendId as string | null;
    if (!sendId) {
      ElMessage.warning(this.tr('msgUnreceivedList.messages.sendIdRequired'));
      return;
    }
    this.state.loading = true;
    try {
      const result = await backendRequest({ url: 'msg/unreceived/listUnresolvedBySend', method: 'get', params: { sendId } });
      if (!isApiSuccessResponse(result)) {
        ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('msgUnreceivedList.messages.loadFailed'));
        this.state.tableData = [];
        return;
      }
      const payload = getApiResponseData<Array<Record<string, unknown>>>(result);
      // Guard against unexpected non-array payloads from the backend.
      this.state.tableData = Array.isArray(payload) ? payload : [];
    } finally {
      this.state.loading = false;
    }
  }

  /**
   * Ask the operator to confirm, then POST resolve for the given failure row.
   * ElMessageBox.confirm rejects with the string 'cancel' on dismissal, so we
   * catch and re-use the value — only proceeding when it equals 'confirm'.
   */
  async resolve(row: Record<string, unknown>): Promise<void> {
    const confirmed = await ElMessageBox.confirm(
      this.tr('msgUnreceivedList.messages.resolveConfirm'),
      this.tr('msgUnreceivedList.messages.confirmTitle'),
      { confirmButtonText: this.tr('msgUnreceivedList.messages.confirmButton'), cancelButtonText: this.tr('msgUnreceivedList.messages.cancelButton'), type: 'warning' },
    ).catch((e) => e);
    if (confirmed !== 'confirm') return;
    await this.runOp('msg/unreceived/resolve', row);
  }

  /** Increment the retry counter for the given failure row without a confirmation dialog. */
  async bumpRetry(row: Record<string, unknown>): Promise<void> {
    await this.runOp('msg/unreceived/bumpRetry', row);
  }

  /**
   * Shared POST helper for resolve / bumpRetry.
   * On success: show a toast and refresh the list.
   * On failure: show the best available error message from the response.
   */
  private async runOp(url: string, row: Record<string, unknown>): Promise<void> {
    const result = await backendRequest({ url, method: 'post', params: { id: this.getRowId(row) }, paramsInQuery: true });
    if (isApiSuccessResponse(result)) {
      ElMessage.success(this.tr('msgUnreceivedList.messages.opSuccess'));
      void this.loadBySend();
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || this.tr('msgUnreceivedList.messages.opFailed'));
    }
  }
}

export default defineComponent({
  name: 'MsgUnreceivedListPage',
  components: { Search },
  setup(props: ListPageProps, context: ListPageContext) {
    const { t } = useI18n();
    const listPage = reactive(new MsgUnreceivedListPage(props, context)) as MsgUnreceivedListPage & { state: Record<string, unknown> };
    const { listLayoutRefs } = useListPageLayout(listPage, {});
    const tableWrapRef = ref<HTMLElement | null>(null);

    /**
     * Resolve a dict-code to its display label.
     * `transDict` returns either a dot-separated i18n key (needs translation)
     * or a bare string label (returned as-is). Falls back to an em dash when
     * the code is unrecognised.
     */
    function formatDictCell(module: string, dictType: string, code: unknown): string {
      const key = listPage.transDict(module, dictType, code);
      if (!key) return '—';
      return key.includes('.') ? t(key) : key;
    }

    const { columnWidths } = useTableAutoWidthContext({
      listPage,
      reservedWidthLeft: 0,
      reservedWidthRight: 0,
      createAutoWidthColumns: () => [
        { key: 'receiverId', getLabel: () => t('msgUnreceivedList.columns.receiverId'), getCellText: (row: Record<string, unknown>) => String(row.receiverId ?? '') },
        { key: 'publishMethodDictCode', getLabel: () => t('msgUnreceivedList.columns.publishMethod'), getCellText: (row: Record<string, unknown>) => formatDictCell('msg', 'publish_method', row.publishMethodDictCode) },
        { key: 'failReason', getLabel: () => t('msgUnreceivedList.columns.failReason'), getCellText: (row: Record<string, unknown>) => String(row.failReason ?? '') },
        { key: 'lastRetryTime', getLabel: () => t('msgUnreceivedList.columns.lastRetryTime'), getCellText: (row: Record<string, unknown>) => listPage.formatDate(row.lastRetryTime) },
      ],
    });

    return {
      t,
      ...toRefs(listPage.state), ...toRefs(listPage),
      ...listLayoutRefs,
      tableWrapRef,
      columnWidths,
      formatDictCell,
      loadBySend: () => listPage.loadBySend(),
      resolve: (row: Record<string, unknown>) => listPage.resolve(row),
      bumpRetry: (row: Record<string, unknown>) => listPage.bumpRetry(row),
    };
  },
});
</script>

<style src="../../../styles/list-page-common.css" scoped></style>
<style scoped>
.msg-unreceived-page { height: 100%; }
.msg-unreceived-card { height: 100%; margin-top: 3px; }
.msg-unreceived-card :deep(.el-card__body) { padding: 8px 5px 5px 5px; }
.msg-unreceived-page .toolbar { margin-bottom: 8px; }
</style>
