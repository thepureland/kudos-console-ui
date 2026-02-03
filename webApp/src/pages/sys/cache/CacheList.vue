<!--
 * 缓存列表
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <div>
    <el-card>
      <el-row :gutter="20" class="toolbar">
        <el-col :span="2" class="col-search-name">
          <div class="search-name-input-wrap">
            <span ref="nameInputMirrorRef" class="search-name-input-mirror">{{ searchParams.name || namePlaceholder }}</span>
            <el-input
              v-model="searchParams.name"
              :placeholder="namePlaceholder"
              clearable
              :style="{ width: nameInputWidth + 'px' }"
              class="search-name-input"
              @keyup="(e) => e.key === 'Enter' && search()"
              @input="updateNameInputWidth"
              @change="search"
            />
          </div>
        </el-col>
        <el-col :span="2" class="col-search-subsys">
          <div class="search-select-wrap">
            <span ref="subSysSelectMirrorRef" class="search-name-input-mirror">{{ subSysSelectDisplayText }}</span>
            <el-select
              v-model="searchParams.atomicServiceCode"
              :placeholder="subSysPlaceholder"
              clearable
              :style="{ width: subSysSelectWidth + 'px' }"
              class="search-select-input"
              @change="() => { updateSubSysSelectWidth(); search(); }"
            >
              <el-option
                v-for="item in getDictItems('kuark:sys', 'sub_sys')"
                :key="item.first"
                :value="item.first"
                :label="item.second"
              />
            </el-select>
          </div>
        </el-col>
        <el-col :span="15">
          <el-button type="primary" round @click="search">搜索</el-button>
          <el-button type="primary" round @click="resetSearchFields">重置</el-button>
          <el-button type="success" @click="openAddDialog">添加</el-button>
          <el-button type="danger" @click="multiDelete">删除</el-button>
        </el-col>
      </el-row>

      <el-table
        border
        stripe
        :data="tableData"
        height="650"
        :header-cell-style="{ textAlign: 'center' }"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="39" />
        <el-table-column type="index" width="50" />
        <el-table-column label="缓存名称" prop="name" sortable="custom" width="350" />
        <el-table-column label="子系统" prop="atomicServiceCode" width="150">
          <template #default="scope">
            {{ transDict('kuark:sys', 'sub_sys', scope.row.atomicServiceCode) }}
          </template>
        </el-table-column>
        <el-table-column label="缓存策略" prop="strategyDictCode" width="150">
          <template #default="scope">
            {{ transDict('kuark:sys', 'cache_strategy', scope.row.strategyDictCode) }}
          </template>
        </el-table-column>
        <el-table-column label="启动时写缓存" prop="writeOnBoot" width="150">
          <template #default="scope">
            {{ scope.row.writeOnBoot ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column label="及时回写缓存" prop="writeInTime" width="150">
          <template #default="scope">
            {{ scope.row.writeInTime ? '是' : '否' }}
          </template>
        </el-table-column>
        <el-table-column label="TTL(秒)" prop="ttl" width="100" />
        <el-table-column label="备注" prop="remark" />
        <el-table-column label="启用" width="80">
          <template #default="scope">
            <el-switch
              v-model="scope.row.active"
              :active-value="true"
              :inactive-value="false"
              @change="updateActive(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center">
          <template #default="scope">
            <edit @click="handleEdit(scope.row)" class="operate-column-icon" />
            <delete @click="handleDelete(scope.row)" class="operate-column-icon" />
            <tickets @click="handleDetail(scope.row)" class="operate-column-icon" />
            <el-dropdown split-button size="small" type="primary" @command="operateCache">
              管理
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="commandValue(1, scope.row)">重载</el-dropdown-item>
                  <el-dropdown-item :command="commandValue(2, scope.row)">重载所有</el-dropdown-item>
                  <el-dropdown-item :command="commandValue(3, scope.row)">踢除</el-dropdown-item>
                  <el-dropdown-item :command="commandValue(4, scope.row)">清除所有</el-dropdown-item>
                  <el-dropdown-item :command="commandValue(5, scope.row)">检测key是否存在</el-dropdown-item>
                  <el-dropdown-item :command="commandValue(6, scope.row)">获取value情况</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />

      <el-dialog v-model="keyDialogVisible" title="请输入缓存key" width="20%">
        <el-input v-model="cacheKey" />
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="keyDialogVisible = false; cacheKey = null">取消</el-button>
            <el-button type="primary" @click="commitCacheOperation(cacheKey)">确定</el-button>
          </span>
        </template>
      </el-dialog>

      <cache-add-edit v-if="addDialogVisible" v-model="addDialogVisible" @response="afterAdd" />
      <cache-add-edit v-if="editDialogVisible" v-model="editDialogVisible" @response="afterEdit" :rid="rid" />
      <cache-detail v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid" />
    </el-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, ref, computed, onMounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import CacheAddEdit from './CacheAddEdit.vue';
import CacheDetail from './CacheDetail.vue';
import { BaseListPage } from '../../../components/pages/BaseListPage';
import { Pair } from '../../../components/model/Pair';
import { backendRequest } from '../../../utils/backendRequest';

interface CacheCommandPayload {
  item: number;
  row: Record<string, unknown>;
}

class ListPage extends BaseListPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
    this.loadDicts([
      new Pair('kuark:sys', 'sub_sys'),
      new Pair('kuark:sys', 'cache_strategy'),
    ]);
  }

  protected initState(): Record<string, unknown> {
    return {
      searchParams: {
        name: null,
        atomicServiceCode: null,
      },
      keyDialogVisible: false,
      cacheKey: null as string | null,
      cacheOperation: null as string | null,
      currentRow: null as Record<string, unknown> | null,
    };
  }

  protected getRootActionPath(): string {
    return 'sys/cache';
  }

  commandValue(item: number, row: Record<string, unknown>): CacheCommandPayload {
    return { item, row };
  }

  operateCache(payload: CacheCommandPayload): void {
    const { item, row } = payload;
    if (item === 1) this.reload(row);
    else if (item === 2) this.reloadAll(row);
    else if (item === 3) this.evict(row);
    else if (item === 4) this.clear(row);
    else if (item === 5) this.isExists(row);
    else if (item === 6) this.valueInfo(row);
  }

  commitCacheOperation(key: string | null): void {
    this.doCommitCacheOperation(key);
  }

  private async doCommitCacheOperation(key: string | null): Promise<void> {
    (this.state as Record<string, unknown>).keyDialogVisible = false;
    const row = (this.state as Record<string, unknown>).currentRow as Record<string, unknown>;
    const operation = (this.state as Record<string, unknown>).cacheOperation as string;
    const params: Record<string, unknown> = { cacheName: row?.name };
    if (operation !== 'reloadAll' && operation !== 'clear') {
      params.key = key;
    }
    const url = `sys/cache/management/${operation}`;
    try {
      const result = await backendRequest({ url, params }) as { code: number; data?: string };
      if (result.code === 200) {
        ElMessage.info(result.data ?? '');
      } else {
        ElMessage.error('请求操作失败！');
      }
    } catch {
      ElMessage.error('请求操作失败！');
    }
  }

  private reload(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'reload';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private reloadAll(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'reloadAll';
    this.commitCacheOperation(null);
  }

  private evict(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'evict';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private clear(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'clear';
    this.commitCacheOperation(null);
  }

  private isExists(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'isExists';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  private valueInfo(row: Record<string, unknown>): void {
    (this.state as Record<string, unknown>).currentRow = row;
    (this.state as Record<string, unknown>).cacheOperation = 'valueInfo';
    (this.state as Record<string, unknown>).keyDialogVisible = true;
  }

  protected async doUpdateActive(row: Record<string, unknown>): Promise<void> {
    ElMessage.info('更改启用状态仅在重启应用后才生效！');
    await super.doUpdateActive(row);
  }

  protected convertThis(): void {
    super.convertThis();
  }
}

const NAME_PLACEHOLDER = '缓存名称';
const ATOMIC_SERVICE_PLACEHOLDER = '原子服务';
const NAME_INPUT_PADDING = 40;
const SELECT_INPUT_PADDING = 50;

export default defineComponent({
  name: 'CacheList',
  components: { CacheAddEdit, CacheDetail },
  setup(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    const listPage = reactive(new ListPage(props, context)) as ListPage & { state: Record<string, unknown> };
    const nameInputMirrorRef = ref<HTMLElement | null>(null);
    const nameInputWidth = ref(120);
    const namePlaceholder = NAME_PLACEHOLDER;

    function updateNameInputWidth() {
      nextTick(() => {
        const el = nameInputMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + NAME_INPUT_PADDING;
        nameInputWidth.value = w;
      });
    }

    const subSysSelectMirrorRef = ref<HTMLElement | null>(null);
    const subSysSelectWidth = ref(120);
    const subSysPlaceholder = ATOMIC_SERVICE_PLACEHOLDER;
    const subSysSelectDisplayText = computed(() => {
      const params = listPage.state.searchParams as { atomicServiceCode?: string } | undefined;
      const code = params?.atomicServiceCode;
      if (!code) return ATOMIC_SERVICE_PLACEHOLDER;
      const items = listPage.getDictItems('kuark:sys', 'sub_sys') as Array<{ first: string; second: string }>;
      const found = items.find((p) => p.first === code);
      return found ? found.second : ATOMIC_SERVICE_PLACEHOLDER;
    });

    function updateSubSysSelectWidth() {
      nextTick(() => {
        const el = subSysSelectMirrorRef.value;
        if (!el) return;
        const w = el.offsetWidth + SELECT_INPUT_PADDING;
        subSysSelectWidth.value = w;
      });
    }

    onMounted(() => {
      updateNameInputWidth();
      updateSubSysSelectWidth();
    });
    watch(() => (listPage.state as Record<string, unknown>).searchParams, () => {
      updateNameInputWidth();
      updateSubSysSelectWidth();
    }, { deep: true });

    return {
      ...toRefs(listPage.state),
      ...toRefs(listPage),
      nameInputMirrorRef,
      nameInputWidth,
      namePlaceholder,
      updateNameInputWidth,
      subSysSelectMirrorRef,
      subSysSelectWidth,
      subSysPlaceholder,
      subSysSelectDisplayText,
      updateSubSysSelectWidth,
    };
  },
});
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}

.col-search-name,
.col-search-subsys {
  flex: 0 0 auto;
  max-width: none;
}

.search-name-input-wrap,
.search-select-wrap {
  position: relative;
  display: inline-block;
}

.search-name-input-mirror {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: pre;
  font-size: 14px;
  font-family: inherit;
  line-height: 32px;
  padding: 0 11px;
  box-sizing: border-box;
}

.search-name-input,
.search-select-input {
  min-width: 0;
}
</style>
