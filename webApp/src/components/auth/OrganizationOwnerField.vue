<template>
  <el-select :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)" :disabled="disabled" filterable remote :remote-method="search" :loading="loading" style="width:100%" :placeholder="t('organizationConsole.organization')">
    <el-option v-for="item in options" :key="item.id" :value="item.id" :label="item.name" />
  </el-select>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { backendRequest, resolveApiPayload } from '../../utils/backendRequest';
const props=defineProps<{modelValue?:string|null;disabled?:boolean}>();
defineEmits<{ 'update:modelValue':[value:string] }>();
const {t}=useI18n();
const options=ref<Array<{id:string;name:string}>>([]), loading=ref(false);
let sequence=0;
async function search(name='') {
  const current=++sequence; loading.value=true;
  try {
    const raw=await backendRequest({url:'user/org/pagingSearch',method:'post',params:{nodeKind:'ORGANIZATION',name,pageNo:1,pageSize:50}});
    const result=await resolveApiPayload<{data:Array<{id:string;name:string}>}>(raw,'Unable to load organizations');
    if(current!==sequence)return;
    options.value=result?.data ?? [];
    if(props.modelValue && !options.value.some(item=>item.id===props.modelValue)) options.value.unshift({id:props.modelValue,name:props.modelValue});
  } finally {if(current===sequence)loading.value=false;}
}
watch(()=>props.modelValue,()=>{void search().catch(()=>{if(props.modelValue)options.value=[{id:props.modelValue,name:props.modelValue}];});},{immediate:true});
</script>
