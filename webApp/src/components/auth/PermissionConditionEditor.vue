<!--
 * Structured editor for semicolon-separated permission conditions, with raw text as a lossless
 * fallback. Clause-specific controls are supplied through permissionConditionEditors.ts.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 -->
<template>
  <div class="permission-condition-editor">
    <el-input :model-value="props.modelValue" readonly clearable @clear="clear">
      <template #append>
        <el-popover v-model:visible="visible" placement="bottom-end" :width="560" trigger="click">
          <template #reference>
            <el-button>{{ t('permissionConditionEditor.actions.edit') }}</el-button>
          </template>
          <div class="pce-header">
            <el-radio-group v-model="mode" size="small" @change="onModeChange">
              <el-radio-button value="structured">{{ t('permissionConditionEditor.modes.structured') }}</el-radio-button>
              <el-radio-button value="raw">{{ t('permissionConditionEditor.modes.raw') }}</el-radio-button>
            </el-radio-group>
          </div>

          <el-input
            v-if="mode === 'raw'"
            v-model="rawValue"
            type="textarea"
            :rows="4"
            :placeholder="t('permissionConditionEditor.placeholders.raw')"
            @input="emitRaw"
          />
          <template v-else>
            <div v-for="(clause, index) in clauses" :key="clause.id" class="pce-clause">
              <el-select
                v-model="clause.key"
                filterable
                allow-create
                default-first-option
                :placeholder="t('permissionConditionEditor.placeholders.key')"
                class="pce-key"
                @change="emitStructured"
              >
                <el-option
                  v-for="definition in definitions"
                  :key="definition.key"
                  :value="definition.key"
                  :label="t(definition.labelKey)"
                />
              </el-select>
              <component
                :is="definitionFor(clause.key)?.component"
                v-if="definitionFor(clause.key)?.component"
                :model-value="clause.value"
                v-bind="definitionFor(clause.key)?.componentProps"
                class="pce-value"
                @update:modelValue="(value: unknown) => updateClauseValue(clause, value)"
              />
              <el-input
                v-else
                v-model="clause.value"
                :placeholder="placeholderFor(clause.key)"
                class="pce-value"
                @input="emitStructured"
              />
              <el-button link type="danger" @click="removeClause(index)">
                {{ t('permissionConditionEditor.actions.remove') }}
              </el-button>
            </div>
            <el-button link type="primary" @click="addClause">
              {{ t('permissionConditionEditor.actions.add') }}
            </el-button>
          </template>
        </el-popover>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getPermissionConditionEditor,
  listPermissionConditionEditors,
  type PermissionConditionEditorDefinition,
} from '../../extensions/auth/permissionConditionEditors';

interface ConditionClause {
  id: number;
  key: string;
  value: string;
}

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useI18n();
const visible = ref(false);
const mode = ref<'structured' | 'raw'>('structured');
const rawValue = ref('');
const clauses = ref<ConditionClause[]>([]);
const definitions = ref<PermissionConditionEditorDefinition[]>(listPermissionConditionEditors());
let nextId = 1;

watch(
  () => props.modelValue,
  value => syncFromModel(value ?? ''),
  { immediate: true },
);

function syncFromModel(value: string): void {
  if (value === rawValue.value) return;
  rawValue.value = value;
  const parsed = parse(value);
  if (parsed == null) {
    mode.value = 'raw';
    clauses.value = [];
  } else {
    clauses.value = parsed;
  }
}

function parse(value: string): ConditionClause[] | null {
  if (!value.trim()) return [];
  const parsed: ConditionClause[] = [];
  for (const rawClause of value.split(';')) {
    const separator = rawClause.indexOf('=');
    if (separator <= 0) return null;
    parsed.push({
      id: nextId++,
      key: rawClause.slice(0, separator).trim(),
      value: rawClause.slice(separator + 1).trim(),
    });
  }
  return parsed;
}

function definitionFor(key: string): PermissionConditionEditorDefinition | undefined {
  return getPermissionConditionEditor(key);
}

function placeholderFor(key: string): string {
  const placeholderKey = definitionFor(key)?.placeholderKey;
  return placeholderKey ? t(placeholderKey) : t('permissionConditionEditor.placeholders.value');
}

function onModeChange(): void {
  if (mode.value === 'structured') {
    const parsed = parse(rawValue.value);
    if (parsed == null) {
      mode.value = 'raw';
      return;
    }
    clauses.value = parsed;
    emitStructured();
  }
}

function addClause(): void {
  const unused = definitions.value.find(definition => !clauses.value.some(clause => clause.key === definition.key));
  clauses.value.push({ id: nextId++, key: unused?.key ?? '', value: '' });
  emitStructured();
}

function removeClause(index: number): void {
  clauses.value.splice(index, 1);
  emitStructured();
}

function updateClauseValue(clause: ConditionClause, value: unknown): void {
  clause.value = value == null ? '' : String(value);
  emitStructured();
}

function emitStructured(): void {
  const value = clauses.value
    .filter(clause => clause.key.trim())
    .map(clause => `${clause.key.trim()}=${clause.value.trim()}`)
    .join(';');
  rawValue.value = value;
  emit('update:modelValue', value);
}

function emitRaw(): void {
  emit('update:modelValue', rawValue.value);
}

function clear(): void {
  rawValue.value = '';
  clauses.value = [];
  emit('update:modelValue', '');
}
</script>

<style lang="css" scoped>
.permission-condition-editor {
  width: 300px;
}

.pce-header {
  margin-bottom: 12px;
}

.pce-clause {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pce-key {
  width: 155px;
}

.pce-value {
  flex: 1;
  min-width: 0;
}
</style>
