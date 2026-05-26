<!--
 * Grant menu permissions to a role
 *
 * @author: K
 * @since 1.0.0
 -->

<template>
  <el-dialog title="Menu Authorization" v-model="visible" width="30%" center @close="close">
    <el-tree
        ref="tree"
        :data="menuData"
        show-checkbox
        node-key="id"
        :check-strictly="checkStrictly"
        default-expand-all
        :default-checked-keys="defaultCheckedKeys"
        :props="defaultProps"
    />

    <el-row :gutter="20">
      <el-col :span="18"/>
      <el-col :span="3">
        <el-button type="primary" round @click="save">OK</el-button>
      </el-col>
      <el-col :span="3">
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

  public defaultProps: any
  public tree: any

  constructor(props, context) {
    super(props, context)
    this.tree = ref<InstanceType<typeof ElTree>>()
    this.defaultProps = {
      children: 'children',
      label: 'title',
    }
    this.loadData()
  }

  protected initBaseState(): any {
    return {
      rid: '',
    }
  }

  protected getRootActionPath(): String {
    return "rbac/role"
  }

  protected initState(): any {
    return {
      menuData: [],
      defaultCheckedKeys: [],
    }
  }

  private async loadData() {
    const params = {
      roleId: this.props.rid
    }
    const url = this.getRootActionPath() + "/getMenuPermissions"
    // @ts-ignore
    const result = await backendRequest({url: url, params})
    const payload = getApiResponseData<{ first?: unknown; second?: unknown }>(result)
    if (payload != null && typeof payload === 'object' && 'first' in payload) {
      this.state.menuData = payload.first

      // Pre-check menus already assigned to the role. A few caveats:
      // 1. When el-tree's check-strictly is false, parents and children are linked.
      // 2. Given (1), when restoring checked items, if a parent node is selected, all of its children get selected too.
      // 3. To work around (2) you might think of setting check-strictly to true before checking, then back to false; that doesn't work and throws.
      // 4. Inspecting tree nodes to detect leaves doesn't work either — there's no observable moment when rendering is finished — so we determine it from the source data directly.
      const checkKeys = payload.second // node keys to check (may include non-leaf nodes)
      let checkLeafKeys = [] // leaf node keys to check
      for (let data of this.state.menuData) {
        this.filterLeaf(data, checkLeafKeys, checkKeys)
      }
      this.state.defaultCheckedKeys = checkLeafKeys

      this.render()
    } else {
      ElMessage.error(await resolveApiResponseMessage(result) || getApiResponseMessage(result) || 'Failed to load data!')
    }
  }

  private filterLeaf(nodeData, checkLeafKeys, checkKeys) {
    if (nodeData.children) {
      for(let childNode of nodeData.children) {
        this.filterLeaf(childNode, checkLeafKeys, checkKeys)
      }
    } else {
      if (checkKeys.indexOf(nodeData.id) != -1) {
        checkLeafKeys.push(nodeData.id)
      }
    }
  }

  public save: () => void

  private async doSave() {
    const params = {
      roleId: this.props.rid,
      resourceIds: this.tree.value!.getCheckedKeys(false)
    }
    const url = this.getRootActionPath() + "/setRolePermissions"
    // @ts-ignore
    const result = await backendRequest({url: url, method: 'post', params})
    if (isApiSuccessResponse(result)) {
      ElMessage.info('Authorization succeeded!')
      this.close()
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
  name: "~MenuAuthorization",
  props: {
    modelValue: Boolean,
    rid: String
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
