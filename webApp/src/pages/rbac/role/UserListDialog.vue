<!--
 * Account list within a role
 *
 * @author: K
 * @since 1.0.0
 -->


<template>
  <el-dialog title="User List" v-model="visible" width="50%" center @close="close">
    <el-table border stripe :data="tableData" height="94%" @selection-change="handleSelectionChange"
              :header-cell-style="{textAlign: 'center'}" @sort-change="handleSortChange">
      <el-table-column type="selection" width="39"/>
      <el-table-column type="index" width="50"/>
      <el-table-column label="Username" prop="username" show-overflow-tooltip/>
      <el-table-column label="Subsystem" prop="subSystemCode" show-overflow-tooltip>
        <template #default="scope">
          {{ transAtomicService(scope.row.subSystemCode) }}
        </template>
      </el-table-column>
      <el-table-column label="User Status" prop="userStatusDictCode" show-overflow-tooltip>
        <template #default="scope">
          {{ t(transDict("user", "user_status", scope.row.userStatusDictCode)) }}
        </template>
      </el-table-column>
      <el-table-column label="User Type" prop="userTypeDictCode" show-overflow-tooltip>
        <template #default="scope">
          {{ t(transDict("user", "user_type", scope.row.userTypeDictCode)) }}
        </template>
      </el-table-column>
      <el-table-column label="Last Login Time" show-overflow-tooltip>
        <template #default="scope">
          {{ formatDate(scope.row.lastLoginTime) }}
        </template>
      </el-table-column>
      <el-table-column label="Create Time" show-overflow-tooltip>
        <template #default="scope">
          {{ formatDate(scope.row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column label="Operation" align="center">
        <template #default="scope">
          <tickets @click="handleDetail(scope.row)" class="operate-column-icon"/>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange"
                   :current-page="pagination.pageNo" :page-size="pagination.pageSize"
                   layout="total, sizes, prev, pager, next, jumper" :total="pagination.total"/>

  </el-dialog>

  <account-detail-page v-if="detailDialogVisible" v-model="detailDialogVisible" :rid="rid"/>

</template>

<script lang='ts'>
import {defineComponent, reactive, toRefs} from "vue"
import { BaseListPage } from '../../../components/pages/core/BaseListPage'
import AccountDetailPage from '../../user/account/AccountDetailPage.vue'
import { Pair } from '../../../components/model/Pair'

class UserListDialog extends BaseListPage {

  constructor(props, context) {
    super(props, context)
    this.loadDicts(["user_status", "user_type"], "user")
    this.search()
  }

  protected initState(): any {
    return {}
  }

  protected getRootActionPath(): String {
    return "rbac/role"
  }

  /** User status and user type dict-item translations are fetched from the backend. */
  protected getI18nConfig() {
    return [{ i18nTypeDictCode: 'dict-item', namespaces: ['user_status', 'user_type'], atomicServiceCode: 'user' }]
  }

  protected getSearchUrl(): String {
    return this.getRootActionPath() + "/searchAssignedUsers"
  }

  protected createSearchParams(): any {
    const params = super.createSearchParams()
    params._roleId = this.props.rid
    return params
  }

}

export default defineComponent({
  name: "~UserListDialog",
  props: {
    modelValue: Boolean,
    rid: String
  },
  emits: ['update:modelValue'],
  components: { AccountDetailPage },
  setup(props, context) {
    const listPage = reactive(new UserListDialog(props, context))
    return {
      ...toRefs(listPage.state),
      ...toRefs(listPage),
    }
  }
})
</script>

<style lang='css' scoped>

</style>
