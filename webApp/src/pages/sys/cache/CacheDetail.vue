<!-- 缓存详情 -->
<template>
  <el-dialog
    v-model="visible"
    title="缓存信息详情"
    width="40%"
    center
    @close="close"
  >
    <el-row :gutter="10">
      <el-col :span="4">缓存ID：</el-col>
      <el-col :span="8">{{ detail?.id }}</el-col>
      <el-col :span="4">缓存名称：</el-col>
      <el-col :span="8">{{ detail?.name }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">子系统：</el-col>
      <el-col :span="8">{{ transDict('kuark:sys', 'sub_sys', detail?.subSysDictCode) }}</el-col>
      <el-col :span="4">缓存策略：</el-col>
      <el-col :span="8">{{ transDict('kuark:sys', 'cache_strategy', detail?.strategyDictCode) }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">是否启动时写缓存：</el-col>
      <el-col :span="8">{{ detail?.writeOnBoot ? '是' : '否' }}</el-col>
      <el-col :span="4">是否及时回写缓存：</el-col>
      <el-col :span="8">{{ detail?.writeInTime ? '是' : '否' }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">是否内置：</el-col>
      <el-col :span="8">{{ detail?.builtIn ? '是' : '否' }}</el-col>
      <el-col :span="4">是否启用：</el-col>
      <el-col :span="8">{{ detail?.active ? '是' : '否' }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">TTL(秒)：</el-col>
      <el-col :span="8">{{ detail?.ttl }}</el-col>
      <el-col :span="4">备注：</el-col>
      <el-col :span="8">{{ detail?.remark }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">创建时间：</el-col>
      <el-col :span="8">{{ formatDate(detail?.createTime) }}</el-col>
      <el-col :span="4">最近更新时间：</el-col>
      <el-col :span="8">{{ formatDate(detail?.updateTime) }}</el-col>
    </el-row>
    <el-row :gutter="10">
      <el-col :span="4">创建用户：</el-col>
      <el-col :span="8">{{ detail?.createUser }}</el-col>
      <el-col :span="4">最近更新用户：</el-col>
      <el-col :span="8">{{ detail?.updateUser }}</el-col>
    </el-row>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs } from 'vue';
import { BaseDetailPage } from '../../../components/pages/BaseDetailPage';

class DetailPage extends BaseDetailPage {
  constructor(props: Record<string, unknown>, context: { emit: (event: string, ...args: unknown[]) => void }) {
    super(props, context);
  }

  protected getRootActionPath(): string {
    return 'sys/cache';
  }
}

export default defineComponent({
  name: 'CacheDetail',
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
    const page = reactive(new DetailPage(props, context)) as DetailPage & { state: Record<string, unknown> };
    return {
      ...toRefs(page),
      ...toRefs(page.state),
    };
  },
});
</script>

<style scoped>
.el-row {
  margin-bottom: 20px;
}

.el-col-4 {
  text-align: right;
  font-weight: bold;
}
</style>
