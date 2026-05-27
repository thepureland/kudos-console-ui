<!--
 * Role-user assignment dialog
 *
 * @author: K
 * @since 1.0.0
 -->
<template>
  <el-dialog title="Assign Users" v-model="visible" width="25%" center @close="close">
    <el-transfer
        v-model="assignedUsers"
        style="text-align: left; display: inline-block"
        filterable
        :titles="['Unassigned Users', 'Assigned Users']"
        :format="{
          noChecked: '${total}',
          hasChecked: '${checked}/${total}',
        }"
        :data="candidateUsers">
      <template #default="{ option }">
        <span>{{ option.label }}</span>
      </template>
    </el-transfer>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="submit">OK</el-button>
        <el-button @click="close">Cancel</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang='ts'>
import {defineComponent, reactive, toRefs} from "vue"
import { BaseDetailPage } from '../../../components/pages/core/BaseDetailPage'
import {ElMessage} from "element-plus";
import { backendRequest, getApiResponseMessage, isApiSuccessResponse, resolveApiResponseMessage } from '../../../utils/backendRequest';

class UserAssignmentDialog extends BaseDetailPage {

  constructor(props, context) {
    super(props, context)
  }

  protected getRootActionPath(): String {
    return "rbac/role"
  }

  protected initState(): any {
    return {
      candidateUsers: [],
      assignedUsers: []
    }
  }

  protected getDetailLoadUrl(): String {
    return this.getRootActionPath() + "/getUserAssignment"
  }

  protected createDetailLoadParams(): any {
    return {
      roleId: this.props.rid,
      subSystemCode: this.props.subSystemCode,
      tenantId: this.props.tenantId
    }
  }

  protected postLoadDataSuccessfully(data) {
    for (const elem of data) {
      const user = {key: elem.userId, label: elem.username}
      this.state.candidateUsers.push(user)
      if (elem.assigned) {
        this.state.assignedUsers.push(elem.userId)
      }
    }
    super.postLoadDataSuccessfully(data)
  }

  public handleChange() {

  }

  public submit: () => void

  protected async doSubmit() {
    const params = {
      roleId: this.props.rid,
      userIds: this.state.assignedUsers
    }
    // @ts-ignore
    const result = await backendRequest({url: this.getRootActionPath() + "/assignUser", method: "post", params})
    if (isApiSuccessResponse(result)) {
      ElMessage.success('Saved successfully!')
      this.context.emit('update:modelValue', false)
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Save failed!')
    }
  }

  protected convertThis() {
    super.convertThis()
    this.submit = () => {
      this.doSubmit()
    }
  }

}


export default defineComponent({
  name: "~UserAssignmentDialog",
  props: {
    modelValue: Boolean,
    rid: String,
    subSystemCode: String,
    tenantId: String
  },
  emits: ['update:modelValue'],
  setup(props, context) {
    const dialog = reactive(new UserAssignmentDialog(props, context))
    return {
      ...toRefs(dialog),
      ...toRefs(dialog.state)
    }
  }
})
</script>

<style lang='css' scoped>

</style>
