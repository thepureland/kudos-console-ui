import { markRaw, type Component } from 'vue';

/**
 * Frontend metadata for one backend condition-clause evaluator.
 *
 * Deployments may register a custom component for non-standard clauses. The component receives
 * `modelValue` and emits `update:modelValue`; when omitted, the framework renders a text input.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export interface PermissionConditionEditorDefinition {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  component?: Component;
  componentProps?: Record<string, unknown>;
}

const editors = new Map<string, PermissionConditionEditorDefinition>();

export function registerPermissionConditionEditor(definition: PermissionConditionEditorDefinition): void {
  const key = definition.key.trim();
  if (!key) throw new Error('Permission condition editor key must not be blank');
  editors.set(key, {
    ...definition,
    key,
    component: definition.component ? markRaw(definition.component) : undefined,
  });
}

export function getPermissionConditionEditor(key: string): PermissionConditionEditorDefinition | undefined {
  return editors.get(key);
}

export function listPermissionConditionEditors(): PermissionConditionEditorDefinition[] {
  return [...editors.values()];
}

registerPermissionConditionEditor({
  key: 'ip',
  labelKey: 'permissionConditionEditor.builtIns.ip',
  placeholderKey: 'permissionConditionEditor.placeholders.ip',
});

registerPermissionConditionEditor({
  key: 'time',
  labelKey: 'permissionConditionEditor.builtIns.time',
  placeholderKey: 'permissionConditionEditor.placeholders.time',
});
