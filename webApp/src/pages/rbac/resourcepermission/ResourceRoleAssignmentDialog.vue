<!--
 * Menu-role assignment dialog
 *
 * @author: K
 * @since 1.0.0
 -->

<template>
  <el-dialog title="Assign Roles to Menu" v-model="visible" width="20%" center @close="close">
    <el-checkbox-group v-model="checkedRoles">
      <el-checkbox v-for="item in roles" :value="item.id" :key="item.id" style="display:block;">
        {{ item.roleName }}
      </el-checkbox>
    </el-checkbox-group>

    <el-row :gutter="20">
      <el-col :span="16"/>
      <el-col :span="4">
        <el-button type="primary" round @click="save">OK</el-button>
      </el-col>
      <el-col :span="4">
        <el-button type="primary" round @click="close">Cancel</el-button>
      </el-col>
    </el-row>
  </el-dialog>
</template>

<script lang='ts'>
import {defineComponent, reactive, ref, toRefs} from "vue"
import {ElMessage, ElTree} from "element-plus";
import { BasePage } from '../../../components/pages/core/BasePage';
import { backendRequest, getApiResponseData, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

class Page extends BasePage {

  constructor(props, context) {
    super(props, context)
    this.loadData()
  }

  protected getRootActionPath(): String {
    return "rbac/role"
  }

  protected initState(): any {
    return {
      roles: null,
      checkedRoles: []
    }
  }

  private async loadData() {
    const params = {
      resourceId: this.props.rid,
      subSystemCode: this.props.subSystemCode,
      tenantId: this.props.tenantId
    }
    const url = this.getRootActionPath() + "/getResourceRoles"
    // @ts-ignore
    const result = await backendRequest({url: url, method: "post", params})
    const payload = getApiResponseData<{ first?: unknown; second?: unknown }>(result)
    if (payload != null && typeof payload === 'object' && 'first' in payload) {
      this.state.roles = payload.first
      this.state.checkedRoles = payload.second
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Failed to load data!')
    }
  }

  public save: () => void

  private async doSave() {
    const params = {
      resourceId: this.props.rid,
      subSystemCode: this.props.subSystemCode,
      tenantId: this.props.tenantId,
      roleIds: this.state.checkedRoles
    }
    const url = this.getRootActionPath() + "/reassignRolesForResource"
    // @ts-ignore
    const result = await backendRequest({url: url, method: "post", params})
    if (isApiSuccessResponse(result)) {
      ElMessage.info('Authorization succeeded!')
      this.close()
      this.context.emit('response')
    } else {
      ElMessage.info(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Authorization failed!')
    }
  }

  protected convertThis() {
    super.convertThis()
    this.save = () => {
      this.doSave()
    }
  }

}

export default defineComponent({
  name: "~MenuRoleAssignDialog",
  props: {
    modelValue: Boolean,
    rid: String,
    subSystemCode: String,
    tenantId: String
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const page = reactive(new Page(props, context))
    return {
      ...toRefs(page),
      ...toRefs(page.state)
    }
  }
})
</script>

<style lang='css' scoped>

</style>
